-- Secure lookup used by the transactional email endpoint.
create or replace function public.get_operator_invitation_for_email_delivery(p_token_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_identity record;
  v_invite public.operator_invitations%rowtype;
begin
  select * into v_identity from private.current_identity();
  if not found or not private.has_tenant_capability('operators_manage') then
    raise exception 'FORBIDDEN';
  end if;

  select oi.*
    into v_invite
  from public.operator_invitations oi
  where oi.token_hash = p_token_hash
    and oi.organization_id = v_identity.organization_id
    and oi.status = 'pendente'
    and oi.expires_at > now()
  limit 1;

  if not found then
    return null;
  end if;

  return to_jsonb(v_invite);
end;
$$;

revoke all on function public.get_operator_invitation_for_email_delivery(text) from public, anon;
grant execute on function public.get_operator_invitation_for_email_delivery(text) to authenticated, service_role;
