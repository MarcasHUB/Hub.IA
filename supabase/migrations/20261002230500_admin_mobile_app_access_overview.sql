-- Administração do App Campo: visão global de usuários com acesso mobile/PWA
create or replace function public.admin_list_mobile_app_users()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'FORBIDDEN';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', op.id,
        'organization_id', op.organization_id,
        'organization_name', coalesce(org.nome_fantasia, org.razao_social, org.name, 'Empresa'),
        'name', trim(concat_ws(' ', op.nome, op.sobrenome)),
        'email', op.email,
        'profile', op.perfil,
        'operator_status', op.status,
        'access_channel', coalesce(p.access_channel, 'web'),
        'preferred_interface', coalesce(p.preferred_interface, 'web'),
        'is_active', coalesce(p.is_active, true),
        'last_login_at', op.last_login_at,
        'last_activity_at', op.last_activity_at,
        'accepted_at', op.accepted_at
      )
      order by coalesce(op.last_activity_at, op.last_login_at, op.accepted_at, op.created_at) desc nulls last
    ),
    '[]'::jsonb
  )
  into v_result
  from public.operators op
  join public.profiles p on p.user_id = op.id
  left join public.organizations org on org.id = op.organization_id
  where op.deleted_at is null
    and coalesce(p.access_channel, 'web') in ('mobile', 'both');

  return v_result;
end;
$$;

revoke all on function public.admin_list_mobile_app_users() from public, anon;
grant execute on function public.admin_list_mobile_app_users() to authenticated, service_role;
