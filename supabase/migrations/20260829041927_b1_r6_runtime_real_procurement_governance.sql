-- B1-R.6 - runtime real, procurement governance and canonical lifecycle.
-- This migration is additive. Existing commercial and audit history is preserved.

begin;

do $$
begin
  if to_regclass('public.materials') is null
     or to_regclass('public.organization_materials') is null
     or to_regclass('public.categories') is null
     or to_regclass('public.manufacturers') is null
     or to_regclass('public.products') is null
     or to_regclass('public.organizations') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.user_roles') is null
     or to_regclass('public.connection_requests') is null
     or to_regclass('public.quotation_requests') is null
     or to_regclass('public.quotation_items') is null
     or to_regclass('public.quotation_number_counters') is null
     or to_regclass('public.suppliers') is null
     or to_regclass('public.supplier_quotations') is null
     or to_regclass('public.supplier_quotation_items') is null
     or to_regclass('public.quotation_decisions') is null
     or to_regclass('public.compliance_events') is null
     or to_regclass('public.hubia_signals') is null
     or to_regclass('public.notifications') is null
     or to_regprocedure('private.current_identity()') is null
     or to_regprocedure('public.current_authenticated_organization_id()') is null
     or to_regprocedure('public.is_super_admin()') is null then
    raise exception 'B1-R.6 precheck failed: required baseline tables are missing.';
  end if;
end $$;

alter table public.materials
  add column if not exists category_id uuid references public.categories(id) on delete set null;

create index if not exists materials_category_id_idx
  on public.materials(category_id)
  where category_id is not null;

-- POST_MATERIAL_CLEANUP_HARDENING: physical NOT VALID checks are intentionally
-- deferred until the 68 historical links are repaired with real business data.
-- New links are fail-closed in the database. Historical incomplete links remain
-- editable and, once made compliant, cannot regress to an invalid state.
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
  v_new_is_compliant :=
    nullif(pg_catalog.btrim(new.internal_sku), '') is not null
    and nullif(pg_catalog.btrim(new.erp_code), '') is not null
    and nullif(pg_catalog.btrim(new.display_name), '') is not null
    and new.category_id is not null
    and (new.available_for_purchase or new.available_for_sale);

  if tg_op = 'UPDATE' then
    v_old_is_compliant :=
      nullif(pg_catalog.btrim(old.internal_sku), '') is not null
      and nullif(pg_catalog.btrim(old.erp_code), '') is not null
      and nullif(pg_catalog.btrim(old.display_name), '') is not null
      and old.category_id is not null
      and (old.available_for_purchase or old.available_for_sale);
  end if;

  if tg_op = 'INSERT' and not v_new_is_compliant then
    raise exception 'Novo vínculo de material exige SKU interno, código ERP, nome, categoria e disponibilidade.'
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

alter table public.hubia_signals
  add column if not exists status text,
  add column if not exists read_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists ignored_at timestamptz,
  add column if not exists ignored_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz;

update public.hubia_signals
set status = case when lido then 'read' else 'open' end,
    read_at = case when lido then coalesce(read_at, created_at) else read_at end,
    updated_at = coalesce(updated_at, created_at)
where status is null or updated_at is null;

alter table public.hubia_signals
  alter column status set default 'open',
  alter column status set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'hubia_signals_status_chk') then
    alter table public.hubia_signals
      add constraint hubia_signals_status_chk
      check (status in ('open', 'read', 'resolved', 'ignored'));
  end if;
end $$;

create index if not exists hubia_signals_org_status_idx
  on public.hubia_signals(organization_id, status, created_at desc);

create or replace function public.set_hubia_signal_status(
  p_signal_id uuid,
  p_status text
) returns public.hubia_signals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_org uuid;
  v_is_platform_admin boolean;
  v_can_manage boolean;
  v_signal public.hubia_signals%rowtype;
