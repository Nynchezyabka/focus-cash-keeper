-- Семейные цели уже входят в family-setup.sql — этот файл отдельно выполнять не нужно.
-- Оставлен для истории; содержимое совпадает с соответствующей частью family-setup.sql.
ALTER TABLE public.family_members ADD COLUMN IF NOT EXISTS goals jsonb;
CREATE OR REPLACE FUNCTION public.family_goals_push(p_member uuid, p_token text, p_goals jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _fam_me(p_member, p_token);
  IF p_goals IS NOT NULL AND (jsonb_typeof(p_goals) <> 'array' OR octet_length(p_goals::text) > 20000) THEN RAISE EXCEPTION 'too-big'; END IF;
  UPDATE family_members SET goals = p_goals, updated_at = now() WHERE id = p_member;
END $$;
GRANT EXECUTE ON FUNCTION public.family_goals_push(uuid, text, jsonb) TO anon, authenticated;
