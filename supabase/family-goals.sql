-- Общие цели + защита: можно выполнять повторно (в SQL Editor своей базы, после family-setup.sql)
ALTER TABLE public.family_members ADD COLUMN IF NOT EXISTS goals jsonb;

CREATE OR REPLACE FUNCTION public.family_goals_push(p_member uuid, p_token text, p_goals jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _fam_me(p_member, p_token);
  IF p_goals IS NOT NULL AND (jsonb_typeof(p_goals) <> 'array' OR octet_length(p_goals::text) > 20000) THEN RAISE EXCEPTION 'too-big'; END IF;
  UPDATE family_members SET goals = p_goals, updated_at = now() WHERE id = p_member;
END $$;

CREATE OR REPLACE FUNCTION public.family_push(p_member uuid, p_token text, p_name text, p_share boolean, p_snapshot jsonb, p_txs jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _fam_me(p_member, p_token);
  IF octet_length(coalesce(p_snapshot::text, '')) > 4000 OR octet_length(coalesce(p_txs::text, '')) > 60000 THEN RAISE EXCEPTION 'too-big'; END IF;
  UPDATE family_members SET name = left(coalesce(p_name,''), 40), share_txs = p_share, snapshot = p_snapshot,
    txs = CASE WHEN p_share THEN p_txs ELSE NULL END, updated_at = now() WHERE id = p_member;
END $$;

CREATE OR REPLACE FUNCTION public.family_pull(p_member uuid, p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f uuid := _fam_me(p_member, p_token);
BEGIN
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'snapshot', snapshot,
    'txs', CASE WHEN share_txs THEN txs ELSE NULL END, 'goals', goals, 'updatedAt', updated_at, 'me', id = p_member) ORDER BY updated_at)
    FROM family_members WHERE family_id = f), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.family_join(p_code text, p_name text, p_snapshot jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f uuid; n int; tk text := _fam_code(24); m uuid;
BEGIN
  SELECT id INTO f FROM families WHERE code_hash = _fam_hash(_fam_norm(p_code));
  IF f IS NULL THEN RETURN jsonb_build_object('error', 'bad-code'); END IF;
  SELECT count(*) INTO n FROM family_members WHERE family_id = f;
  IF n >= 3 THEN RETURN jsonb_build_object('error', 'full'); END IF;
  INSERT INTO family_members(family_id, token_hash, name, snapshot) VALUES (f, _fam_hash(tk), left(coalesce(p_name,''), 40), p_snapshot) RETURNING id INTO m;
  RETURN jsonb_build_object('code', p_code, 'memberId', m, 'token', tk);
END $$;

REVOKE ALL ON FUNCTION public._fam_me(uuid, text), public._fam_code(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_goals_push(uuid, text, jsonb), public.family_push(uuid, text, text, boolean, jsonb, jsonb),
  public.family_pull(uuid, text), public.family_join(text, text, jsonb) TO anon, authenticated;
