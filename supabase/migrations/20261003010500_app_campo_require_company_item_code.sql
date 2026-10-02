-- App Campo: quotation conversion requires the material to be linked to the company
-- with a non-empty internal item code.
create or replace function public.convert_internal_request_to_quotation(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_identity record;
  v_request public.internal_requests%rowtype;
  v_quotation_id uuid;
begin
  select * into v_identity from private.current_identity();
  if not found or not private.has_tenant_capability('quotations_write') then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_request
  from public.internal_requests
  where id=p_request_id and organization_id=v_identity.organization_id
  for update;

  if not found then raise exception 'APP_CAMPO_REQUEST_NOT_FOUND'; end if;

  select qr.id into v_quotation_id
  from public.quotation_requests qr
  where qr.source_internal_request_id=p_request_id;
  if found then return v_quotation_id; end if;

  if exists(select 1 from public.internal_request_items i where i.request_id=p_request_id and i.material_id is null) then
    raise exception 'APP_CAMPO_ITEM_REQUIRES_CLASSIFICATION';
  end if;

  if exists(
    select 1
    from public.internal_request_items i
    where i.request_id=p_request_id
      and not exists(
        select 1 from public.organization_materials om
        where om.organization_id=v_identity.organization_id
          and om.material_id=i.material_id
          and coalesce(om.is_active,true)
          and coalesce(om.available_for_purchase,true)
      )
  ) then
    raise exception 'APP_CAMPO_MATERIAL_NOT_PURCHASABLE';
  end if;

  if exists(
    select 1
    from public.internal_request_items i
    join public.organization_materials om
      on om.organization_id=v_identity.organization_id
     and om.material_id=i.material_id
    where i.request_id=p_request_id
      and nullif(btrim(om.internal_sku),'') is null
  ) then
    raise exception 'APP_CAMPO_COMPANY_ITEM_CODE_REQUIRED';
  end if;

  if exists(
    select 1
    from public.internal_request_items i
    where i.request_id=p_request_id
      and not exists(
        select 1 from public.products p
        where p.organization_id=v_identity.organization_id
          and p.material_id=i.material_id
          and p.deleted_at is null
          and coalesce(p.available_for_purchase,true)
      )
  ) then
    raise exception 'APP_CAMPO_MATERIAL_NOT_PURCHASABLE';
  end if;

  insert into public.quotation_requests(
    organization_id,created_by,title,status,due_date,notes,priority_level,request_type,
    requester_user_id,requester_name_snapshot,source_internal_request_id
  ) values(
    v_identity.organization_id,v_identity.user_id,
    'APP CAMPO - '||upper(substr(replace(p_request_id::text,'-',''),1,8)),
    'draft',v_request.expected_date,v_request.notes,
    case when v_request.priority::text='emergencial' then 'urgent' else 'normal' end,
    'BID',v_request.requester_id,v_request.requested_by_name,p_request_id
  ) returning id into v_quotation_id;

  insert into public.quotation_items(
    request_id,product_id,quantity,unit,product_name_snapshot,manufacturer_code_snapshot,
    internal_sku_snapshot,description_snapshot,unit_snapshot,material_id_snapshot,
    organization_material_id_snapshot,snapshot_source,snapshot_created_at,snapshot_version
  )
  select
    v_quotation_id,p.id,i.quantity,i.uom,
    coalesce(nullif(om.display_name,''),m.official_name),m.manufacturer_code,
    om.internal_sku,coalesce(i.item_notes,m.description),i.uom,m.id,om.id,
    'app_campo',now(),1
  from public.internal_request_items i
  join public.materials m on m.id=i.material_id
  join public.organization_materials om
    on om.organization_id=v_identity.organization_id
   and om.material_id=i.material_id
   and nullif(btrim(om.internal_sku),'') is not null
  join lateral (
    select p1.* from public.products p1
    where p1.organization_id=v_identity.organization_id
      and p1.material_id=i.material_id
      and p1.deleted_at is null
      and coalesce(p1.available_for_purchase,true)
    order by p1.created_at
    limit 1
  ) p on true
  where i.request_id=p_request_id;

  update public.internal_requests
  set status='em_cotacao',updated_at=now()
  where id=p_request_id and organization_id=v_identity.organization_id;

  return v_quotation_id;
end;
$$;

revoke all on function public.convert_internal_request_to_quotation(uuid) from public, anon;
grant execute on function public.convert_internal_request_to_quotation(uuid) to authenticated, service_role;
