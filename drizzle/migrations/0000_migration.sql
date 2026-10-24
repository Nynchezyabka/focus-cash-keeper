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