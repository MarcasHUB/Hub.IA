# CHECKPOINT DE SANEAMENTO 4C.3.6A.3 - AGUARDANDO PROCEED FINAL

Este documento detalha o planejamento cirúrgico das exclusões, remapeamentos e a auditoria para a estruturação definitiva baseada em `organizations`, sem a execução das exclusões destrutivas, aguardando o **PROCEED FINAL**.

## 1. Resumo Executivo
O banco de dados contém registros duplicados da Raízen, uma série de empresas legadas e fictícias (como `SupplyHub Ltda`) e dependências cruzadas entre a tabela antiga `companies` e `organizations`. 
Os dados protegidos (Hub.IA operadora e perfis específicos) foram validados, e um script `dry_run.sql` (disponível no projeto) foi montado com travas automáticas para garantir a integridade dos IDs canônicos.

## 2. Escolha do ID Canônico para a Raízen
**ID Selecionado:** `bb2edb49-8742-460f-8bff-96a84b4265b5`
**Motivo Técnico:** Assume-se como o registro de maior integridade e o atual target para os perfis `everton.cordebello@raizen.com` e `viniciuscordebello@icloud.com`. Possui a raiz de metadados completa ("Raízen Paraíso", CNPJ 08.070.508/0158-76). Os IDs alternativos (`206f40ea-1841...` e `9e2e4d9c-9a9b...`) serão alvos de UPDATE (para transferir operadores/profiles/materials para o canônico) seguidos de exclusão (`DELETE`).

## 3. Classificação e Destino das Organizações

**A Preservar:**
1. **Hub.IA (Canônica / Operadora):** `68a2f0b2-80f7-4868-bbb9-30b531c12db2` (is_platform_internal = true)
2. **Raízen (Canônica):** `bb2edb49-8742-460f-8bff-96a84b4265b5`

**A Excluir:**
- Duplicatas Raízen: `206f40ea-1841-4f34-b373-3ced14e2bda3`, `9e2e4d9c-9a9b-42cb-81cb-b2c861335af1`
- SupplyHub Ltda: `a0000000-0000-0000-0000-000000000001`
- Demais fictícias (Aço Brasil, PackMaster, etc.) e registros UUID artificiais (`1111...`, `2222...`, `3333...`) identificados com metadados `is_dev_test`.

## 4. Classificação de Usuários
- **Preservados (Protegidos):** 
  - `viniciuscordebello@gmail.com` (ADM GLOBAL, vinculado à Hub.IA)
  - `everton.cordebello@raizen.com` (ADM Raízen)
  - `viniciuscordebello@icloud.com` (Secundário Raízen)
- **A Inativar/Excluir:** Contas atreladas estritamente a empresas fictícias, ou sem profiles e operadores vinculados (após `DELETE cascade` simulações).

## 5. Materiais e Produtos
**Foram identificados 12 materiais da SupplyHub Ltda.**
Decisão: **Preservar no Cadastro Master Global**.
*Justificativa:* Os materiais representam itens de catálogo real e são essenciais para manter a integridade da plataforma global, ainda que tenham sido inseridos originalmente pela "SupplyHub Ltda". 
**Ação:** O vínculo comercial local (`organization_materials`) de tais materiais com a SupplyHub Ltda será apagado, tornando o material "Global/Órfão de owner corporativo local".
*Produtos (`products`)*: Produtos comerciais listados em nome da SupplyHub Ltda e Raízens Duplicadas serão excluídos caso não haja como mesclar ou remapear.

## 6. Saneamento Legado e Fornecedores
- **`companies`**: Será congelada. Suas referências no B2B (`NetworkPage`, `PartnerCard`, `ChatDrawer`) serão reescritas para apontar para `organizations`.
- **Fornecedores (`suppliers`)**: Os 27 registros atuais de demonstração **não serão excluídos**. Eles sofrerão um `UPDATE` recebendo flags: `is_demo = true`, `is_archived = true`, `data_origin = 'legacy_demo'`, tornando-os invisíveis nos fluxos reais.

## 7. Dependências a Refatorar no Código
Foi detectada a necessidade de migração arquitetural de `company_id` para `organization_id` (via migration e refatoração TS/React). 
1. **Tabelas Afetadas:** `conversations` (atuais `company_a_id`/`company_b_id`), `connection_requests`.
2. **Código:** Componentes de Parceiros e chat; necessitarão refatoração completa nos repositórios para o novo UUID.

## 8. Backup e Dry-Run
- Os comandos e lógicas foram salvos em `docs/fase4c3/saneamento_backup/dry_run.sql`. 
- Esse script possui validações transacionais (PL/pgSQL) que abortam e enviam rollback automático se tentarem deletar a Hub.IA (68a2...) ou a Raízen Canônica (bb2e...).

---

> [!WARNING]
> NENHUMA EXCLUSÃO FOI REALIZADA. O SANEAMENTO ESTÁ AGUARDANDO.

## 9. Comandos Exatos para Execução Destrutiva
```sql
BEGIN;
-- Remapear Raízen
UPDATE profiles SET organization_id = 'bb2edb49-8742-460f-8bff-96a84b4265b5' WHERE organization_id IN ('206f40ea-1841-4f34-b373-3ced14e2bda3','9e2e4d9c-9a9b-42cb-81cb-b2c861335af1');
-- Apagar origens comerciais (organization_materials e products) de empresas fictícias
DELETE FROM organization_materials WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';
DELETE FROM products WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';
-- Apagar Fictícias
DELETE FROM organizations WHERE id = 'a0000000-0000-0000-0000-000000000001';
COMMIT;
```

**ESTADO: AGUARDANDO PROCEED FINAL DE SANEAMENTO**