begin
  select identity.user_id, identity.organization_id, identity.is_super_admin
  into v_user, v_org, v_is_platform_admin
  from private.current_identity() as identity;

  if p_status is null or p_status not in ('open', 'read', 'resolved', 'ignored') then
    raise exception 'Status de sinal inválido.' using errcode = '22023';
  end if;

  select signal.* into v_signal
  from public.hubia_signals signal
  where signal.id = p_signal_id
    and (signal.organization_id = v_org or v_is_platform_admin)
  for update;

  if v_signal.id is null then
    raise exception 'Sinal não encontrado para a organização autenticada.' using errcode = 'P0002';
  end if;

  v_can_manage := (
    v_is_platform_admin
    or public.has_role(v_user, v_org, 'admin'::public.app_role)
    or public.has_role(v_user, v_org, 'manager'::public.app_role)
  );

  if not v_can_manage and (
    p_status <> 'read'
    or v_signal.status in ('resolved', 'ignored')
  ) then
    raise exception 'Somente gestor, administrador ou Platform Admin pode alterar este estado do sinal.'
      using errcode = '42501';
  end if;

  update public.hubia_signals
  set status = p_status,
      lido = p_status <> 'open',
      read_at = case when p_status in ('read', 'resolved', 'ignored') then coalesce(read_at, now()) else null end,
      resolved_at = case when p_status = 'resolved' then now() else null end,
      resolved_by = case when p_status = 'resolved' then v_user else null end,
      ignored_at = case when p_status = 'ignored' then now() else null end,
      ignored_by = case when p_status = 'ignored' then v_user else null end,
      updated_at = now()
  where id = v_signal.id
  returning * into v_signal;
  return v_signal;
end;
$$;

revoke all on function public.set_hubia_signal_status(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_hubia_signal_status(uuid, text) to authenticated;

-- Lifecycle mutations are server-authoritative through set_hubia_signal_status.
-- `lido` remains a synchronized read projection for the coordinated client rollout.
revoke update on public.hubia_signals from public, anon, authenticated;

alter table public.notifications
  add column if not exists archived_at timestamptz;

grant update(archived_at) on public.notifications to authenticated;

create index if not exists notifications_user_inbox_idx
  on public.notifications(user_id, created_at desc)
  where archived_at is null;

alter table public.quotation_requests
  add column if not exists request_type text,
  add column if not exists requester_user_id uuid references auth.users(id) on delete restrict,
  add column if not exists requester_name_snapshot text,
  add column if not exists target_organization_id uuid references public.organizations(id) on delete restrict;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quotation_requests_request_type_chk') then
    alter table public.quotation_requests
      add constraint quotation_requests_request_type_chk
      check (request_type is null or request_type in ('BID', 'DIRECT'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quotation_requests_direct_target_chk') then
    alter table public.quotation_requests
      add constraint quotation_requests_direct_target_chk
      check (request_type is null or request_type <> 'DIRECT' or target_organization_id is not null);
  end if;
end $$;

drop policy if exists "Decisions can be created by users in the same organization" on public.quotation_decisions;
drop policy if exists "Decisions are viewable by users in the same organization" on public.quotation_decisions;
drop policy if exists quotation_decisions_org_read on public.quotation_decisions;
create policy quotation_decisions_org_read on public.quotation_decisions for select to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1 from public.quotation_requests request
    where request.id = quotation_decisions.request_id
      and request.organization_id = public.current_authenticated_organization_id()
  )
);

revoke insert, update, delete, truncate on public.quotation_decisions
  from public, anon, authenticated, service_role;
grant select on public.quotation_decisions to authenticated, service_role;

create index if not exists quotation_requests_target_org_idx
  on public.quotation_requests(target_organization_id, status, created_at desc)
  where target_organization_id is not null;

create index if not exists quotation_items_request_id_idx
  on public.quotation_items(request_id);

alter table public.suppliers
  add column if not exists connected_organization_id uuid references public.organizations(id) on delete restrict;

create unique index if not exists suppliers_org_connected_org_uidx
  on public.suppliers(organization_id, connected_organization_id)
  where connected_organization_id is not null;

create index if not exists suppliers_connected_org_idx
  on public.suppliers(connected_organization_id)
  where connected_organization_id is not null;

alter table public.supplier_quotations
  add column if not exists supplier_organization_id uuid references public.organizations(id) on delete restrict;

create index if not exists supplier_quotations_supplier_org_idx
  on public.supplier_quotations(supplier_organization_id, status, created_at desc)
  where supplier_organization_id is not null;

drop policy if exists qr_org_write on public.quotation_requests;
drop policy if exists tenant_isolation_policy_quotations on public.quotation_requests;
drop policy if exists qr_org_select on public.quotation_requests;
create policy qr_org_select on public.quotation_requests for select to authenticated
using (
  organization_id = public.current_authenticated_organization_id()
  or public.is_super_admin()
);

drop policy if exists qr_org_update on public.quotation_requests;
create policy qr_org_update on public.quotation_requests for update to authenticated
using (
  public.is_super_admin()
  or (
    organization_id = public.current_authenticated_organization_id()
    and (
      public.has_role(auth.uid(), organization_id, 'admin'::public.app_role)
      or public.has_role(auth.uid(), organization_id, 'buyer'::public.app_role)
    )
  )
)
with check (
  public.is_super_admin()
  or (
    organization_id = public.current_authenticated_organization_id()
    and (
      public.has_role(auth.uid(), organization_id, 'admin'::public.app_role)
      or public.has_role(auth.uid(), organization_id, 'buyer'::public.app_role)
    )
  )
);

revoke insert, update, delete, truncate on public.quotation_requests
  from public, anon, authenticated, service_role;
grant select on public.quotation_requests to authenticated;
grant update(due_date, notes, priority_level) on public.quotation_requests to authenticated;

drop policy if exists qr_target_org_select on public.quotation_requests;
create policy qr_target_org_select on public.quotation_requests for select to authenticated
using (target_organization_id = public.current_authenticated_organization_id());

drop policy if exists qi_org_write on public.quotation_items;
drop policy if exists qi_org_select on public.quotation_items;
create policy qi_org_select on public.quotation_items for select to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1 from public.quotation_requests request
    where request.id = quotation_items.request_id
      and request.organization_id = public.current_authenticated_organization_id()
  )
);

