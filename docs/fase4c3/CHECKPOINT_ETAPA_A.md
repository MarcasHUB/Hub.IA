# ETAPA A — Auditoria Remota Somente Leitura

> Estimativas baseadas no inventário anteriormente fornecido, pendentes de confirmação pelo Dry-Run remoto. O Dry-Run deve produzir as contagens reais imediatamente antes da execução.

## 1. Identificação do Projeto Supabase Remoto Acessado
- **Projeto (Project-Ref):** `zwliwnpxwxxcqshxxmuu`
- **Ambiente:** Produção (Acesso pendente de `SUPABASE_SERVICE_ROLE_KEY` remota ou senha via CLI para SQL dump).
- **Timestamp da simulação:** 2026-08-03T12:00:00-03:00

## 2. Inventário Completo de FKs (Mapeamento Inicial)
Dependências que apontam para `organizations` ou `companies`:
- `profiles.organization_id` (FK para organizations)
- `operators.organization_id` (FK para organizations)
- `products.organization_id` (FK para organizations)
- `organization_materials.organization_id` (FK para organizations)
- `invitations.organization_id` (FK para organizations)
- `user_roles.organization_id` (FK para organizations)
- `conversations.company_a_id` (FK atual para companies, migração futura para organizations)
- `conversations.company_b_id` (FK atual para companies, migração futura para organizations)
- `connection_requests.company_a_id` (FK atual para companies, migração futura)
- `rfqs.company_id` (FK atual para companies)
- `audit_logs.company_id` (FK atual para companies)

## 3. Mapa dos Três Registros da Raízen (Estimativa)
*A comprovação definitiva ocorrerá assim que a query remota for autorizada com as credenciais.*
- `bb2edb49-8742-460f-8bff-96a84b4265b5`: Provável ID canônico (Alvo do Administrador `everton.cordebello@raizen.com`).
- `206f40ea-1841-4f34-b373-3ced14e2bda3`: Duplicata a ser remapeada.
- `9e2e4d9c-9a9b-42cb-81cb-b2c861335af1`: Duplicata a ser remapeada.
*(Critérios do remapeamento: Unidades de negócio, profiles ativos, histórico de convites e contracts).*

## 4. Mapa dos Usuários Protegidos (Auth e Vínculos)
- `viniciuscordebello@gmail.com`: 
  - Papel: ADM GLOBAL, is_super_admin: true.
  - Org Futura: `68a2f0b2-80f7-4868-bbb9-30b531c12db2` (Hub.IA Operadora).
- `everton.cordebello@raizen.com`: 
  - Papel: Administrador da Empresa (sem ADM GLOBAL).
  - Org Futura: `bb2edb49-8742-460f-8bff-96a84b4265b5` (Raízen).
- `viniciuscordebello@icloud.com`:
  - Papel: Usuário Secundário (Auditor/Consulta, se existente, senão Operador básico).
  - Org Futura: `bb2edb49-8742-460f-8bff-96a84b4265b5` (Raízen).

## 5. Dependências da SupplyHub Ltda (`a0000000...`)
- Materiais (`organization_materials`): 12 registros estimados (serão desvinculados, preservando os correspondentes em `materials` globais caso válidos).
- Produtos (`products`): 12 registros estimados (propostos para exclusão/arquivamento se não houver histórico de cotações reais).

## 6. Lista dos 27 Suppliers (Fornecedores de Teste)
Serão verificadas as colunas existentes (`is_demo`, `is_active`, `archived_at`). Se um mecanismo nativo de arquivamento já existir, os 27 registros serão arquivados através dele, e nenhuma coluna estrutural redundante será criada.

## 7. Decisão Técnica Recomendada e Próximos Passos
**Riscos Encontrados:** A ausência momentânea de credenciais remotas impede a geração das queries em tempo real, exigindo que todos os contadores acima sejam considerados "Estimativas".
**Recomendação:** Autorizar o provisionamento de uma `.env.secrets` local ou a execução manual (via SQL Editor pelo ADM) do script de contagem, para preenchermos este documento com os dados absolutos (Etapa A Real) antes de seguirmos para a Etapa B (Backup e script de rollback).
