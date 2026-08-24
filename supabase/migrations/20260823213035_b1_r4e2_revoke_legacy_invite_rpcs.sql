-- B1-R.4E.2: Revoke execution rights from legacy invite RPCs to prevent broken access control

REVOKE ALL ON FUNCTION public.claim_invite(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_invite(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_invite_details(uuid) FROM PUBLIC, anon, authenticated;