revoke insert, update, delete, truncate on public.quotation_items
  from public, anon, authenticated, service_role;
grant select on public.quotation_items to authenticated;

drop policy if exists qi_target_org_select on public.quotation_items;
create policy qi_target_org_select on public.quotation_items for select to authenticated
using (exists (
  select 1 from public.quotation_requests request
  where request.id = quotation_items.request_id
    and request.target_organization_id = public.current_authenticated_organization_id()
));

drop policy if exists sq_target_org_select on public.supplier_quotations;
create policy sq_target_org_select on public.supplier_quotations for select to authenticated
using (supplier_organization_id = public.current_org_id());

drop policy if exists sq_target_org_update on public.supplier_quotations;
create policy sq_target_org_update on public.supplier_quotations for update to authenticated
using (supplier_organization_id = public.current_org_id())
with check (supplier_organization_id = public.current_org_id());

revoke update on public.supplier_quotations from authenticated;
grant update(status, total_amount, notes, submitted_at, updated_at) on public.supplier_quotations to authenticated;

drop policy if exists sqi_target_org_select on public.supplier_quotation_items;
create policy sqi_target_org_select on public.supplier_quotation_items for select to authenticated
using (exists (
  select 1 from public.supplier_quotations quotation
  where quotation.id = supplier_quotation_items.supplier_quotation_id
    and quotation.supplier_organization_id = public.current_org_id()
));

drop policy if exists sqi_target_org_write on public.supplier_quotation_items;
drop policy if exists sqi_target_org_insert on public.supplier_quotation_items;
create policy sqi_target_org_insert on public.supplier_quotation_items for insert to authenticated
with check (exists (
  select 1
  from public.supplier_quotations quotation
  join public.quotation_items item on item.id = supplier_quotation_items.quotation_item_id
  where quotation.id = supplier_quotation_items.supplier_quotation_id
    and quotation.request_id = item.request_id
    and quotation.supplier_organization_id = public.current_org_id()
));

