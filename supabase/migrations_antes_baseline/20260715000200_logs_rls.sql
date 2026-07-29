-- 20260715_002_logs_rls.sql
-- Aplicação de Row Level Security (RLS) para as tabelas de logs
-- Motivo: Permitir que usuários anônimos (ou autenticados durante o fluxo de auth) gravem logs de acesso (append-only)

-- Tabela: access_logs
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir inserção livre de access_logs"
ON public.access_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Tenant Isolation para access_logs"
ON public.access_logs
FOR SELECT
TO authenticated
USING (
  organization_id = (SELECT organization_id FROM public.operators WHERE id = auth.uid() LIMIT 1)
);

-- Tabela: operation_logs
ALTER TABLE public.operation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir inserção livre de operation_logs"
ON public.operation_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Tenant Isolation para operation_logs"
ON public.operation_logs
FOR SELECT
TO authenticated
USING (
  organization_id = (SELECT organization_id FROM public.operators WHERE id = auth.uid() LIMIT 1)
);
