-- D2 — gestão de canal de acesso e permissões por operador

alter table public.profiles
  add column if not exists access_channel text not null default 'web',
  add column if not exists preferred_interface text not null default 'web',
  add column if not exists is_active boolean not null default true;

alter table public.profiles drop constraint if exists profiles_access_channel_check;
alter table public.profiles add constraint profiles_access_channel_check
  check (access_channel in ('web','mobile','both','disabled'));

alter table public.profiles drop constraint if exists profiles_preferred_interface_check;
alter table public.profiles add constraint profiles_preferred_interface_check
  check (preferred_interface in ('web','mobile'));

create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  can_request_materials boolean not null default false,
  can_manage_quotations boolean not null default false,
  can_approve_requests boolean not null default false,
  can_issue_purchase_orders boolean not null default false,
  can_manage_users boolean not null default false,
  organization_admin boolean not null default false,
  platform_master boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, organization_id)
);

alter table public.user_permissions enable row level security;

create or replace function public.can_manage_org_users(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_permissions up
    where up.user_id = auth.uid()
      and up.organization_id = p_organization_id
      and (up.can_manage_users or up.organization_admin or up.platform_master)
  );
$$;

create or replace function public.set_user_access(
  p_target_user_id uuid,
  p_access_channel text,
  p_preferred_interface text,
  p_permissions jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_caller_org_admin boolean := false;
  v_caller_platform_master boolean := false;
  v_target_platform_master boolean := false;
begin
  select organization_id into v_org from public.profiles where user_id = p_target_user_id limit 1;
  if v_org is null then raise exception 'Perfil não encontrado'; end if;

  select coalesce(organization_admin,false), coalesce(platform_master,false)
    into v_caller_org_admin, v_caller_platform_master
  from public.user_permissions
  where user_id = auth.uid() and organization_id = v_org
  limit 1;

  if not public.can_manage_org_users(v_org) then raise exception 'Sem permissão para gerenciar acessos'; end if;

  select coalesce(platform_master,false) into v_target_platform_master
  from public.user_permissions
  where user_id = p_target_user_id and organization_id = v_org
  limit 1;

  if v_target_platform_master and not v_caller_platform_master then
    raise exception 'Somente um Master da plataforma pode alterar outro Master';
  end if;

  if coalesce((p_permissions->>'platform_master')::boolean,false) and not v_caller_platform_master then
    raise exception 'Somente um Master da plataforma pode conceder acesso Master';
  end if;

  if coalesce((p_permissions->>'organization_admin')::boolean,false)
     and not (v_caller_org_admin or v_caller_platform_master) then
    raise exception 'Somente um administrador pode conceder administração da organização';
  end if;

  if p_access_channel not in ('web','mobile','both','disabled') then raise exception 'Canal de acesso inválido'; end if;
  if p_preferred_interface not in ('web','mobile') then raise exception 'Interface preferida inválida'; end if;

  update public.profiles
  set access_channel = p_access_channel,
      preferred_interface = p_preferred_interface,
      is_active = (p_access_channel <> 'disabled'),
      status = case when p_access_channel = 'disabled' then 'inactive' else 'active' end,
      updated_at = now()
  where user_id = p_target_user_id;

  insert into public.user_permissions (
    user_id, organization_id,
    can_request_materials, can_manage_quotations, can_approve_requests,
    can_issue_purchase_orders, can_manage_users, organization_admin, platform_master
  ) values (
    p_target_user_id, v_org,
    coalesce((p_permissions->>'can_request_materials')::boolean,false),
    coalesce((p_permissions->>'can_manage_quotations')::boolean,false),
    coalesce((p_permissions->>'can_approve_requests')::boolean,false),
    coalesce((p_permissions->>'can_issue_purchase_orders')::boolean,false),
    coalesce((p_permissions->>'can_manage_users')::boolean,false),
    coalesce((p_permissions->>'organization_admin')::boolean,false),
    case when v_caller_platform_master then coalesce((p_permissions->>'platform_master')::boolean,false) else v_target_platform_master end
  )
  on conflict (user_id, organization_id) do update set
    can_request_materials = excluded.can_request_materials,
    can_manage_quotations = excluded.can_manage_quotations,
    can_approve_requests = excluded.can_approve_requests,
    can_issue_purchase_orders = excluded.can_issue_purchase_orders,
    can_manage_users = excluded.can_manage_users,
    organization_admin = excluded.organization_admin,
    platform_master = excluded.platform_master,
    updated_at = now();

  return jsonb_build_object('ok',true,'user_id',p_target_user_id,'organization_id',v_org);
end;
$$;

create or replace function public.get_user_access_for_admin(p_target_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_me public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_permissions public.user_permissions%rowtype;
begin
  select * into v_me from public.profiles where user_id = auth.uid();
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;

  select * into v_target from public.profiles where user_id = p_target_user_id;
  if not found then raise exception 'TARGET_PROFILE_NOT_FOUND'; end if;

  if not coalesce(v_me.is_super_admin,false) then
    if v_me.organization_id is distinct from v_target.organization_id
       or not public.can_manage_org_users(v_target.organization_id) then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  select * into v_permissions from public.user_permissions where user_id = p_target_user_id;

  return jsonb_build_object(
    'user_id', v_target.user_id,
    'organization_id', v_target.organization_id,
    'access_channel', coalesce(v_target.access_channel,'web'),
    'preferred_interface', coalesce(v_target.preferred_interface,'web'),
    'permissions', jsonb_build_object(
      'can_request_materials', coalesce(v_permissions.can_request_materials,false),
      'can_manage_quotations', coalesce(v_permissions.can_manage_quotations,false),
      'can_approve_requests', coalesce(v_permissions.can_approve_requests,false),
      'can_issue_purchase_orders', coalesce(v_permissions.can_issue_purchase_orders,false),
      'can_manage_users', coalesce(v_permissions.can_manage_users,false),
      'organization_admin', coalesce(v_permissions.organization_admin,false),
      'platform_master', coalesce(v_permissions.platform_master,false)
    )
  );
end;
$$;

create or replace function public.get_my_operators()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_identity record;
  v_result jsonb;
begin
  select * into v_identity from private.current_identity();
  if not found then raise exception 'AUTH_IDENTITY_INCONSISTENT'; end if;
  if not private.has_tenant_capability('operators_read') then raise exception 'FORBIDDEN'; end if;

  select coalesce(jsonb_agg(
    to_jsonb(op) || jsonb_build_object(
      'category_ids', coalesce((select jsonb_agg(oc.category_id order by oc.category_id) from public.operator_categories oc where oc.operator_id = op.id), '[]'::jsonb),
      'access_channel', coalesce(p.access_channel, 'web'),
      'preferred_interface', coalesce(p.preferred_interface, 'web')
    ) order by op.nome, op.sobrenome
  ), '[]'::jsonb)
  into v_result
  from public.operators op
  left join public.profiles p on p.user_id = op.id
  where op.organization_id = v_identity.organization_id
    and op.deleted_at is null;

  return v_result;
end;
$$;

revoke all on function public.can_manage_org_users(uuid) from public, anon;
revoke all on function public.set_user_access(uuid,text,text,jsonb) from public, anon;
revoke all on function public.get_user_access_for_admin(uuid) from public, anon;
revoke all on function public.get_my_operators() from public, anon;

grant execute on function public.can_manage_org_users(uuid) to authenticated, service_role;
grant execute on function public.set_user_access(uuid,text,text,jsonb) to authenticated, service_role;
grant execute on function public.get_user_access_for_admin(uuid) to authenticated, service_role;
grant execute on function public.get_my_operators() to authenticated, service_role;
