-- Отзывы: выполнить один раз в SQL Editor своей базы (после family-setup.sql — нужен pgcrypto и _fam_hash)
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'idea',
  text text NOT NULL,
  author text NOT NULL DEFAULT '',
  app_version text NOT NULL DEFAULT '',
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.feedback_owner (id int PRIMARY KEY, key_hash text NOT NULL);
GRANT ALL ON public.feedback TO service_role;
GRANT ALL ON public.feedback_owner TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_owner ENABLE ROW LEVEL SECURITY;
-- no policies: anyone may only send via feedback_send; reading needs the owner key

CREATE OR REPLACE FUNCTION public.feedback_send(p_kind text, p_text text, p_author text, p_version text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF length(trim(coalesce(p_text,''))) = 0 THEN RAISE EXCEPTION 'empty'; END IF;
  INSERT INTO feedback(kind, text, author, app_version)
  VALUES (CASE WHEN p_kind IN ('idea','bug','question') THEN p_kind ELSE 'idea' END,
          left(p_text, 4000), left(coalesce(p_author,''), 60), left(coalesce(p_version,''), 20));
END $$;

-- first call sets the owner key; later calls only check it
CREATE OR REPLACE FUNCTION public.feedback_claim(p_key text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h text;
BEGIN
  IF length(coalesce(p_key,'')) < 8 THEN RETURN false; END IF;
  SELECT key_hash INTO h FROM feedback_owner WHERE id = 1;
  IF h IS NULL THEN INSERT INTO feedback_owner(id, key_hash) VALUES (1, _fam_hash(p_key)); RETURN true; END IF;
  RETURN h = _fam_hash(p_key);
END $$;

CREATE OR REPLACE FUNCTION public._fb_owner(p_key text) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feedback_owner WHERE id = 1 AND key_hash = _fam_hash(coalesce(p_key,''))) THEN RAISE EXCEPTION 'not-owner'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.feedback_list(p_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _fb_owner(p_key);
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'text', text, 'author', author,
    'version', app_version, 'done', done, 'at', created_at) ORDER BY done, created_at DESC) FROM feedback), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.feedback_mark(p_key text, p_id uuid, p_done boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _fb_owner(p_key);
  UPDATE feedback SET done = p_done WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.feedback_delete(p_key text, p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM _fb_owner(p_key);
  DELETE FROM feedback WHERE id = p_id;
END $$;

REVOKE ALL ON FUNCTION public._fb_owner(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.feedback_send(text, text, text, text), public.feedback_claim(text),
  public.feedback_list(text), public.feedback_mark(text, uuid, boolean), public.feedback_delete(text, uuid) TO anon, authenticated;
