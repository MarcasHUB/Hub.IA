-- B1-R.3.5G: operator invitation writes are available only through the
-- protected RPC/Edge Function contracts. Neither browser role needs direct
-- table access; validate-operator-invite and accept-invite use service_role.

BEGIN;

REVOKE ALL PRIVILEGES ON TABLE public.operator_invitations
  FROM anon, authenticated, service_role;

GRANT SELECT ON TABLE public.operator_invitations
  TO service_role;

COMMIT;
