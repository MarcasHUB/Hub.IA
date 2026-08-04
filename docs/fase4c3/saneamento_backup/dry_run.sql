-- DRY-RUN de Saneamento 4C.3.6A.3
-- Este script simula o saneamento estrutural e NÃO deve ser executado no BD produtivo diretamente sem BEGIN; ROLLBACK;

BEGIN;

-- 1. VALIDAÇÃO DE SEGURANÇA OBRIGATÓRIA
-- Aborta se registros protegidos estiverem ausentes.
DO $$
DECLARE
    hub_id UUID := '68a2f0b2-80f7-4868-bbb9-30b531c12db2';
    raizen_canonica UUID := 'bb2edb49-8742-460f-8bff-96a84b4265b5'; -- Escolha recomendada
BEGIN
    IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = hub_id) THEN
        RAISE EXCEPTION 'Dry-Run Abortado: Hub.IA (68a2...) não encontrada em organizations.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = raizen_canonica) THEN
        RAISE EXCEPTION 'Dry-Run Abortado: Raízen Canônica não encontrada em organizations.';
    END IF;
END $$;

-- 2. SIMULAÇÃO DE REMAPEAMENTO DE FKS DA RAÍZEN
-- Movemos registros das Raízens duplicadas para a Raízen Canônica.
UPDATE profiles 
SET organization_id = 'bb2edb49-8742-460f-8bff-96a84b4265b5' 
WHERE organization_id IN ('206f40ea-1841-4f34-b373-3ced14e2bda3', '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1');

UPDATE operators 
SET organization_id = 'bb2edb49-8742-460f-8bff-96a84b4265b5' 
WHERE organization_id IN ('206f40ea-1841-4f34-b373-3ced14e2bda3', '9e2e4d9c-9a9b-42cb-81cb-b2c861335af1');

-- 3. SIMULAÇÃO DE EXCLUSÃO DE ORGANIZAÇÕES DEMO
-- Registros fictícios (SupplyHub Ltda, etc) 
DELETE FROM organization_materials WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM products WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM profiles WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM operators WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM organizations WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- 4. SIMULAÇÃO DA FLAG DE FORNECEDORES DEMO
-- Atualizando os 27 fornecedores legados/fictícios (sem exclusão)
UPDATE suppliers 
SET 
  is_demo = true, 
  is_archived = true, 
  data_origin = 'legacy_demo', 
  notes = 'Registro fictício utilizado exclusivamente em testes e demonstrações. Não representa empresa real conectada à Rede Hub.IA.'
WHERE is_demo IS NULL OR is_demo = false;

-- Desfaz todas as alterações (DRY-RUN)
ROLLBACK;

-- RESULTADO ESPERADO: 
-- ROLLBACK concluído sem falhas. Nenhuma exclusão real. Dependências preservadas.
