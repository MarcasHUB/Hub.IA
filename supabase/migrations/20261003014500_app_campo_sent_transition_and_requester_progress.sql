
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
  v_number integer;
  v_year integer := extract(year from (now() at time zone 'America/Sao_Paulo'))::integer;
  v_code text;
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

  if found then
    update public.quotation_requests
      set status='sent'::public.quotation_status,
          updated_at=now()
    where id=v_quotation_id and status='draft'::public.quotation_status;

    update public.internal_requests
      set status='em_cotacao',updated_at=now()
    where id=p_request_id and organization_id=v_identity.organization_id;

    return v_quotation_id;
  end if;

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

  insert into public.quotation_number_counters(organization_id,year,last_number)
  values(v_identity.organization_id,v_year,1)
  on conflict on constraint quotation_number_counters_pkey
  do update set last_number=public.quotation_number_counters.last_number+1,updated_at=now()
  returning last_number into v_number;

  v_code := 'RC-CAMPO-'||v_year::text||'-'||lpad(v_number::text,6,'0');

  insert into public.quotation_requests(
    organization_id,created_by,title,status,due_date,notes,priority_level,request_type,
    requester_user_id,requester_name_snapshot,source_internal_request_id
  ) values(
    v_identity.organization_id,v_identity.user_id,v_code,
    'sent'::public.quotation_status,v_request.expected_date,v_request.notes,
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
    'created_with_quotation',now(),1
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

create or replace function public.get_my_app_campo_quotation_progress()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_identity record;
  v_result jsonb;
begin
  select * into v_identity from private.current_identity();
  if not found then raise exception 'AUTH_INVALID'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'request_id', ir.id,
    'quotation_id', qr.id,
    'quotation_title', qr.title,
    'quotation_status', qr.status::text,
    'request_type', qr.request_type,
    'destination_label',
      case
        when qr.id is null then null
        when qr.request_type='BID' and not exists(
          select 1 from public.supplier_quotations sq where sq.request_id=qr.id
        ) then 'Aberta à rede de fornecedores'
        when qr.request_type='DIRECT' and qr.target_organization_id is not null then
          coalesce((select coalesce(o.nome_fantasia,o.razao_social,o.name) from public.organizations o where o.id=qr.target_organization_id),'Fornecedor direcionado')
        else null
      end,
    'destinations', coalesce((
      select jsonb_agg(distinct coalesce(o.nome_fantasia,o.razao_social,o.name))
      from public.supplier_quotations sq
      left join public.organizations o on o.id=sq.supplier_organization_id
      where sq.request_id=qr.id
    ),'[]'::jsonb)
  ) order by ir.created_at desc),'[]'::jsonb)
  into v_result
  from public.internal_requests ir
  left join public.quotation_requests qr on qr.source_internal_request_id=ir.id
  where ir.requester_id=v_identity.user_id
    and ir.organization_id=v_identity.organization_id;

  return v_result;
end;
$$;

revoke all on function public.get_my_app_campo_quotation_progress() from public, anon;
grant execute on function public.get_my_app_campo_quotation_progress() to authenticated, service_role;

do $$
declare
  r record;
  v_number integer;
  v_year integer;
  v_code text;
begin
  for r in
    select qr.id,qr.organization_id,qr.created_at
    from public.quotation_requests qr
    where qr.source_internal_request_id is not null
      and (qr.title not like 'RC-CAMPO-%' or qr.status='draft'::public.quotation_status)
    order by qr.created_at
  loop
    v_year := extract(year from (r.created_at at time zone 'America/Sao_Paulo'))::integer;
    insert into public.quotation_number_counters(organization_id,year,last_number)
    values(r.organization_id,v_year,1)
    on conflict on constraint quotation_number_counters_pkey
    do update set last_number=public.quotation_number_counters.last_number+1,updated_at=now()
    returning last_number into v_number;

    v_code := 'RC-CAMPO-'||v_year::text||'-'||lpad(v_number::text,6,'0');
    update public.quotation_requests
    set title=v_code,status='sent'::public.quotation_status,updated_at=now()
    where id=r.id;
  end loop;
end $$;
