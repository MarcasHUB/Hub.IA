# B1-R.6 migration gate

Migration: `20260829041927_b1_r6_runtime_real_procurement_governance.sql`

Purpose: add canonical material category and link validation, persistent signal/notification lifecycle, transactional RC/RCD creation, direct-quotation receiving, and governed recommendation divergence.

Tables changed: `materials`, `organization_materials` (constraints), `hubia_signals`, `notifications`, `quotation_requests`, `suppliers`, `supplier_quotations`, `quotation_decisions`, `compliance_events`; new `quotation_ai_recommendations` and `quotation_approvals`.

Functions changed/created: `set_hubia_signal_status`, `create_procurement_quotation`, `record_quotation_decision`, `review_quotation_approval`.

RLS changed: recipient-only read/write policies for directed requests, items, supplier quotations and proposal items; organization-scoped decision/approval policies. New RPCs validate auth, tenant and role, use fixed `search_path`, revoke `PUBLIC`/`anon`, and grant only `authenticated` execution.

Backfill: signal booleans become `open`/`read` without losing history. Existing material links are not assigned guessed values; new constraints are `NOT VALID` until historical exceptions are reviewed. No material classification or category is invented.

Risk/rollback: applying adds columns, policies, indexes and functions and creates direct supplier linkage rows only for new RCDs. Rollback should first stop new clients, then remove the new policies/functions and optional columns only after exporting any new approval/signal/direct-quotation history. Automatic destructive rollback is intentionally not supplied.

Remote application status: not applied. Review and explicit authorization are required.