drop policy if exists sqi_target_org_update on public.supplier_quotation_items;
create policy sqi_target_org_update on public.supplier_quotation_items for update to authenticated
using (exists (
  select 1 from public.supplier_quotations quotation
  where quotation.id = supplier_quotation_items.supplier_quotation_id
    and quotation.supplier_organization_id = public.current_org_id()
))
with check (exists (
  select 1
  from public.supplier_quotations quotation
  join public.quotation_items item on item.id = supplier_quotation_items.quotation_item_id
  where quotation.id = supplier_quotation_items.supplier_quotation_id
    and quotation.request_id = item.request_id
    and quotation.supplier_organization_id = public.current_org_id()
));

revoke delete on public.supplier_quotation_items from authenticated;

create table if not exists public.quotation_ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  quotation_id uuid not null references public.quotation_requests(id) on delete restrict,
  recommended_supplier_id uuid not null references public.suppliers(id) on delete restrict,
  recommended_supplier_quotation_id uuid not null references public.supplier_quotations(id) on delete restrict,
  score numeric not null check (score >= 0 and score <= 100),
  ranking jsonb not null default '[]'::jsonb,
  estimated_total_cost numeric not null check (estimated_total_cost >= 0),
  reasons jsonb not null default '[]'::jsonb,
  risk_flags jsonb not null default '[]'::jsonb,
  model_version text not null check (nullif(btrim(model_version), '') is not null),
  policy_version text not null check (nullif(btrim(policy_version), '') is not null),
  input_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists quotation_ai_recommendations_quote_created_idx
  on public.quotation_ai_recommendations(quotation_id, created_at desc, id desc);

create or replace function public.validate_quotation_ai_recommendation_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.quotation_requests request
    join public.suppliers supplier
      on supplier.id = new.recommended_supplier_id
     and supplier.organization_id = request.organization_id
    join public.supplier_quotations quotation
      on quotation.id = new.recommended_supplier_quotation_id
     and quotation.request_id = request.id
     and quotation.supplier_id = supplier.id
     and quotation.status = 'submitted'
     and quotation.total_amount is not null
    where request.id = new.quotation_id
      and request.organization_id = new.organization_id
  ) then
    raise exception 'Recomendação, cotação, proposta e fornecedor precisam pertencer ao mesmo tenant.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_quotation_ai_recommendation_integrity()
  from public, anon, authenticated, service_role;
drop trigger if exists trg_quotation_ai_recommendation_integrity
  on public.quotation_ai_recommendations;
create trigger trg_quotation_ai_recommendation_integrity
before insert or update on public.quotation_ai_recommendations
for each row execute function public.validate_quotation_ai_recommendation_integrity();

alter table public.quotation_ai_recommendations enable row level security;
drop policy if exists quotation_ai_recommendations_org_read on public.quotation_ai_recommendations;
create policy quotation_ai_recommendations_org_read on public.quotation_ai_recommendations for select to authenticated
using (
  organization_id = public.current_authenticated_organization_id()
  or public.is_super_admin()
);
revoke all on public.quotation_ai_recommendations from public, anon, authenticated, service_role;
grant select on public.quotation_ai_recommendations to authenticated;
grant select, insert on public.quotation_ai_recommendations to service_role;

create table if not exists public.quotation_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  quotation_id uuid not null references public.quotation_requests(id) on delete restrict,
  requester_user_id uuid not null references auth.users(id) on delete restrict,
  decision_id uuid not null references public.quotation_decisions(id) on delete restrict,
  approval_type text not null default 'AI_OVERRIDE' check (approval_type = 'AI_OVERRIDE'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete restrict,
  review_comment text,
  unique (decision_id)
);

alter table public.quotation_approvals enable row level security;

