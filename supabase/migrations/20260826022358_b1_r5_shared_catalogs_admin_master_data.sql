-- B1-R.5.7A - Shared catalogs, global master-data governance and support requests.
-- Non-destructive: historical tenant-owned rows are preserved as-is.

begin;

-- ---------------------------------------------------------------------------
-- Certifications: lifecycle and deterministic duplicate protection.
-- Production audit confirmed there are no lower(trim(name)) collisions.
-- ---------------------------------------------------------------------------

alter table public.certifications
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table public.certifications
  drop constraint if exists certifications_name_not_blank;

alter table public.certifications
  add constraint certifications_name_not_blank
  check (length(btrim(name)) > 0);

create unique index if not exists certifications_normalized_name_uniq
  on public.certifications (lower(btrim(name)));

drop trigger if exists trg_certifications_updated_at on public.certifications;
create trigger trg_certifications_updated_at
  before update on public.certifications
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Categories: global operational read, admin-only global writes and hierarchy.
-- ---------------------------------------------------------------------------

create unique index if not exists categories_global_normalized_name_uniq
  on public.categories (normalized_name)
  where organization_id is null;

create or replace function private.validate_global_category_hierarchy()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent_organization_id uuid;
begin
  if new.organization_id is not null or new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'CATEGORY_SELF_PARENT_NOT_ALLOWED';
  end if;

  select c.organization_id
    into v_parent_organization_id
  from public.categories c
  where c.id = new.parent_id;

  if not found or v_parent_organization_id is not null then
    raise exception 'GLOBAL_CATEGORY_PARENT_MUST_BE_GLOBAL';
  end if;

  if exists (
    with recursive ancestors as (
      select c.id, c.parent_id
      from public.categories c
      where c.id = new.parent_id
      union all
      select c.id, c.parent_id
      from public.categories c
      join ancestors a on c.id = a.parent_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'CATEGORY_CYCLE_NOT_ALLOWED';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_global_category_hierarchy on public.categories;
create trigger trg_validate_global_category_hierarchy
  before insert or update of organization_id, parent_id on public.categories
  for each row execute function private.validate_global_category_hierarchy();

drop policy if exists categories_org_select on public.categories;
drop policy if exists categories_org_write on public.categories;
drop policy if exists tenant_isolation_policy_categories on public.categories;

create policy categories_shared_read
on public.categories for select to authenticated
using (is_active = true or public.is_super_admin());

create policy categories_global_admin_insert
on public.categories for insert to authenticated
with check (public.is_super_admin() and organization_id is null);

create policy categories_global_admin_update
on public.categories for update to authenticated
using (public.is_super_admin() and organization_id is null)
with check (public.is_super_admin() and organization_id is null);

create policy categories_global_admin_delete
on public.categories for delete to authenticated
using (public.is_super_admin() and organization_id is null);

-- ---------------------------------------------------------------------------
-- Segments: global operational read and admin-only global writes.
-- ---------------------------------------------------------------------------

create unique index if not exists segments_global_active_normalized_name_uniq
  on public.segments (lower(btrim(nome)))
  where organization_id is null and deleted_at is null and status = 'ativo';

drop policy if exists segments_delete_policy on public.segments;
drop policy if exists segments_insert_policy on public.segments;
drop policy if exists segments_org_delete on public.segments;
drop policy if exists segments_org_insert on public.segments;
drop policy if exists segments_org_read on public.segments;
drop policy if exists segments_org_update on public.segments;
drop policy if exists segments_select_policy on public.segments;
drop policy if exists segments_tenant_isolation on public.segments;
drop policy if exists segments_update_policy on public.segments;

create policy segments_shared_read
on public.segments for select to authenticated
using ((status = 'ativo' and deleted_at is null) or public.is_super_admin());

create policy segments_global_admin_insert
on public.segments for insert to authenticated
with check (
  public.is_super_admin()
  and organization_id is null
  and responsavel_id is null
  and deleted_at is null
);

create policy segments_global_admin_update
on public.segments for update to authenticated
using (public.is_super_admin() and organization_id is null)
with check (
  public.is_super_admin()
  and organization_id is null
  and responsavel_id is null
);

create policy segments_global_admin_delete
on public.segments for delete to authenticated
using (public.is_super_admin() and organization_id is null);

-- ---------------------------------------------------------------------------
-- Certifications: authenticated shared read; platform-admin-only maintenance.
-- ---------------------------------------------------------------------------

drop policy if exists certifications_read_all on public.certifications;

create policy certifications_shared_read
on public.certifications for select to authenticated
using (is_active = true or public.is_super_admin());

create policy certifications_global_admin_insert
on public.certifications for insert to authenticated
with check (public.is_super_admin());

create policy certifications_global_admin_update
on public.certifications for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy certifications_global_admin_delete
on public.certifications for delete to authenticated
using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Materials: shared discovery without weakening master-data ownership.
-- Historical visibility values remain untouched; new rows default to shared.
-- ---------------------------------------------------------------------------

alter table public.materials
  alter column visibility set default 'shared'::public.material_visibility;

drop policy if exists materials_select on public.materials;
create policy materials_shared_read
on public.materials for select to authenticated
using (
  public.is_super_admin()
  or (
    is_active = true
    and validation_status in (
      'pending_review'::public.material_validation_status,
      'needs_correction'::public.material_validation_status,
      'validated'::public.material_validation_status
    )
    and merged_into_material_id is null
  )
);

create or replace function public.protect_material_admin_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_super_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.master_owner_organization_id is distinct from public.current_org_id()
       or new.created_by is distinct from auth.uid()
       or new.validation_status <> 'pending_review'::public.material_validation_status
       or new.reviewed_at is not null
       or new.reviewed_by is not null
       or new.validated_at is not null
       or new.validated_by is not null
       or new.merged_into_material_id is not null then
      raise exception 'MATERIAL_MASTER_INSERT_GOVERNANCE_VIOLATION';
    end if;
    return new;
  end if;

  if new.created_by is distinct from old.created_by
     or new.created_source is distinct from old.created_source
     or new.validated_by is distinct from old.validated_by
     or new.validated_at is distinct from old.validated_at
     or new.master_owner_organization_id is distinct from old.master_owner_organization_id
     or new.validation_status is distinct from old.validation_status
     or new.visibility is distinct from old.visibility
     or new.reviewed_at is distinct from old.reviewed_at
     or new.reviewed_by is distinct from old.reviewed_by
     or new.merged_into_material_id is distinct from old.merged_into_material_id
     or new.is_active is distinct from old.is_active then
    raise exception 'MATERIAL_ADMIN_FIELDS_IMMUTABLE_FOR_TENANT';
  end if;

  return new;
end;
$$;

-- Remove the historical duplicate trigger and keep one governance trigger.
drop trigger if exists trg_materials_protect_admin on public.materials;
drop trigger if exists trg_protect_material_admin_fields on public.materials;
create trigger trg_protect_material_admin_fields
  before insert or update on public.materials
  for each row execute function public.protect_material_admin_fields();

-- organization_materials is tenant data, but may reference any operational
-- shared material/category. organization_id always remains the current tenant.
drop policy if exists organization_materials_insert_own on public.organization_materials;
drop policy if exists organization_materials_update_own on public.organization_materials;

create policy organization_materials_insert_own
on public.organization_materials for insert to authenticated
with check (
  (organization_id = public.current_org_id() or public.is_super_admin())
  and (
    public.has_role(auth.uid(), organization_id, 'admin'::public.app_role)
    or public.has_role(auth.uid(), organization_id, 'buyer'::public.app_role)
  )
  and (
    category_id is null
    or exists (
      select 1 from public.categories c
      where c.id = category_id and c.is_active = true
    )
  )
  and exists (
    select 1 from public.materials m
    where m.id = material_id
      and m.is_active = true
      and m.validation_status in (
        'pending_review'::public.material_validation_status,
        'needs_correction'::public.material_validation_status,
        'validated'::public.material_validation_status
      )
      and m.merged_into_material_id is null
  )
);

create policy organization_materials_update_own
on public.organization_materials for update to authenticated
using (
  (organization_id = public.current_org_id() or public.is_super_admin())
  and (
    public.has_role(auth.uid(), organization_id, 'admin'::public.app_role)
    or public.has_role(auth.uid(), organization_id, 'buyer'::public.app_role)
  )
)
with check (
  (organization_id = public.current_org_id() or public.is_super_admin())
  and (
    category_id is null
    or exists (
      select 1 from public.categories c
      where c.id = category_id and c.is_active = true
    )
  )
  and exists (
    select 1 from public.materials m
    where m.id = material_id
      and m.is_active = true
      and m.validation_status in (
        'pending_review'::public.material_validation_status,
        'needs_correction'::public.material_validation_status,
        'validated'::public.material_validation_status
      )
      and m.merged_into_material_id is null
  )
);

-- ---------------------------------------------------------------------------
-- Support: structured requests for category/segment/certification only.
-- ---------------------------------------------------------------------------

alter table public.support_tickets
  add column if not exists request_type text,
  add column if not exists request_payload jsonb not null default '{}'::jsonb;

alter table public.support_tickets
  drop constraint if exists support_tickets_category_check,
  drop constraint if exists support_tickets_master_data_request_check,
  drop constraint if exists support_tickets_request_payload_object_check;

alter table public.support_tickets
  add constraint support_tickets_category_check
  check (category in (
    'access', 'company_registration', 'invites', 'network_partners',
    'materials', 'quotations', 'system_error', 'other', 'master_data_request'
  )),
  add constraint support_tickets_master_data_request_check
  check (
    (category = 'master_data_request' and request_type in ('category', 'segment', 'certification'))
    or (category <> 'master_data_request' and request_type is null)
  ),
  add constraint support_tickets_request_payload_object_check
  check (jsonb_typeof(request_payload) = 'object');

drop function if exists public.support_create_ticket(text, text, text, text, text, text, uuid);

create function public.support_create_ticket(
  p_subject text,
  p_category text,
  p_module text,
  p_priority text,
  p_content text,
  p_affected_entity_type text default null,
  p_affected_entity_id uuid default null,
  p_request_type text default null,
  p_request_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_ticket_id uuid;
  v_user_name text;
  v_subject text;
  v_module text;
  v_request_name text;
begin
  v_org_id := (select organization_id from private.current_identity());
  if v_org_id is null then
    raise exception 'Organizacao nao encontrada para o tenant';
  end if;

  if p_category = 'master_data_request' then
    if p_request_type not in ('category', 'segment', 'certification') then
      raise exception 'SUPPORT_MASTER_DATA_REQUEST_TYPE_INVALID';
    end if;
    if jsonb_typeof(coalesce(p_request_payload, '{}'::jsonb)) <> 'object' then
      raise exception 'SUPPORT_MASTER_DATA_PAYLOAD_INVALID';
    end if;

    v_request_name := btrim(coalesce(p_request_payload->>'name', ''));
    if v_request_name = '' then
      raise exception 'SUPPORT_MASTER_DATA_NAME_REQUIRED';
    end if;

    if p_request_type = 'category' and exists (
      select 1 from public.categories c
      where c.normalized_name = public.normalize_text_key(v_request_name)
        and c.is_active = true
    ) then
      raise exception 'SUPPORT_MASTER_DATA_ALREADY_EXISTS';
    elsif p_request_type = 'segment' and exists (
      select 1 from public.segments s
      where public.normalize_text_key(s.nome) = public.normalize_text_key(v_request_name)
        and s.status = 'ativo' and s.deleted_at is null
    ) then
      raise exception 'SUPPORT_MASTER_DATA_ALREADY_EXISTS';
    elsif p_request_type = 'certification' and exists (
      select 1 from public.certifications c
      where lower(btrim(c.name)) = lower(v_request_name)
        and c.is_active = true
    ) then
      raise exception 'SUPPORT_MASTER_DATA_ALREADY_EXISTS';
    end if;

    v_subject := case p_request_type
      when 'category' then 'Solicitação de nova categoria — ' || v_request_name
      when 'segment' then 'Solicitação de novo segmento — ' || v_request_name
      else 'Solicitação de nova certificação — ' || v_request_name
    end;
    v_module := 'Cadastros Master';
  else
    if p_request_type is not null then
      raise exception 'SUPPORT_REQUEST_TYPE_REQUIRES_MASTER_DATA_CATEGORY';
    end if;
    v_subject := btrim(coalesce(p_subject, ''));
    v_module := p_module;
  end if;

  if v_subject = '' or btrim(coalesce(p_content, '')) = '' then
    raise exception 'SUPPORT_SUBJECT_AND_CONTENT_REQUIRED';
  end if;

  if p_affected_entity_type = 'quotation_request' then
    if not exists (
      select 1 from public.quotation_requests
      where id = p_affected_entity_id and organization_id = v_org_id
    ) then
      raise exception 'SUPPORT_AFFECTED_ENTITY_NOT_OWNED';
    end if;
  elsif p_affected_entity_type = 'supplier_quotation' then
    if not exists (
      select 1
      from public.supplier_quotations sq
      join public.suppliers s on sq.supplier_id = s.id
      where sq.id = p_affected_entity_id and s.organization_id = v_org_id
    ) then
      raise exception 'SUPPORT_AFFECTED_ENTITY_NOT_OWNED';
    end if;
  end if;

  select coalesce(trim(concat_ws(' ', o.nome, o.sobrenome)), 'Usuario')
    into v_user_name
  from public.operators o
  where o.id = auth.uid()
  limit 1;
  v_user_name := coalesce(v_user_name, 'Usuario');

  insert into public.support_tickets (
    organization_id, created_by, created_by_name_snapshot, subject, category,
    module, priority, affected_entity_type, affected_entity_id,
    request_type, request_payload
  ) values (
    v_org_id, auth.uid(), v_user_name, v_subject, p_category,
    v_module, p_priority, p_affected_entity_type, p_affected_entity_id,
    p_request_type, coalesce(p_request_payload, '{}'::jsonb)
  ) returning id into v_ticket_id;

  insert into public.support_messages (
    ticket_id, sender_user_id, sender_name_snapshot,
    sender_organization_id, sender_type, content
  ) values (
    v_ticket_id, auth.uid(), v_user_name, v_org_id, 'tenant', p_content
  );

  return v_ticket_id;
end;
$$;

-- Least privilege for touched catalog tables and the SECURITY DEFINER RPC.
revoke all on public.categories from anon;
revoke all on public.segments from anon;
revoke all on public.certifications from anon;
revoke all on public.materials from anon;
revoke all on public.manufacturers from anon;
revoke all on public.organization_materials from anon;

grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.segments to authenticated;
grant select, insert, update, delete on public.certifications to authenticated;
grant select, insert, update, delete on public.materials to authenticated;
grant select, insert, update on public.manufacturers to authenticated;
grant select, insert, update, delete on public.organization_materials to authenticated;

revoke all on function public.support_create_ticket(
  text, text, text, text, text, text, uuid, text, jsonb
) from public, anon;
grant execute on function public.support_create_ticket(
  text, text, text, text, text, text, uuid, text, jsonb
) to authenticated, service_role;

commit;
