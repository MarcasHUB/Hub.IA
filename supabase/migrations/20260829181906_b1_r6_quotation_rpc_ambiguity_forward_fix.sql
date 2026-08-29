-- B1-R.6B: forward fix for PL/pgSQL output-column ambiguity.
-- The function body is identical to the applied R.6 definition except for the
-- constraint-targeted upsert on quotation_number_counters.

create or replace function public.create_procurement_quotation(
  p_type text,
  p_due_date date,
  p_priority_level text,
  p_notes text,
  p_items jsonb,
  p_target_organization_id uuid default null
) returns table (
  id uuid,
  title text,
  status public.quotation_status,
  created_at timestamptz,
  organization_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_user uuid;
  v_request public.quotation_requests%rowtype;
  v_number integer;
  v_year integer := extract(year from (now() at time zone 'America/Sao_Paulo'))::integer;
  v_code text;
  v_name text;
  v_supplier_id uuid;
  v_partner public.organizations%rowtype;
begin
  select identity.user_id, identity.organization_id
  into v_user, v_org
  from private.current_identity() identity;

  if not (
    public.has_role(v_user, v_org, 'admin'::public.app_role)
    or public.has_role(v_user, v_org, 'buyer'::public.app_role)
  ) then
    raise exception 'Usuário sem permissão para criar cotações.' using errcode = '42501';
  end if;
  if p_type is null or p_type not in ('BID', 'DIRECT') then
    raise exception 'Tipo de cotação inválido.' using errcode = '22023';
  end if;
  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0 then
    raise exception 'Informe ao menos um material.' using errcode = '22023';
  end if;
  if (
    select count(*) <> count(distinct item->>'product_id')
    from jsonb_array_elements(p_items) item
  ) then
    raise exception 'Cada material deve aparecer uma única vez na cotação.' using errcode = '22023';
  end if;
  if p_type = 'DIRECT' then
    if p_target_organization_id is null then
      raise exception 'Fornecedor parceiro é obrigatório.' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.connection_requests cr
      join public.organizations partner
        on partner.id = case when cr.requester_company_id = v_org then cr.target_company_id else cr.requester_company_id end
      where cr.status = 'accepted'
        and v_org in (cr.requester_company_id, cr.target_company_id)
        and partner.id = p_target_organization_id
        and coalesce(partner.status, 'ativo') in ('ativo', 'active')
    ) then
      raise exception 'A organização informada não é um parceiro ativo e aceito.' using errcode = '42501';
    end if;
  elsif p_target_organization_id is not null then
    raise exception 'Cotação BID não aceita fornecedor direcionado.' using errcode = '22023';
  end if;

  select coalesce(p.full_name, p.email)
  into v_name
  from public.profiles p
  where p.user_id = v_user;
  if nullif(btrim(v_name), '') is null then
    raise exception 'A identidade autenticada não possui nome canônico.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    left join public.products product
      on product.id = (item->>'product_id')::uuid
     and product.organization_id = v_org
     and product.deleted_at is null
     and coalesce(product.available_for_purchase, true)
    left join public.organization_materials om
      on om.organization_id = v_org
     and om.material_id = product.material_id
     and om.is_active
     and om.available_for_purchase
    where product.id is null
       or om.id is null
       or coalesce((item->>'quantity')::numeric, 0) <= 0
  ) then
    raise exception 'Um ou mais materiais não estão disponíveis para compra pela organização.' using errcode = '42501';
  end if;

  insert into public.quotation_number_counters(organization_id, year, last_number)
  values (v_org, v_year, 1)
  on conflict on constraint quotation_number_counters_pkey
  do update set last_number = public.quotation_number_counters.last_number + 1, updated_at = now()
  returning last_number into v_number;
  v_code := (case when p_type = 'DIRECT' then 'RCD-' else 'RC-' end)
    || v_year::text || '-' || lpad(v_number::text, 6, '0');

  insert into public.quotation_requests(
    organization_id, created_by, requester_user_id, requester_name_snapshot,
    title, status, due_date, notes, priority_level, request_type, target_organization_id
  ) values (
    v_org, v_user, v_user, v_name,
    v_code, 'sent'::public.quotation_status, p_due_date, nullif(btrim(p_notes), ''),
    p_priority_level, p_type, p_target_organization_id
  ) returning * into v_request;

  insert into public.quotation_items(
    request_id, product_id, quantity, unit,
    product_name_snapshot, manufacturer_name_snapshot, manufacturer_code_snapshot,
    internal_sku_snapshot, description_snapshot, unit_snapshot,
    category_name_snapshot, material_id_snapshot, organization_material_id_snapshot,
    snapshot_source, snapshot_created_at, snapshot_version
  )
  select
    v_request.id,
    product.id,
    (item->>'quantity')::numeric,
    product.unit,
    coalesce(om.display_name, product.name),
    coalesce(manufacturer.name, product.metadata->>'manufacturer'),
    coalesce(material.manufacturer_code, product.manufacturer_code, product.metadata->>'manufacturer_code'),
    coalesce(om.internal_sku, product.sku),
    coalesce(material.description, product.description),
    coalesce(material.unit, product.unit),
    category.name,
    material.id,
    om.id,
    'created_with_quotation',
    now(),
    1
  from jsonb_array_elements(p_items) item
  join public.products product on product.id = (item->>'product_id')::uuid
  join public.organization_materials om
    on om.organization_id = v_org and om.material_id = product.material_id
  join public.materials material on material.id = product.material_id
  left join public.manufacturers manufacturer on manufacturer.id = material.manufacturer_id
  left join public.categories category on category.id = material.category_id;

  if p_type = 'DIRECT' then
    select * into v_partner from public.organizations where id = p_target_organization_id;

    insert into public.suppliers(
      organization_id, connected_organization_id, legal_name, trade_name, cnpj
    ) values (
      v_org, p_target_organization_id,
      coalesce(v_partner.razao_social, v_partner.name),
      coalesce(v_partner.nome_fantasia, v_partner.name),
      v_partner.cnpj
    )
    on conflict (organization_id, connected_organization_id)
      where connected_organization_id is not null
    do update set
      legal_name = excluded.legal_name,
      trade_name = excluded.trade_name,
      cnpj = excluded.cnpj,
      updated_at = now()
    returning id into v_supplier_id;

    insert into public.supplier_quotations(
      request_id, supplier_id, supplier_organization_id, status
    ) values (
      v_request.id, v_supplier_id, p_target_organization_id, 'pending'::public.supplier_quotation_status
    );

    perform public.emit_notification(
      profile.user_id,
      p_target_organization_id,
      'quotation_received',
      'Nova cotação direcionada',
      'A cotação ' || v_request.title || ' está disponível para resposta.',
      'quotation',
      v_request.id,
      '/quotations/' || v_request.id || '/respond',
      jsonb_build_object('request_id', v_request.id, 'request_type', p_type),
      'high',
      'quotation-received:' || v_request.id::text || ':' || profile.user_id::text
    )
    from public.profiles profile
    where profile.organization_id = p_target_organization_id
      and profile.status = 'active';
  end if;

  return query select v_request.id, v_request.title, v_request.status, v_request.created_at, v_request.organization_id;
end;
$$;

revoke all on function public.create_procurement_quotation(text, date, text, text, jsonb, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.create_procurement_quotation(text, date, text, text, jsonb, uuid)
  to authenticated;
