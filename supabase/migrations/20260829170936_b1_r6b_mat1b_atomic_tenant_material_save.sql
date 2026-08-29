-- B1-R.6B-MAT1B - atomic tenant material save.
--
-- The tenant form owns products and organization_materials only. Shared master
-- data in materials is validated read-only and is never changed by this RPC.

begin;

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
  p_internal_sku text,
  p_erp_code text,
  p_display_name text,
  p_is_active boolean,
  p_commercial_config jsonb,
  p_logistics_config jsonb,
  p_relationship_type text
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
       or nullif(pg_catalog.btrim(p_internal_sku), '') is null
       or nullif(pg_catalog.btrim(p_erp_code), '') is null
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
    id,
    organization_id,
    category_id,
    material_id,
    sku,
    name,
    description,
    unit,
    manufacturer_code,
    available_for_purchase,
    available_for_sale,
    image_url,
    metadata
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
      organization_id,
      material_id,
      category_id,
      internal_sku,
      erp_code,
      display_name,
      is_active,
      available_for_purchase,
      available_for_sale,
      commercial_config,
      logistics_config,
      relationship_type
    ) values (
      v_organization_id,
      p_material_id,
      p_category_id,
      pg_catalog.btrim(p_internal_sku),
      pg_catalog.btrim(p_erp_code),
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
      internal_sku = excluded.internal_sku,
      erp_code = excluded.erp_code,
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
  text, jsonb, text, text, text, boolean, jsonb, jsonb, text
) is 'Atomically saves tenant product and organization-material data without mutating the shared material master.';

revoke all on function public.save_organization_material_product(
  uuid, uuid, uuid, text, text, text, text, text, boolean, boolean,
  text, jsonb, text, text, text, boolean, jsonb, jsonb, text
) from public, anon, authenticated, service_role;

grant execute on function public.save_organization_material_product(
  uuid, uuid, uuid, text, text, text, text, text, boolean, boolean,
  text, jsonb, text, text, text, boolean, jsonb, jsonb, text
) to authenticated;

commit;
