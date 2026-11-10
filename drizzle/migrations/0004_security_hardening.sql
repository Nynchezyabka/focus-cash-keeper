CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
ALTER TABLE public.family_members ADD COLUMN IF NOT EXISTS goals jsonb;
REVOKE ALL ON public.families, public.family_members, public.family_ping FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.families, public.family_members, public.family_ping TO service_role;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_ping ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._fam_norm(t text) RETURNS text LANGUAGE sql IMMUTABLE AS
$$ SELECT regexp_replace(upper(left(coalesce(t,''), 64)), '[^A-Z0-9]', '', 'g') $$;
CREATE OR REPLACE FUNCTION public._fam_me(p_member uuid, p_token text) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE f uuid;
BEGIN
  SELECT family_id INTO f FROM family_members WHERE id = p_member AND token_hash = _fam_hash(left(coalesce(p_token,''), 64));
  IF f IS NULL THEN RAISE EXCEPTION 'not-member'; END IF;
  RETURN f;
END $$;
CREATE OR REPLACE FUNCTION public._fam_size(p_snapshot jsonb, p_name text) RETURNS void LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF octet_length(coalesce(p_snapshot::text, '')) > 4000 OR length(coalesce(p_name, '')) > 200 THEN RAISE EXCEPTION 'too-big'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.family_ping() RETURNS jsonb LANGUAGE sql STABLE AS
$$ SELECT jsonb_build_object('ok', true, 'at', now()) $$;

