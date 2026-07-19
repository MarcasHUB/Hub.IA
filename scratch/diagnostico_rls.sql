-- 1. VERIFICAR GRANTS DA TABELA operators
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'operators'
ORDER BY grantee, privilege_type;

-- 2. GARANTIR GRANTS DA TABELA operators (Execute mesmo assim por precaução)
GRANT SELECT, INSERT, UPDATE ON public.operators TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

-- 3. VERIFICAR SE EXISTE OUTRA POLICY BLOQUEANDO
SELECT policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'operators';

-- 4. SIMULAÇÃO RLS COM O USUÁRIO GESTOR
SELECT set_config('request.jwt.claim.sub', '32a5db3a-e0d1-4ed4-aef4-27edf75d817d', true);
SET ROLE authenticated;

-- Confirmar qual usuário está simulado
SELECT auth.uid() AS usuario_simulado;

-- Validar a leitura da user_roles sob a RLS
SELECT id, user_id, organization_id, role 
FROM public.user_roles 
WHERE user_id = auth.uid();

-- Validar a leitura da tabela operators sob a RLS
SELECT id, organization_id, nome, sobrenome, email, cargo, perfil, status, deleted_at 
FROM public.operators 
WHERE organization_id = '68a2f0b2-80f7-4868-bbb9-30b531c12db2';

-- Limpar a simulação
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
