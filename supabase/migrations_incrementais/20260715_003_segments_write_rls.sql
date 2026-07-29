-- 20260715_003_segments_write_rls.sql
-- Habilita escrita (INSERT, UPDATE, DELETE) para a tabela segments no Supabase
-- com base na relação do usuário com a organização (user_roles)

CREATE POLICY "segments_org_insert" ON public.segments FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "segments_org_update" ON public.segments FOR UPDATE TO authenticated USING (
  organization_id IN (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid())
) WITH CHECK (
  organization_id IN (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "segments_org_delete" ON public.segments FOR DELETE TO authenticated USING (
  organization_id IN (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid())
);
