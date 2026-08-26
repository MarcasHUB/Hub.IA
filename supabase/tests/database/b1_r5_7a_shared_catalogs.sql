-- B1-R.5.7A transactional acceptance test.
-- Run after the migration as postgres. Every synthetic row is rolled back.

begin;

create temporary table b1_r57a_actors (
  actor text primary key,
  user_id uuid not null,
  organization_id uuid
) on commit drop;

insert into b1_r57a_actors(actor, user_id, organization_id)
select 'admin', pa.user_id, ur.organization_id
from public.platform_admins pa
left join public.user_roles ur on ur.user_id = pa.user_id
where pa.status = 'active'
limit 1;

insert into b1_r57a_actors(actor, user_id, organization_id)
select 'tenant_' || row_number() over ()::text, user_id, organization_id
from (
  select distinct on (organization_id) user_id, organization_id
  from public.user_roles
  where role::text in ('admin', 'buyer')
    and organization_id <> (select organization_id from b1_r57a_actors where actor = 'admin')
  order by organization_id, role::text
  limit 3
) tenants;

grant select on b1_r57a_actors to authenticated;

do $$
begin
  if (select count(*) from b1_r57a_actors where actor like 'tenant_%') < 3 then
    raise exception 'B1_R57A_REQUIRES_THREE_CONTROLLED_TENANTS';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from b1_r57a_actors where actor = 'admin'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.categories (id, organization_id, name, description, is_active)
values ('11111111-1111-4111-8111-111111111111', null, 'TESTE B1-R57A CATEGORIA', 'Teste transacional', true);

insert into public.segments (id, organization_id, nome, descricao, status, responsavel_id)
values ('22222222-2222-4222-8222-222222222222', null, 'TESTE B1-R57A SEGMENTO', 'Teste transacional', 'ativo', null);

insert into public.certifications (id, name, description, is_active)
values ('33333333-3333-4333-8333-333333333333', 'TESTE B1-R57A CERTIFICACAO', 'Teste transacional', true);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from b1_r57a_actors where actor = 'tenant_1'), true);

do $$
declare
  v_category_description text;
  v_segment_description text;
begin
  if not exists (select 1 from public.categories where id = '11111111-1111-4111-8111-111111111111') then raise exception 'CATEGORY_CROSS_TENANT_READ_FAILED'; end if;
  if not exists (select 1 from public.segments where id = '22222222-2222-4222-8222-222222222222') then raise exception 'SEGMENT_CROSS_TENANT_READ_FAILED'; end if;
  if not exists (select 1 from public.certifications where id = '33333333-3333-4333-8333-333333333333') then raise exception 'CERTIFICATION_GLOBAL_READ_FAILED'; end if;
  select description into v_category_description from public.categories where id = '11111111-1111-4111-8111-111111111111';
  update public.categories set description = 'TENANT MUST NOT UPDATE' where id = '11111111-1111-4111-8111-111111111111';
  if (select description from public.categories where id = '11111111-1111-4111-8111-111111111111') is distinct from v_category_description then raise exception 'CATEGORY_CROSS_TENANT_WRITE_ALLOWED'; end if;
  select descricao into v_segment_description from public.segments where id = '22222222-2222-4222-8222-222222222222';
  update public.segments set descricao = 'TENANT MUST NOT UPDATE' where id = '22222222-2222-4222-8222-222222222222';
  if (select descricao from public.segments where id = '22222222-2222-4222-8222-222222222222') is distinct from v_segment_description then raise exception 'SEGMENT_CROSS_TENANT_WRITE_ALLOWED'; end if;
end;
$$;

do $$
begin
  begin
    insert into public.certifications(name) values ('TENANT MUST NOT INSERT');
    raise exception 'CERTIFICATION_TENANT_WRITE_UNEXPECTEDLY_ALLOWED';
  exception when insufficient_privilege then null;
  end;
  update public.certifications set description = 'TENANT MUST NOT UPDATE' where id = '33333333-3333-4333-8333-333333333333';
  if (select description from public.certifications where id = '33333333-3333-4333-8333-333333333333') <> 'Teste transacional' then raise exception 'CERTIFICATION_TENANT_UPDATE_ALLOWED'; end if;
end;
$$;

insert into public.manufacturers (id, name, normalized_name, created_by, is_active)
values (
  '55555555-5555-4555-8555-555555555555', 'TESTE B1-R57A FABRICANTE',
  public.normalize_text_key('TESTE B1-R57A FABRICANTE'),
  (select user_id from b1_r57a_actors where actor = 'tenant_1'), true
);