create index if not exists quotation_approvals_org_status_requested_idx
  on public.quotation_approvals(organization_id, status, requested_at desc);

create or replace function public.validate_quotation_approval_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.quotation_decisions decision
    join public.quotation_requests request on request.id = decision.request_id
    where decision.id = new.decision_id
      and decision.request_id = new.quotation_id
      and decision.decision_by = new.requester_user_id
      and decision.decision_type = 'AI_OVERRIDE'
      and request.organization_id = new.organization_id
  ) then
    raise exception 'Aprovação, decisão, solicitante e cotação precisam pertencer ao mesmo tenant.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_quotation_approval_integrity()
  from public, anon, authenticated, service_role;
drop trigger if exists trg_quotation_approval_integrity on public.quotation_approvals;
create trigger trg_quotation_approval_integrity
before insert or update on public.quotation_approvals
for each row execute function public.validate_quotation_approval_integrity();

drop policy if exists quotation_approvals_org_read on public.quotation_approvals;
create policy quotation_approvals_org_read
on public.quotation_approvals for select to authenticated
using (
  organization_id = public.current_authenticated_organization_id()
  or public.is_super_admin()
);

drop policy if exists quotation_approvals_org_review on public.quotation_approvals;

revoke all on public.quotation_approvals from public, anon, authenticated, service_role;
grant select on public.quotation_approvals to authenticated;
grant select on public.quotation_approvals to service_role;

