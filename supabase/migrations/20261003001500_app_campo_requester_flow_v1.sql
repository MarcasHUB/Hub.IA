-- APP CAMPO v1: mobile requester flow, tenant material catalog, attachments and requester access defaults.
alter table public.internal_request_items
  add column if not exists material_id uuid references public.materials(id) on delete set null,
  add column if not exists photo_path text,
  add column if not exists item_notes text;

create index if not exists internal_request_items_material_idx
  on public.internal_request_items(material_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('request-attachments','request-attachments',false,10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update
set public=excluded.public,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "request_attachments_select_tenant" on storage.objects;
create policy "request_attachments_select_tenant"
on storage.objects for select to authenticated
using (
  bucket_id='request-attachments'
  and (storage.foldername(name))[1]=public.current_authenticated_organization_id()::text
);

drop policy if exists "request_attachments_insert_tenant" on storage.objects;
create policy "request_attachments_insert_tenant"
on storage.objects for insert to authenticated
with check (
  bucket_id='request-attachments'
  and (storage.foldername(name))[1]=public.current_authenticated_organization_id()::text
);

create or replace function public.get_requestable_materials()
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare
  v_org uuid;
  v_result jsonb;
begin
  select i.organization_id into v_org from private.current_identity() i;
  if v_org is null then raise exception 'AUTH_INVALID'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'material_id',m.id,
    'name',coalesce(nullif(om.display_name,''),m.official_name),
    'description',m.description,
    'unit',coalesce(nullif(m.unit,''),'UN'),
    'internal_sku',om.internal_sku,
    'erp_code',om.erp_code,
    'category_id',coalesce(om.category_id,m.category_id)
  ) order by coalesce(nullif(om.display_name,''),m.official_name)),'[]'::jsonb)
  into v_result
  from public.organization_materials om
  join public.materials m on m.id=om.material_id
  where om.organization_id=v_org
    and coalesce(om.is_active,true)
    and coalesce(om.available_for_purchase,true)
    and coalesce(m.is_active,true)
    and m.merged_into_material_id is null;

  return v_result;
end;
$$;

revoke all on function public.get_requestable_materials() from public, anon;
grant execute on function public.get_requestable_materials() to authenticated, service_role;

do $$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='accept_operator_invitation_transactional'
  limit 1;
  if v_def is null then raise exception 'accept_operator_invitation_transactional not found'; end if;

  v_def := replace(
    v_def,
    'INSERT INTO public.profiles (user_id, organization_id, full_name, email, updated_at)\n  VALUES (p_user_id, v_invite.organization_id, v_operator_full_name, v_invite.email, now())\n  ON CONFLICT (user_id) DO UPDATE SET\n    organization_id = EXCLUDED.organization_id,\n    full_name = EXCLUDED.full_name,\n    email = EXCLUDED.email,\n    updated_at = now();',
    'INSERT INTO public.profiles (user_id, organization_id, full_name, email, access_channel, preferred_interface, is_active, updated_at)\n  VALUES (p_user_id, v_invite.organization_id, v_operator_full_name, v_invite.email,\n          CASE WHEN v_invite.perfil = ''solicitante'' THEN ''mobile'' ELSE ''web'' END,\n          CASE WHEN v_invite.perfil = ''solicitante'' THEN ''mobile'' ELSE ''web'' END,\n          true, now())\n  ON CONFLICT (user_id) DO UPDATE SET\n    organization_id = EXCLUDED.organization_id,\n    full_name = EXCLUDED.full_name,\n    email = EXCLUDED.email,\n    access_channel = EXCLUDED.access_channel,\n    preferred_interface = EXCLUDED.preferred_interface,\n    is_active = true,\n    updated_at = now();\n\n  INSERT INTO public.user_permissions (user_id, organization_id, can_request_materials, can_manage_quotations, can_approve_requests, can_issue_purchase_orders, can_manage_users, organization_admin, platform_master)\n  VALUES (p_user_id, v_invite.organization_id,\n          v_invite.perfil = ''solicitante'',\n          v_invite.perfil in (''comprador'',''gestor'',''administrador''),\n          v_invite.perfil in (''gestor'',''administrador''),\n          v_invite.perfil in (''comprador'',''administrador''),\n          v_invite.perfil = ''administrador'',\n          v_invite.perfil = ''administrador'',\n          false)\n  ON CONFLICT (user_id, organization_id) DO UPDATE SET\n    can_request_materials = EXCLUDED.can_request_materials,\n    can_manage_quotations = EXCLUDED.can_manage_quotations,\n    can_approve_requests = EXCLUDED.can_approve_requests,\n    can_issue_purchase_orders = EXCLUDED.can_issue_purchase_orders,\n    can_manage_users = EXCLUDED.can_manage_users,\n    organization_admin = EXCLUDED.organization_admin,\n    updated_at = now();'
  );
  execute v_def;
end $$;

update public.profiles p
set access_channel='mobile',preferred_interface='mobile',updated_at=now()
from public.operators o
where o.id=p.user_id and o.perfil='solicitante' and o.status='ativo' and p.access_channel='web';

insert into public.user_permissions (
  user_id,organization_id,can_request_materials,can_manage_quotations,
  can_approve_requests,can_issue_purchase_orders,can_manage_users,
  organization_admin,platform_master
)
select o.id,o.organization_id,true,false,false,false,false,false,false
from public.operators o
where o.perfil='solicitante' and o.status='ativo'
on conflict (user_id,organization_id) do update set
  can_request_materials=true,
  can_manage_quotations=false,
  can_approve_requests=false,
  can_issue_purchase_orders=false,
  can_manage_users=false,
  organization_admin=false,
  updated_at=now();
