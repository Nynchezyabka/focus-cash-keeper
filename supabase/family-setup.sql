-- Семейный доступ: выполнить один раз в SQL Editor своего проекта базы
CREATE TABLE public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  name text NOT NULL DEFAULT '',
  share_txs boolean NOT NULL DEFAULT false,
  snapshot jsonb,
  txs jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX family_members_family_idx ON public.family_members(family_id);
GRANT ALL ON public.families TO service_role;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
-- no policies: only server code (after checking the family code / member token) can read or write
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.family_ping (id int PRIMARY KEY, at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.family_ping TO service_role;
ALTER TABLE public.family_ping ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._fam_hash(t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS
$$ SELECT encode(extensions.digest(t, 'sha256'), 'hex') $$;

CREATE OR REPLACE FUNCTION public._fam_norm(t text) RETURNS text LANGUAGE sql IMMUTABLE AS
$$ SELECT regexp_replace(upper(coalesce(t,'')), '[^A-Z0-9]', '', 'g') $$;

CREATE OR REPLACE FUNCTION public._fam_code(n int) RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public, extensions AS $$
DECLARE a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; b bytea := extensions.gen_random_bytes(n); s text := ''; i int;
BEGIN
  FOR i IN 0..n-1 LOOP
    s := s || substr(a, (get_byte(b, i) % 32) + 1, 1);
    IF i % 4 = 3 AND i < n-1 THEN s := s || '-'; END IF;
  END LOOP;
  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public._fam_me(p_member uuid, p_token text) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE f uuid;
BEGIN
  SELECT family_id INTO f FROM family_members WHERE id = p_member AND token_hash = _fam_hash(p_token);
  IF f IS NULL THEN RAISE EXCEPTION 'not-member'; END IF;
  RETURN f;
END $$;

CREATE OR REPLACE FUNCTION public.family_ping() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t timestamptz;
BEGIN
  INSERT INTO family_ping(id, at) VALUES (1, now()) ON CONFLICT (id) DO UPDATE SET at = now();
  SELECT at INTO t FROM family_ping WHERE id = 1;
  RETURN jsonb_build_object('ok', t IS NOT NULL, 'at', t);
END $$;

CREATE OR REPLACE FUNCTION public.family_create(p_name text, p_snapshot jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text := _fam_code(16); tk text := _fam_code(24); f uuid; m uuid;
BEGIN
  INSERT INTO families(code_hash) VALUES (_fam_hash(_fam_norm(c))) RETURNING id INTO f;
  INSERT INTO family_members(family_id, token_hash, name, snapshot) VALUES (f, _fam_hash(tk), left(coalesce(p_name,''), 40), p_snapshot) RETURNING id INTO m;
  RETURN jsonb_build_object('code', c, 'memberId', m, 'token', tk);
END $$;

CREATE OR REPLACE FUNCTION public.family_join(p_code text, p_name text, p_snapshot jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f uuid; n int; tk text := _fam_code(24); m uuid;
BEGIN
  SELECT id INTO f FROM families WHERE code_hash = _fam_hash(_fam_norm(p_code));
  IF f IS NULL THEN RETURN jsonb_build_object('error', 'bad-code'); END IF;
  SELECT count(*) INTO n FROM family_members WHERE family_id = f;
  IF n >= 6 THEN RETURN jsonb_build_object('error', 'full'); END IF;
  INSERT INTO family_members(family_id, token_hash, name, snapshot) VALUES (f, _fam_hash(tk), left(coalesce(p_name,''), 40), p_snapshot) RETURNING id INTO m;
  RETURN jsonb_build_object('code', p_code, 'memberId', m, 'token', tk);
END $$;

CREATE OR REPLACE FUNCTION public.family_push(p_member uuid, p_token text, p_name text, p_share boolean, p_snapshot jsonb, p_txs jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _fam_me(p_member, p_token);
  UPDATE family_members SET name = left(coalesce(p_name,''), 40), share_txs = p_share, snapshot = p_snapshot,
    txs = CASE WHEN p_share THEN p_txs ELSE NULL END, updated_at = now() WHERE id = p_member;
END $$;

CREATE OR REPLACE FUNCTION public.family_pull(p_member uuid, p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f uuid := _fam_me(p_member, p_token);
BEGIN
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'snapshot', snapshot,
    'txs', CASE WHEN share_txs THEN txs ELSE NULL END, 'updatedAt', updated_at, 'me', id = p_member) ORDER BY updated_at)
    FROM family_members WHERE family_id = f), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.family_leave(p_member uuid, p_token text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f uuid := _fam_me(p_member, p_token);
BEGIN
  DELETE FROM family_members WHERE id = p_member;
  IF NOT EXISTS (SELECT 1 FROM family_members WHERE family_id = f) THEN DELETE FROM families WHERE id = f; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.family_rotate(p_member uuid, p_token text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f uuid := _fam_me(p_member, p_token); c text := _fam_code(16);
BEGIN
  UPDATE families SET code_hash = _fam_hash(_fam_norm(c)) WHERE id = f;
  RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.family_delete(p_member uuid, p_token text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f uuid := _fam_me(p_member, p_token);
BEGIN
  DELETE FROM families WHERE id = f;
END $$;

REVOKE ALL ON FUNCTION public._fam_me(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_ping(), public.family_create(text, jsonb), public.family_join(text, text, jsonb),
  public.family_push(uuid, text, text, boolean, jsonb, jsonb), public.family_pull(uuid, text), public.family_leave(uuid, text),
  public.family_rotate(uuid, text), public.family_delete(uuid, text) TO anon, authenticated;