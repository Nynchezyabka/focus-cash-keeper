-- Отзывы. Шаг 2 из 2: выполнить после family-setup.sql. Можно запускать повторно.
-- Затем задайте ключ автора одной строкой (в кавычках свой ключ от 8 символов):
--   SELECT public.feedback_set_owner('ваш-ключ');
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'idea',
  text text NOT NULL,
  author text NOT NULL DEFAULT '',
  app_version text NOT NULL DEFAULT '',
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feedback_created_idx ON public.feedback(created_at);
CREATE TABLE IF NOT EXISTS public.feedback_owner (id int PRIMARY KEY, key_hash text NOT NULL);
-- failed owner-key attempts: after 5 wrong keys the login is closed for 15 minutes
CREATE TABLE IF NOT EXISTS public.feedback_guard (id int PRIMARY KEY, fails int NOT NULL DEFAULT 0, locked_until timestamptz);
REVOKE ALL ON public.feedback, public.feedback_owner, public.feedback_guard FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.feedback, public.feedback_owner, public.feedback_guard TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_owner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_guard ENABLE ROW LEVEL SECURITY;

-- sending: up to 2000 characters, at most 20 messages from everyone in 10 minutes and 200 a day
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

-- 'ok' | 'bad' | 'locked'; never raises, so the failure counter is kept. The key is compared by hash only.
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

-- the owner key is set only by the database owner in SQL Editor: SELECT public.feedback_set_owner('ваш-ключ');
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
-- older app versions: only checks, never sets the key anymore
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