alter table public.quotation_decisions
  add column if not exists override_reason text,
  add column if not exists recommended_total numeric,
  add column if not exists selected_total numeric,
  add column if not exists approval_status text,
  add column if not exists recommendation_snapshot jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quotation_decisions_type_chk') then
    alter table public.quotation_decisions
      add constraint quotation_decisions_type_chk
      check (decision_type in ('NORMAL_DECISION', 'AI_OVERRIDE', 'AI_APPROVED')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quotation_decisions_override_fields_chk') then
    alter table public.quotation_decisions
      add constraint quotation_decisions_override_fields_chk
      check (
        decision_type <> 'AI_OVERRIDE'
        or (
          nullif(btrim(override_reason), '') is not null
          and nullif(btrim(justification), '') is not null
          and approval_status in ('pending', 'approved', 'rejected')
        )
      ) not valid;
  end if;
end $$;

-- Keep rejected attempts as history while allowing a new decision. Pending and
-- approved decisions remain exclusive for each request.
drop index if exists public.idx_decision_request;
create unique index if not exists quotation_decisions_one_active_per_request_uidx
  on public.quotation_decisions(request_id)
  where approval_status is null or approval_status in ('pending', 'approved');
create index if not exists quotation_decisions_request_created_idx
  on public.quotation_decisions(request_id, created_at desc, id desc);

alter table public.compliance_events
  add column if not exists quotation_id uuid references public.quotation_requests(id) on delete restrict,
  add column if not exists decision_id uuid references public.quotation_decisions(id) on delete restrict,
  add column if not exists commercial_context jsonb not null default '{}'::jsonb,
  add column if not exists approval_status text;

alter table public.compliance_events alter column conversation_id drop not null;

alter table public.compliance_events drop constraint if exists compliance_events_event_type_check;
alter table public.compliance_events drop constraint if exists ce_event_type_check;
alter table public.compliance_events
  add constraint compliance_events_event_type_check
  check (event_type in ('attachment_flagged', 'upload_cancelled', 'quotation_ai_override'));

create index if not exists compliance_events_decision_id_idx
  on public.compliance_events(decision_id)
  where decision_id is not null;

create or replace function public.record_quotation_decision(
  p_request_id uuid,
  p_winner_supplier_id uuid,
  p_override_reason text,
  p_justification text
) returns public.quotation_decisions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_org uuid;
  v_request public.quotation_requests%rowtype;
  v_recommendation public.quotation_ai_recommendations%rowtype;
  v_decision public.quotation_decisions%rowtype;
  v_selected_total numeric;
  v_recommended_total numeric;
  v_impact numeric;
  v_impact_percent numeric;
  v_is_override boolean;
begin
  select identity.user_id, identity.organization_id
  into v_user, v_org
  from private.current_identity() identity;

  if not (
    public.has_role(v_user, v_org, 'admin'::public.app_role)
    or public.has_role(v_user, v_org, 'buyer'::public.app_role)
  ) then
    raise exception 'Usuário sem permissão para decidir a cotação.' using errcode = '42501';
  end if;

  select * into v_request from public.quotation_requests
  where id = p_request_id and organization_id = v_org for update;
  if v_request.id is null then
    raise exception 'Cotação não encontrada para a organização autenticada.' using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from public.quotation_decisions decision
    where decision.request_id = p_request_id
      and (
        decision.approval_status is null
        or decision.approval_status in ('pending', 'approved')
      )
  ) then
    raise exception 'Já existe uma decisão ativa ou aprovada para esta cotação.' using errcode = '23505';
  end if;

  select recommendation.* into v_recommendation
  from public.quotation_ai_recommendations recommendation
  join public.suppliers supplier
    on supplier.id = recommendation.recommended_supplier_id
   and supplier.organization_id = v_org
  join public.supplier_quotations quotation
    on quotation.id = recommendation.recommended_supplier_quotation_id
   and quotation.request_id = p_request_id
   and quotation.supplier_id = supplier.id
   and quotation.status = 'submitted'
   and quotation.total_amount is not null
  where recommendation.quotation_id = p_request_id
    and recommendation.organization_id = v_org
  order by recommendation.created_at desc, recommendation.id desc
  limit 1;
  if v_recommendation.id is null then
    raise exception 'Recomendação versionada não encontrada.' using errcode = 'P0002';
  end if;

  select quotation.total_amount into v_selected_total
  from public.supplier_quotations quotation
  join public.suppliers supplier
    on supplier.id = quotation.supplier_id
   and supplier.organization_id = v_org
  where quotation.request_id = p_request_id
    and quotation.supplier_id = p_winner_supplier_id
    and quotation.status = 'submitted';
  select quotation.total_amount into v_recommended_total
  from public.supplier_quotations quotation
  where quotation.id = v_recommendation.recommended_supplier_quotation_id
    and quotation.request_id = p_request_id
    and quotation.supplier_id = v_recommendation.recommended_supplier_id
    and quotation.status = 'submitted';
  if v_selected_total is null or v_recommended_total is null then
    raise exception 'As propostas selecionada e recomendada precisam estar submetidas com totais reais.' using errcode = '22023';
  end if;

  v_is_override := p_winner_supplier_id <> v_recommendation.recommended_supplier_id;
  if v_is_override and (
    nullif(btrim(p_override_reason), '') is null
    or nullif(btrim(p_justification), '') is null
  ) then
    raise exception 'Motivo e justificativa são obrigatórios para divergir da recomendação.' using errcode = '22023';
  end if;
  v_impact := v_selected_total - v_recommended_total;
  v_impact_percent := case when v_recommended_total = 0 then null else (v_impact / v_recommended_total) * 100 end;

  insert into public.quotation_decisions(
    request_id, winner_supplier_id, recommended_supplier_id, justification,
    decision_by, decision_type, financial_impact, financial_impact_percent,
    snapshot, override_reason, recommended_total, selected_total,
    approval_status, recommendation_snapshot
  ) values (
    p_request_id, p_winner_supplier_id, v_recommendation.recommended_supplier_id,
    nullif(btrim(p_justification), ''), v_user,
    case when v_is_override then 'AI_OVERRIDE' else 'NORMAL_DECISION' end,
    v_impact, v_impact_percent, to_jsonb(v_recommendation),
    nullif(btrim(p_override_reason), ''), v_recommended_total, v_selected_total,
    case when v_is_override then 'pending' else 'approved' end,
    to_jsonb(v_recommendation)
  ) returning * into v_decision;

  if v_is_override then
    insert into public.quotation_approvals(
      organization_id, quotation_id, requester_user_id, decision_id
    ) values (v_org, p_request_id, v_user, v_decision.id);

    insert into public.compliance_events(
      organization_id, conversation_id, sender_user_id, sender_organization_id,
      recipient_organization_id, event_type, risk_level, risk_score,
      detection_source, reasons, quotation_id, decision_id, commercial_context,
      approval_status
    ) values (
      v_org, null, v_user, v_org, v_org, 'quotation_ai_override', 'medium', 50,
      'procurement_governance', jsonb_build_array('Decisão diferente da recomendação versionada'),
      p_request_id, v_decision.id,
      jsonb_build_object(
        'recommended_total', v_recommended_total,
        'selected_total', v_selected_total,
        'financial_impact', v_impact,
        'financial_impact_percent', v_impact_percent,
        'override_reason', p_override_reason,
        'justification', p_justification
      ), 'pending'
    );

    perform public.emit_notification(
      role_row.user_id, v_org, 'approval_required', 'Aprovação de divergência necessária',
      'A cotação ' || v_request.title || ' possui decisão diferente da recomendação Hub.IA.',
      'quotation_approval', p_request_id, '/empresa/aprovacoes?quotation=' || p_request_id::text,
      jsonb_build_object('quotation_id', p_request_id, 'decision_id', v_decision.id),
      'high', 'quotation-approval:' || v_decision.id::text || ':' || role_row.user_id::text
    )
    from public.user_roles role_row
    where role_row.organization_id = v_org
      and role_row.user_id <> v_user
      and role_row.role in ('admin'::public.app_role, 'manager'::public.app_role);
  end if;

  return v_decision;
