-- App Campo: requester searches the global material master, independent of tenant linkage.
create or replace function public.get_requestable_materials()
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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'material_id',m.id,
        'name',m.official_name,
        'description',m.description,
        'unit',coalesce(nullif(m.unit,''),'UN'),
        'internal_sku',om.internal_sku,
        'erp_code',om.erp_code,
        'category_id',m.category_id,
        'linked_to_company',(om.id is not null)
      )
      order by m.official_name
    ),
    '[]'::jsonb
  )
  into v_result
  from public.materials m
  left join public.organization_materials om
    on om.material_id=m.id
   and om.organization_id=v_identity.organization_id
   and coalesce(om.is_active,true)
  where coalesce(m.is_active,true)
    and m.merged_into_material_id is null
    and m.validation_status::text not in ('rejected','merged');

  return v_result;
end;
$$;

revoke all on function public.get_requestable_materials() from public, anon;
grant execute on function public.get_requestable_materials() to authenticated, service_role;
