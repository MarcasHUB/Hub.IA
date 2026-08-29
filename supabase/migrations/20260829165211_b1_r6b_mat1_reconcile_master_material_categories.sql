-- B1-R.6B-MAT1 - reconcile the canonical category of master materials.
--
-- Source of truth for this one-time backfill:
--   * organization_materials.category_id
--   * products.category_id
--
-- A material is eligible only when all non-null historical evidence resolves to
-- exactly one existing category UUID. No category is inferred from names and no
-- category row is created. Conflicts or missing evidence abort the migration and
-- leave materials.category_id unchanged for human review.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Keep the precheck and update on one stable set of evidence. materials is the
-- update target, while the two evidence tables only need concurrent DML blocked
-- until the backfill commits. Reads remain available throughout the migration.
lock table public.materials in share row exclusive mode;
lock table public.organization_materials, public.products in share mode;

create temporary table b1_r6b_mat1_category_reconciliation
on commit drop
as
with null_materials as (
  select m.id as material_id
  from public.materials m
  where m.category_id is null
),
category_evidence as (
  select om.material_id, om.category_id
  from public.organization_materials om
  join null_materials nm on nm.material_id = om.material_id
  where om.category_id is not null

  union all

  select p.material_id, p.category_id
  from public.products p
  join null_materials nm on nm.material_id = p.material_id
  where p.category_id is not null
),
grouped_evidence as (
  select
    nm.material_id,
    coalesce(
      array_agg(distinct ce.category_id order by ce.category_id)
        filter (where ce.category_id is not null),
      '{}'::uuid[]
    ) as category_ids
  from null_materials nm
  left join category_evidence ce on ce.material_id = nm.material_id
  group by nm.material_id
)
select
  ge.material_id,
  case cardinality(ge.category_ids)
    when 0 then 'NO_CATEGORY_EVIDENCE'
    when 1 then 'SAFE_SINGLE_CATEGORY'
    else 'CATEGORY_CONFLICT'
  end as classification,
  case
    when cardinality(ge.category_ids) = 1 then ge.category_ids[1]
    else null
  end as canonical_category_id,
  ge.category_ids
from grouped_evidence ge;

do $$
declare
  v_master_materials bigint;
  v_master_category_null bigint;
  v_safe_single_category bigint;
  v_category_conflict bigint;
  v_no_category_evidence bigint;
begin
  select count(*)
  into v_master_materials
  from public.materials;

  select
    count(*),
    count(*) filter (where classification = 'SAFE_SINGLE_CATEGORY'),
    count(*) filter (where classification = 'CATEGORY_CONFLICT'),
    count(*) filter (where classification = 'NO_CATEGORY_EVIDENCE')
  into
    v_master_category_null,
    v_safe_single_category,
    v_category_conflict,
    v_no_category_evidence
  from pg_temp.b1_r6b_mat1_category_reconciliation;

  -- Business invariant: every NULL master category must have exactly one
  -- consistent, non-null historical category. Total tenant-link counts are
  -- deliberately informational and never gate this migration.
  if v_category_conflict <> 0
     or v_no_category_evidence <> 0 then
    raise exception 'B1-R.6B-MAT1 precheck diverged; no category was changed.'
      using detail = format(
        'MASTER_MATERIALS=%s, MASTER_CATEGORY_NULL=%s, SAFE_SINGLE_CATEGORY=%s, CATEGORY_CONFLICT=%s, NO_CATEGORY_EVIDENCE=%s',
        v_master_materials,
        v_master_category_null,
        v_safe_single_category,
        v_category_conflict,
        v_no_category_evidence
      ),
      hint = 'Review conflicts or missing evidence manually before preparing a new reconciliation migration.';
  end if;

  if v_safe_single_category <> v_master_category_null then
    raise exception 'B1-R.6B-MAT1 invariant failed; no category was changed.'
      using detail = format(
        'MASTER_CATEGORY_NULL=%s, SAFE_SINGLE_CATEGORY=%s',
        v_master_category_null,
        v_safe_single_category
      ),
      hint = 'Every NULL master category must resolve to exactly one historical category UUID.';
  end if;
end;
$$;

do $$
declare
  v_backfill_rows bigint;
  v_expected_backfill_rows bigint;
begin
  select count(*)
  into v_expected_backfill_rows
  from pg_temp.b1_r6b_mat1_category_reconciliation
  where classification = 'SAFE_SINGLE_CATEGORY';

  update public.materials m
  set category_id = reconciliation.canonical_category_id
  from pg_temp.b1_r6b_mat1_category_reconciliation reconciliation
  where reconciliation.material_id = m.id
    and reconciliation.classification = 'SAFE_SINGLE_CATEGORY'
    and reconciliation.canonical_category_id is not null
    and m.category_id is null;

  get diagnostics v_backfill_rows = row_count;

  if v_backfill_rows <> v_expected_backfill_rows then
    raise exception 'B1-R.6B-MAT1 backfill count diverged; transaction will roll back.'
      using detail = format(
        'BACKFILL_ROWS=%s, EXPECTED_FROM_SAFE_EVIDENCE=%s',
        v_backfill_rows,
        v_expected_backfill_rows
      );
  end if;
end;
$$;

do $$
declare
  v_remaining_null bigint;
  v_impact_category_id uuid;
begin
  select count(*)
  into v_remaining_null
  from public.materials
  where category_id is null;

  if v_remaining_null <> 0 then
    raise exception 'B1-R.6B-MAT1 postcheck failed; transaction will roll back.'
      using detail = format('MASTER_CATEGORY_NULL_AFTER=%s, EXPECTED=0', v_remaining_null);
  end if;

  -- UUID assertion only; the historical category label is not used as inference.
  select m.category_id
  into v_impact_category_id
  from public.materials m
  where m.id = '86517af0-7f97-4aa5-8093-361c0778d1c4'::uuid;

  if v_impact_category_id is distinct from '7d97feb3-1674-4a02-a0cd-8e6193cbe883'::uuid then
    raise exception 'B1-R.6B-MAT1 impact-material postcheck failed; transaction will roll back.'
      using detail = format(
        'MATERIAL_ID=86517af0-7f97-4aa5-8093-361c0778d1c4, CATEGORY_ID=%s',
        coalesce(v_impact_category_id::text, 'NULL')
      );
  end if;
end;
$$;

commit;