end;
$$;

revoke all on function public.record_quotation_decision(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.record_quotation_decision(uuid, uuid, text, text) to authenticated;

create or replace function public.review_quotation_approval(
  p_approval_id uuid,
  p_outcome text,
  p_comment text default null
) returns public.quotation_approvals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_org uuid;
  v_is_platform_admin boolean;
  v_approval public.quotation_approvals%rowtype;
begin
  select identity.user_id, identity.organization_id, identity.is_super_admin
  into v_user, v_org, v_is_platform_admin
  from private.current_identity() identity;

  if p_outcome is null or p_outcome not in ('approved', 'rejected') then
    raise exception 'Resultado de aprovação inválido.' using errcode = '22023';
  end if;
  if p_outcome = 'rejected' and nullif(btrim(p_comment), '') is null then
    raise exception 'Comentário é obrigatório para rejeição.' using errcode = '22023';
  end if;

  select * into v_approval from public.quotation_approvals
  where id = p_approval_id
    and status = 'pending'
    and (organization_id = v_org or v_is_platform_admin)
  for update;
  if v_approval.id is null then
    raise exception 'Aprovação pendente não encontrada.' using errcode = 'P0002';
  end if;
  if v_approval.requester_user_id = v_user then
    raise exception 'Autoaprovação não é permitida.' using errcode = '42501';
  end if;
  if not (
    v_is_platform_admin
    or public.has_role(v_user, v_approval.organization_id, 'admin'::public.app_role)
    or public.has_role(v_user, v_approval.organization_id, 'manager'::public.app_role)
  ) then
    raise exception 'Usuário sem permissão para revisar esta decisão.' using errcode = '42501';
  end if;

  update public.quotation_approvals set
    status = p_outcome,
    reviewed_at = now(),
    reviewed_by = v_user,
    review_comment = nullif(btrim(p_comment), '')
  where id = p_approval_id returning * into v_approval;

  update public.quotation_decisions set approval_status = p_outcome where id = v_approval.decision_id;
  update public.compliance_events set approval_status = p_outcome where decision_id = v_approval.decision_id;

  perform public.emit_notification(
    v_approval.requester_user_id, v_approval.organization_id, 'approval_reviewed',
    case when p_outcome = 'approved' then 'Divergência aprovada' else 'Divergência rejeitada' end,
    coalesce(nullif(btrim(p_comment), ''), 'A revisão da decisão comercial foi concluída.'),
    'quotation_approval', v_approval.quotation_id,
    '/quotations/' || v_approval.quotation_id::text || '/compare',
    jsonb_build_object('approval_id', v_approval.id, 'outcome', p_outcome),
    'high', 'quotation-approval-reviewed:' || v_approval.id::text
  );
  return v_approval;
end;
$$;

revoke all on function public.review_quotation_approval(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.review_quotation_approval(uuid, text, text) to authenticated;

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
  on conflict (organization_id, year)
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
grant execute on function public.create_procurement_quotation(text, date, text, text, jsonb, uuid) to authenticated;

-- Explicit grants are required for projects that opt out of automatic Data API exposure.
grant select on public.quotation_approvals to authenticated;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'materials' and column_name = 'category_id'
  ) or to_regprocedure('public.create_procurement_quotation(text,date,text,text,jsonb,uuid)') is null
    or to_regprocedure('public.record_quotation_decision(uuid,uuid,text,text)') is null
    or to_regprocedure('public.review_quotation_approval(uuid,text,text)') is null
    or to_regprocedure('public.set_hubia_signal_status(uuid,text)') is null
    or to_regclass('public.quotation_decisions_one_active_per_request_uidx') is null
    or to_regclass('public.quotation_decisions_request_created_idx') is null
    or to_regclass('public.quotation_approvals_org_status_requested_idx') is null
    or to_regclass('public.compliance_events_decision_id_idx') is null
    or to_regclass('public.quotation_items_request_id_idx') is null
    or to_regclass('public.suppliers_connected_org_idx') is null then
    raise exception 'B1-R.6 post-validation failed: required schema objects were not created.';
  end if;

  if has_table_privilege('authenticated', 'public.quotation_requests', 'INSERT')
    or has_table_privilege('authenticated', 'public.quotation_items', 'INSERT')
    or has_table_privilege('authenticated', 'public.quotation_decisions', 'INSERT')
    or has_table_privilege('authenticated', 'public.quotation_approvals', 'UPDATE')
    or has_table_privilege('authenticated', 'public.hubia_signals', 'UPDATE')
    or has_table_privilege('service_role', 'public.quotation_requests', 'INSERT')
    or has_table_privilege('service_role', 'public.quotation_items', 'INSERT')
    or has_table_privilege('service_role', 'public.quotation_decisions', 'INSERT')
    or has_table_privilege('service_role', 'public.quotation_approvals', 'UPDATE') then
    raise exception 'B1-R.6 post-validation failed: a forbidden direct write grant remains.';
  end if;

  if has_function_privilege('anon', 'public.create_procurement_quotation(text,date,text,text,jsonb,uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.record_quotation_decision(uuid,uuid,text,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.review_quotation_approval(uuid,text,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.set_hubia_signal_status(uuid,text)', 'EXECUTE')
    or has_function_privilege('service_role', 'public.create_procurement_quotation(text,date,text,text,jsonb,uuid)', 'EXECUTE')
    or has_function_privilege('service_role', 'public.record_quotation_decision(uuid,uuid,text,text)', 'EXECUTE')
    or has_function_privilege('service_role', 'public.review_quotation_approval(uuid,text,text)', 'EXECUTE')
    or has_function_privilege('service_role', 'public.set_hubia_signal_status(uuid,text)', 'EXECUTE') then
    raise exception 'B1-R.6 post-validation failed: an RPC has excess execute privileges.';
  end if;

  if not has_function_privilege('authenticated', 'public.create_procurement_quotation(text,date,text,text,jsonb,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.record_quotation_decision(uuid,uuid,text,text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.review_quotation_approval(uuid,text,text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.set_hubia_signal_status(uuid,text)', 'EXECUTE') then
    raise exception 'B1-R.6 post-validation failed: an authenticated RPC grant is missing.';
  end if;
end $$;

commit;
