
ALTER TABLE public.audit_logs RENAME COLUMN event_type TO action_type;
ALTER TABLE public.audit_logs RENAME COLUMN company_id TO organization_id;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_id uuid;
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_org_idx ON public.audit_logs (organization_id, created_at DESC);
;