CREATE OR REPLACE FUNCTION public.family_create(p_name text, p_snapshot jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text := _fam_code(16); tk text := _fam_code(24); f uuid; m uuid;
BEGIN
  PERFORM _fam_size(p_snapshot, p_name);
  INSERT INTO families(code_hash) VALUES (_fam_hash(_fam_norm(c))) RETURNING id INTO f;
  INSERT INTO family_members(family_id, token_hash, name, snapshot) VALUES (f, _fam_hash(tk), left(coalesce(p_name,''), 40), p_snapshot) RETURNING id INTO m;
  RETURN jsonb_build_object('code', c, 'memberId', m, 'token', tk);
END $$;

CREATE OR REPLACE FUNCTION public.family_join(p_code text, p_name text, p_snapshot jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f uuid; n int; tk text := _fam_code(24); m uuid;
BEGIN
  PERFORM _fam_size(p_snapshot, p_name);
  IF length(coalesce(p_code, '')) > 64 THEN RETURN jsonb_build_object('error', 'bad-code'); END IF;
  SELECT id INTO f FROM families WHERE code_hash = _fam_hash(_fam_norm(p_code));
  IF f IS NULL THEN RETURN jsonb_build_object('error', 'bad-code'); END IF;
  SELECT count(*) INTO n FROM family_members WHERE family_id = f;
  IF n >= 3 THEN RETURN jsonb_build_object('error', 'full'); END IF;
  INSERT INTO family_members(family_id, token_hash, name, snapshot) VALUES (f, _fam_hash(tk), left(coalesce(p_name,''), 40), p_snapshot) RETURNING id INTO m;
  RETURN jsonb_build_object('code', left(p_code, 64), 'memberId', m, 'token', tk);
END $$;

CREATE OR REPLACE FUNCTION public.family_push(p_member uuid, p_token text, p_name text, p_share boolean, p_snapshot jsonb, p_txs jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _fam_me(p_member, p_token);
  PERFORM _fam_size(p_snapshot, p_name);
  IF octet_length(coalesce(p_txs::text, '')) > 60000 THEN RAISE EXCEPTION 'too-big'; END IF;
  UPDATE family_members SET name = left(coalesce(p_name,''), 40), share_txs = p_share, snapshot = p_snapshot,
    txs = CASE WHEN p_share THEN p_txs ELSE NULL END, updated_at = now() WHERE id = p_member;
END $$;

CREATE OR REPLACE FUNCTION public.family_kick(p_member uuid, p_token text, p_target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f uuid := _fam_me(p_member, p_token);
BEGIN
  DELETE FROM family_members WHERE id = p_target AND family_id = f AND id <> p_member;
END $$;

REVOKE ALL ON FUNCTION public._fam_hash(text), public._fam_norm(text), public._fam_code(int), public._fam_me(uuid, text), public._fam_size(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_ping(), public.family_create(text, jsonb), public.family_join(text, text, jsonb),
  public.family_push(uuid, text, text, boolean, jsonb, jsonb), public.family_goals_push(uuid, text, jsonb), public.family_pull(uuid, text),
  public.family_leave(uuid, text), public.family_kick(uuid, text, uuid), public.family_rotate(uuid, text), public.family_delete(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.family_ping(), public.family_create(text, jsonb), public.family_join(text, text, jsonb),
  public.family_push(uuid, text, text, boolean, jsonb, jsonb), public.family_goals_push(uuid, text, jsonb), public.family_pull(uuid, text),
  public.family_leave(uuid, text), public.family_kick(uuid, text, uuid), public.family_rotate(uuid, text), public.family_delete(uuid, text) TO anon, authenticated;

CREATE INDEX IF NOT EXISTS feedback_created_idx ON public.feedback(created_at);
CREATE TABLE IF NOT EXISTS public.feedback_guard (id int PRIMARY KEY, fails int NOT NULL DEFAULT 0, locked_until timestamptz);
REVOKE ALL ON public.feedback, public.feedback_owner, public.feedback_guard FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.feedback, public.feedback_owner, public.feedback_guard TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_owner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_guard ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.feedback_send(p_kind text, p_text text, p_author text, p_version text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF length(trim(coalesce(p_text,''))) = 0 THEN RAISE EXCEPTION 'empty'; END IF;
  IF length(p_text) > 2000 OR length(coalesce(p_author,'')) > 200 OR length(coalesce(p_version,'')) > 40 THEN RAISE EXCEPTION 'too-long'; END IF;
  IF (SELECT count(*) FROM feedback WHERE created_at > now() - interval '10 minutes') >= 20
     OR (SELECT count(*) FROM feedback WHERE created_at > now() - interval '1 day') >= 200 THEN RAISE EXCEPTION 'too-many'; END IF;
  INSERT INTO feedback(kind, text, author, app_version)
  VALUES (CASE WHEN p_kind IN ('idea','bug','question') THEN p_kind ELSE 'idea' END,
          p_text, left(coalesce(p_author,''), 60), left(coalesce(p_version,''), 20));
END $$;

CREATE OR REPLACE FUNCTION public._fb_check(p_key text) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE g feedback_guard; ok boolean;
BEGIN
  INSERT INTO feedback_guard(id) VALUES (1) ON CONFLICT (id) DO NOTHING;
  SELECT * INTO g FROM feedback_guard WHERE id = 1 FOR UPDATE;
  IF g.locked_until IS NOT NULL AND g.locked_until > now() THEN RETURN 'locked'; END IF;
  ok := EXISTS (SELECT 1 FROM feedback_owner WHERE id = 1 AND key_hash = _fam_hash(left(coalesce(p_key,''), 200)));
  IF ok THEN UPDATE feedback_guard SET fails = 0, locked_until = NULL WHERE id = 1; RETURN 'ok'; END IF;
  UPDATE feedback_guard SET fails = CASE WHEN g.fails + 1 >= 5 THEN 0 ELSE g.fails + 1 END,
    locked_until = CASE WHEN g.fails + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END WHERE id = 1;
  RETURN 'bad';
END $$;

CREATE OR REPLACE FUNCTION public.feedback_set_owner(p_key text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF length(coalesce(p_key,'')) < 8 THEN RAISE EXCEPTION 'short-key'; END IF;
  INSERT INTO feedback_owner(id, key_hash) VALUES (1, _fam_hash(p_key)) ON CONFLICT (id) DO UPDATE SET key_hash = excluded.key_hash;
  UPDATE feedback_guard SET fails = 0, locked_until = NULL WHERE id = 1;
END $$;

CREATE OR REPLACE FUNCTION public.feedback_login(p_key text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feedback_owner WHERE id = 1) THEN RETURN 'no-owner'; END IF;
  RETURN _fb_check(p_key);
END $$;
CREATE OR REPLACE FUNCTION public.feedback_claim(p_key text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN _fb_check(p_key) = 'ok'; END $$;

CREATE OR REPLACE FUNCTION public.feedback_list(p_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _fb_check(p_key) <> 'ok' THEN RETURN NULL; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'text', text, 'author', author,
    'version', app_version, 'done', done, 'at', created_at) ORDER BY done, created_at DESC) FROM feedback), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.feedback_mark(p_key text, p_id uuid, p_done boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _fb_check(p_key) = 'ok' THEN UPDATE feedback SET done = p_done WHERE id = p_id; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.feedback_delete(p_key text, p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _fb_check(p_key) = 'ok' THEN DELETE FROM feedback WHERE id = p_id; END IF;
END $$;

DROP FUNCTION IF EXISTS public._fb_owner(text);
REVOKE ALL ON FUNCTION public._fb_check(text), public.feedback_set_owner(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.feedback_send(text, text, text, text), public.feedback_login(text), public.feedback_claim(text),
  public.feedback_list(text), public.feedback_mark(text, uuid, boolean), public.feedback_delete(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feedback_send(text, text, text, text), public.feedback_login(text), public.feedback_claim(text),
  public.feedback_list(text), public.feedback_mark(text, uuid, boolean), public.feedback_delete(text, uuid) TO anon, authenticated;