insert into public.materials (
  id, official_name, normalized_official_name, unit, manufacturer_id, manufacturer_code,
  validation_status, visibility, master_owner_organization_id, created_by, is_active
)
values (
  '44444444-4444-4444-8444-444444444444', 'TESTE B1-R57A MATERIAL',
  'teste b1-r57a material', 'UN', '55555555-5555-4555-8555-555555555555', 'B1R57A-001',
  'pending_review', 'shared',
  (select organization_id from b1_r57a_actors where actor = 'tenant_1'),
  (select user_id from b1_r57a_actors where actor = 'tenant_1'), true
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from b1_r57a_actors where actor = 'tenant_2'), true);

do $$
declare
  v_before text;
begin
  if not exists (select 1 from public.materials where id = '44444444-4444-4444-8444-444444444444') then raise exception 'MATERIAL_CROSS_TENANT_READ_FAILED'; end if;
  if not exists (select 1 from public.manufacturers where id = '55555555-5555-4555-8555-555555555555') then raise exception 'MANUFACTURER_GLOBAL_READ_FAILED'; end if;
  begin
    insert into public.manufacturers(name, normalized_name, created_by)
    values (' teste b1-r57a fabricante ', public.normalize_text_key(' teste b1-r57a fabricante '), (select user_id from b1_r57a_actors where actor = 'tenant_2'));
    raise exception 'MANUFACTURER_DUPLICATION_UNEXPECTEDLY_ALLOWED';
  exception when unique_violation then null;
  end;
  select official_name into v_before from public.materials where id = '44444444-4444-4444-8444-444444444444';
  update public.materials set official_name = 'CROSS TENANT UPDATE MUST FAIL' where id = '44444444-4444-4444-8444-444444444444';
  if (select official_name from public.materials where id = '44444444-4444-4444-8444-444444444444') is distinct from v_before then raise exception 'MATERIAL_CROSS_TENANT_WRITE_ALLOWED'; end if;
end;
$$;

insert into public.organization_materials (
  organization_id, material_id, category_id,
  available_for_purchase, available_for_sale, relationship_type
)
values (
  (select organization_id from b1_r57a_actors where actor = 'tenant_2'),
  '44444444-4444-4444-8444-444444444444',
  '11111111-1111-4111-8111-111111111111', true, false, 'comprador'
);

do $$
declare
  v_ticket_id uuid;
begin
  if (select count(*) from public.materials where normalized_official_name = 'teste b1-r57a material') <> 1 then raise exception 'MATERIAL_DUPLICATION_FAILED'; end if;
  if not exists (
    select 1 from public.organization_materials
    where organization_id = (select organization_id from b1_r57a_actors where actor = 'tenant_2')
      and material_id = '44444444-4444-4444-8444-444444444444'
  ) then raise exception 'MATERIAL_LINK_FAILED'; end if;

  select public.support_create_ticket(
    'ignored by master-data request', 'master_data_request', 'Cadastros Master',
    'normal', 'Justificativa de teste transacional', null, null, 'category',
    jsonb_build_object('name', 'TESTE B1-R57A SOLICITACAO', 'description', 'Teste', 'reason', 'Teste transacional')
  ) into v_ticket_id;
  if not exists (
    select 1 from public.support_tickets
    where id = v_ticket_id and request_type = 'category'
      and request_payload->>'name' = 'TESTE B1-R57A SOLICITACAO'
  ) then raise exception 'SUPPORT_CATEGORY_REQUEST_FAILED'; end if;
  if exists (select 1 from public.categories where normalized_name = public.normalize_text_key('TESTE B1-R57A SOLICITACAO')) then raise exception 'SUPPORT_REQUEST_CREATED_MASTER_DATA_AUTOMATICALLY'; end if;

  begin
    perform public.support_create_ticket(
      'invalid material request', 'master_data_request', 'Cadastros Master',
      'normal', 'Teste', null, null, 'material',
      jsonb_build_object('name', 'MATERIAL PROIBIDO', 'reason', 'Teste')
    );
    raise exception 'SUPPORT_MATERIAL_REQUEST_UNEXPECTEDLY_ALLOWED';
  exception when others then
    if sqlerrm not like '%SUPPORT_MASTER_DATA_REQUEST_TYPE_INVALID%' then raise; end if;
  end;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from b1_r57a_actors where actor = 'tenant_3'), true);
delete from public.materials where id = '44444444-4444-4444-8444-444444444444';
do $$ begin if not exists (select 1 from public.materials where id = '44444444-4444-4444-8444-444444444444') then raise exception 'MATERIAL_CROSS_TENANT_DELETE_ALLOWED'; end if; end $$;

rollback;
