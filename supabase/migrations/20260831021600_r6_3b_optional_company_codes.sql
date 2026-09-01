-- R6.3B - optional organization-scoped product codes.
--
-- This migration changes validation and write semantics only. Existing values
-- are never rewritten, columns and indexes remain unchanged, and tenant
-- isolation continues to be derived from the authenticated identity.

begin;

create or replace function public.validate_organization_material_link()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old_is_compliant boolean := false;
  v_new_is_compliant boolean;
begin
  new.internal_sku := nullif(pg_catalog.btrim(new.internal_sku), '');
  new.erp_code := nullif(pg_catalog.btrim(new.erp_code), '');

  v_new_is_compliant :=
    nullif(pg_catalog.btrim(new.display_name), '') is not null
    and new.category_id is not null
    and (new.available_for_purchase or new.available_for_sale);

  if tg_op = 'UPDATE' then
    v_old_is_compliant :=
      nullif(pg_catalog.btrim(old.display_name), '') is not null
      and old.category_id is not null
      and (old.available_for_purchase or old.available_for_sale);
  end if;

  if tg_op = 'INSERT' and not v_new_is_compliant then
    raise exception 'Novo vínculo de material exige nome, categoria e disponibilidade.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and v_old_is_compliant and not v_new_is_compliant then
    raise exception 'Vínculo de material saneado não pode voltar a um estado incompleto.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_organization_material_link()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_organization_material_link_guard on public.organization_materials;
create trigger trg_organization_material_link_guard
before insert or update on public.organization_materials
for each row execute function public.validate_organization_material_link();

-- Replace the previous 19-argument contract with a backward-compatible
-- contract whose trailing arguments are optional. Presence flags distinguish
-- an omitted code (preserve on update) from an intentional NULL (clear).
drop function if exists public.save_organization_material_product(
  uuid, uuid, uuid, text, text, text, text, text, boolean, boolean,
  text, jsonb, text, text, text, boolean, jsonb, jsonb, text
);

