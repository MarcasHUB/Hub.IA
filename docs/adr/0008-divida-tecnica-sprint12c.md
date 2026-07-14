# ADR 0008: Registro de Dívida Técnica e Plano de Migração — Sprint 12C

## Status
Aprovado / Backlog Planejado

## Contexto
Durante a Sprint 12B, priorizou-se a entrega funcional, a validação de UI com o cliente final e a segurança de credenciais com Supabase Edge Functions. Para viabilizar a homologação imediata e testes sem fricção pelo usuário, os repositórios utilizaram fallbacks locais (`localStorage`) para exibição das listas (operadores, segmentos, delegações, logs e sinais). Visando a estabilidade e o alinhamento com a arquitetura limpa (Clean Architecture), é obrigatório estruturar a persistência definitiva no Supabase na Sprint 12C.

## Decisão
Decidimos mapear os seguintes itens como dívida técnica e backlog obrigatório para a Sprint 12C:

### 1. Desacoplamento através de Interfaces de Domínio
Criar contratos rígidos na camada de domínio para isolar a dependência do Supabase:
- `src/modules/employees/domain/repositories/IOperatorRepository.ts`
- `src/modules/employees/domain/repositories/ISegmentRepository.ts`
- `src/modules/employees/domain/repositories/IDelegationRepository.ts`

### 2. Criação do Repositório de Segmentos
- Implementar `SupabaseSegmentRepository.ts` consumindo a tabela `segments` do banco de dados.
- Refatorar a página `SegmentsPage.tsx` para consumir o repositório em vez de funções de auxílio locais.

### 3. Remoção Definitiva de Fallbacks LocalStorage
- expurgar as chaves `supplyhub_operators_v2`, `supplyhub_segments_v2`, `supplyhub_delegations_v2`, `supplyhub_access_logs_v2`, `supplyhub_operation_logs_v2` e `supplyhub_signals_v2` do código de infraestrutura.
- Operar unicamente com leituras e escritas via Supabase API Client.

### 4. Integração com React Query
- Substituir chamadas imperativas em `useEffect` por queries e mutations declarativas utilizando `@tanstack/react-query`.
- Otimizar o cache local de segmentos e operadores para reduzir requisições redundantes ao Supabase REST.

### 5. Auditoria de Segurança Multi-Tenant (RLS)
- Implementar e testar rigorosamente as políticas de RLS no PostgreSQL para garantir que nenhum tenant consiga visualizar operadores ou segmentos de outras empresas.
- Exemplo de política de segurança:
  ```sql
  CREATE POLICY "Tenant Isolation" ON operators
  FOR ALL TO authenticated
  USING (organization_id = (auth.jwt()->>'organization_id')::uuid);
  ```

## Consequências
- A aplicação passa a ser 100% dependente da conexão com o Supabase.
- A segurança de dados multi-tenant é garantida na camada de banco de dados (RLS), mitigando riscos de vazamento de dados.
- A manutenibilidade do código do front-end é melhorada devido à arquitetura limpa e gerenciamento de estado moderno com React Query.
