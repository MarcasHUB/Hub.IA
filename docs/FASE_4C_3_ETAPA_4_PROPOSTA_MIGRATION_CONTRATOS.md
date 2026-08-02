# PROPOSTA DA MIGRATION DE CONTRATOS E ESTRATÉGIA DE TRANSIÇÃO

## 1. Resumo da Proposta (DRAFT SQL)
A migration de rascunho (`20260730000001_fase4c3_contracts_draft.sql`) introduz a arquitetura formal B2B do módulo de Contratos.
Foram criadas duas tabelas principais (`contracts` e `contract_items`), além do enum `contract_status`.
O foco principal é o encapsulamento de segurança utilizando as amarras de Tenants (`organization_id` e `supplier_organization_id`) blindadas pelo RLS.

## 2. A Evolução de Entidades Dependentes
Para suportar o ambiente, a tabela `products_offers` será migrada e adequada separadamente em uma janela posterior (Fase 5) para abandonar `product_id` em prol de `material_id`.
Isso diminui os riscos sistêmicos desta Fase 4.

## 3. Segurança e Auditoria
O rascunho propõe as diretrizes bases de RLS para o Tenant da Compradora e do Fornecedor, mas ressalta-se que toda e qualquer transição de estado da entidade Contract ou Itens dependerá de functions customizadas (e trigger atrelada a `audit_logs`) para barrar Updates silenciosos por usuários mal-intencionados ou por APIs mal configuradas.

## 4. Próximos Passos (Aguardando Aprovação)
A autorização de execução deste DRAFT deve prever testes em Dev. A estrutura foi inspecionada e não colide com chaves existentes na base de dados inicial do SupplyHUB.