create or replace function public.save_organization_material_product(
  p_product_id uuid,
  p_material_id uuid,
  p_category_id uuid,
  p_name text,
  p_description text,
  p_unit text,
  p_sku text,
  p_manufacturer_code text,
  p_available_for_purchase boolean,
  p_available_for_sale boolean,
  p_image_url text,
  p_metadata jsonb,
  p_internal_sku text default null,
  p_erp_code text default null,
  p_display_name text default null,
  p_is_active boolean default true,
  p_commercial_config jsonb default '{}'::jsonb,
  p_logistics_config jsonb default '{}'::jsonb,
  p_relationship_type text default null,
  p_internal_sku_provided boolean default false,
  p_erp_code_provided boolean default false
) returns table (
  product_id uuid,
  organization_material_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid := public.current_authenticated_organization_id();
  v_product_id uuid;
  v_organization_material_id uuid;
  v_status text := coalesce(p_metadata->>'status', 'Active');
  v_internal_sku_provided boolean := p_internal_sku_provided or p_internal_sku is not null;
  v_erp_code_provided boolean := p_erp_code_provided or p_erp_code is not null;
begin
  if v_user_id is null or v_organization_id is null then
    raise exception 'Identidade autenticada sem organização ativa.' using errcode = '42501';
  end if;

  if not (
    public.has_role(v_user_id, v_organization_id, 'admin'::public.app_role)
    or public.has_role(v_user_id, v_organization_id, 'buyer'::public.app_role)
  ) then
    raise exception 'Usuário sem permissão para salvar materiais da organização.'
      using errcode = '42501';
  end if;

  if p_product_id is null then
    raise exception 'PRODUCT_ID_REQUIRED' using errcode = '22023';
  end if;
  if nullif(pg_catalog.btrim(p_name), '') is null then
    raise exception 'PRODUCT_NAME_REQUIRED' using errcode = '22023';
  end if;
  if nullif(pg_catalog.btrim(p_unit), '') is null then
    raise exception 'PRODUCT_UNIT_REQUIRED' using errcode = '22023';
  end if;
  if p_category_id is not null and not exists (
    select 1
    from public.categories category
    where category.id = p_category_id
      and category.is_active = true
  ) then
    raise exception 'ACTIVE_CATEGORY_REQUIRED' using errcode = '23503';
  end if;

  if p_material_id is null and v_status <> 'Draft' then
    raise exception 'MATERIAL_MASTER_REQUIRED_FOR_ACTIVE_PRODUCT' using errcode = '23514';
  end if;

  if p_material_id is not null then
    if not exists (
      select 1
      from public.materials material
      where material.id = p_material_id
        and material.is_active = true
        and material.validation_status in (
          'pending_review'::public.material_validation_status,
          'needs_correction'::public.material_validation_status,
          'validated'::public.material_validation_status
        )
        and material.merged_into_material_id is null
    ) then
      raise exception 'MATERIAL_MASTER_NOT_AVAILABLE' using errcode = '23503';
    end if;

    if p_category_id is null
       or nullif(pg_catalog.btrim(p_display_name), '') is null
       or not (coalesce(p_available_for_purchase, false) or coalesce(p_available_for_sale, false)) then
      raise exception 'ORGANIZATION_MATERIAL_REQUIRED_FIELDS_MISSING' using errcode = '23514';
    end if;

    if p_relationship_type is null
       or p_relationship_type not in ('fabricante', 'distribuidor', 'revendedor', 'fornecedor', 'comprador') then
      raise exception 'ORGANIZATION_MATERIAL_RELATIONSHIP_INVALID' using errcode = '23514';
    end if;
  end if;

  insert into public.products as target_product (
    id, organization_id, category_id, material_id, sku, name, description,
    unit, manufacturer_code, available_for_purchase, available_for_sale,
    image_url, metadata
  ) values (
    p_product_id,
    v_organization_id,
    p_category_id,
    p_material_id,
    nullif(pg_catalog.btrim(p_sku), ''),
    pg_catalog.btrim(p_name),
    nullif(pg_catalog.btrim(p_description), ''),
    pg_catalog.btrim(p_unit),
    nullif(pg_catalog.btrim(p_manufacturer_code), ''),
    coalesce(p_available_for_purchase, false),
    coalesce(p_available_for_sale, false),
    nullif(pg_catalog.btrim(p_image_url), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (id) do update set
    category_id = excluded.category_id,
    material_id = excluded.material_id,
    sku = excluded.sku,
    name = excluded.name,
    description = excluded.description,
    unit = excluded.unit,
    manufacturer_code = excluded.manufacturer_code,
    available_for_purchase = excluded.available_for_purchase,
    available_for_sale = excluded.available_for_sale,
    image_url = excluded.image_url,
    metadata = excluded.metadata,
    updated_at = now()
  where target_product.organization_id = v_organization_id
  returning target_product.id into v_product_id;

  if v_product_id is null then
    raise exception 'PRODUCT_NOT_OWNED_BY_CURRENT_ORGANIZATION' using errcode = '42501';
  end if;

  if p_material_id is not null then
    insert into public.organization_materials as target_organization_material (
      organization_id, material_id, category_id, internal_sku, erp_code,
      display_name, is_active, available_for_purchase, available_for_sale,
      commercial_config, logistics_config, relationship_type
    ) values (
      v_organization_id,
      p_material_id,
      p_category_id,
      case when v_internal_sku_provided then nullif(pg_catalog.btrim(p_internal_sku), '') else null end,
      case when v_erp_code_provided then nullif(pg_catalog.btrim(p_erp_code), '') else null end,
      pg_catalog.btrim(p_display_name),
      coalesce(p_is_active, true),
      coalesce(p_available_for_purchase, false),
      coalesce(p_available_for_sale, false),
      coalesce(p_commercial_config, '{}'::jsonb),
      coalesce(p_logistics_config, '{}'::jsonb),
      p_relationship_type
    )
    on conflict (organization_id, material_id) do update set
      category_id = excluded.category_id,
      internal_sku = case
        when v_internal_sku_provided then excluded.internal_sku
        else target_organization_material.internal_sku
      end,
      erp_code = case
        when v_erp_code_provided then excluded.erp_code
        else target_organization_material.erp_code
      end,
      display_name = excluded.display_name,
      is_active = excluded.is_active,
      available_for_purchase = excluded.available_for_purchase,
      available_for_sale = excluded.available_for_sale,
      commercial_config = excluded.commercial_config,
      logistics_config = excluded.logistics_config,
      relationship_type = excluded.relationship_type
    returning target_organization_material.id into v_organization_material_id;
  end if;

  return query
  select v_product_id, v_organization_material_id;
end;
$$;

comment on function public.save_organization_material_product(
  uuid, uuid, uuid, text, text, text, text, text, boolean, boolean,
  text, jsonb, text, text, text, boolean, jsonb, jsonb, text, boolean, boolean
) is 'Atomically saves tenant product and organization-material data while preserving omitted organization codes.';

revoke all on function public.save_organization_material_product(
  uuid, uuid, uuid, text, text, text, text, text, boolean, boolean,
  text, jsonb, text, text, text, boolean, jsonb, jsonb, text, boolean, boolean
) from public, anon, authenticated, service_role;

grant execute on function public.save_organization_material_product(
  uuid, uuid, uuid, text, text, text, text, text, boolean, boolean,
  text, jsonb, text, text, text, boolean, jsonb, jsonb, text, boolean, boolean
) to authenticated;

-- Keep newly-created quotation snapshots canonical. The function itself is
-- preserved byte-for-byte except for removing the legacy products.sku fallback.
-- Abort on unexpected drift instead of silently overwriting remote behavior.
do $migration$
declare
  v_signature regprocedure := to_regprocedure(
    'public.create_procurement_quotation(text,date,text,text,jsonb,uuid)'
  );
  v_definition text;
  v_old_fragment constant text := 'coalesce(om.internal_sku, product.sku)';
  v_new_fragment constant text := 'om.internal_sku';
begin
  if v_signature is null then
    raise exception 'R6.3B precheck failed: create_procurement_quotation signature is missing.';
  end if;

  select pg_get_functiondef(v_signature) into v_definition;

  if pg_catalog.strpos(v_definition, v_old_fragment) = 0 then
    raise exception 'R6.3B precheck failed: quotation internal SKU snapshot definition drifted.';
  end if;

  execute pg_catalog.replace(v_definition, v_old_fragment, v_new_fragment);
end;
$migration$;

-- The R7 context may fall back from an absent historical snapshot to the
-- current organization link, but never to the deprecated products.sku copy.
do $migration$
declare
  v_signature regprocedure := to_regprocedure(
    'public.get_quotation_ai_context(uuid)'
  );
  v_definition text;
  v_old_fragment constant text := E'coalesce(\n            qi.internal_sku_snapshot,\n            organization_material.internal_sku,\n            product.sku\n          )';
  v_new_fragment constant text := E'coalesce(\n            qi.internal_sku_snapshot,\n            organization_material.internal_sku\n          )';
begin
  if v_signature is null then
    raise exception 'R6.3B precheck failed: get_quotation_ai_context signature is missing.';
  end if;

  select pg_get_functiondef(v_signature) into v_definition;

  if pg_catalog.strpos(v_definition, v_old_fragment) = 0 then
    raise exception 'R6.3B precheck failed: quotation AI internal SKU definition drifted.';
  end if;

  execute pg_catalog.replace(v_definition, v_old_fragment, v_new_fragment);
end;
$migration$;

commit;
