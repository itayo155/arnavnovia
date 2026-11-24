-- Retire public access to the unused token-transfer app without deleting its data.
-- The separate encrypted homework table and its proof-checked RPCs are unaffected.
BEGIN;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.users, public.transactions
  FROM PUBLIC, anon, authenticated;

-- A restrictive deny policy also covers any pre-existing column grants or policies.
DROP POLICY IF EXISTS legacy_app_disabled ON public.users;
CREATE POLICY legacy_app_disabled ON public.users
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS legacy_app_disabled ON public.transactions;
CREATE POLICY legacy_app_disabled ON public.transactions
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- Privileged legacy RPCs must not provide a route around the table lockdown.
REVOKE EXECUTE ON FUNCTION public.transfer_points(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_tokens(text, text, integer)
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
