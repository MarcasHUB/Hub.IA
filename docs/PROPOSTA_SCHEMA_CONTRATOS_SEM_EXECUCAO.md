# PROPOSTA DO SCHEMA DE CONTRATOS E COMPRAS (Sem Execução)

## Constraints e Índices Fundamentais
* Chaves Estrangeiras (FK):
  * `contracts.organization_id` -> `organizations.id` (ON DELETE CASCADE).
  * `contracts.supplier_organization_id` -> `organizations.id` (ON DELETE RESTRICT).
  * `contract_items.material_id` -> `materials.id` (ON DELETE RESTRICT).
* Índices:
  * Um índice único em `(organization_id, contract_number)` para evitar duplicidades na mesma empresa.
* Checks:
  * `start_date <= end_date`.

## Auditoria Requerida
* Implementação de uma Função de Trigger `log_contract_changes()` conectada a `audit_logs`, registrando diffs em JSON (ex: se o usuário altera preço e prazo, logar old vs new values). Nenhuma alteração passa apenas por history client-side.

## Conexões Subsequentes
* Tabela de cotações (`quotation_items` ou similar futuro) deve prever: `contract_item_id UUID NULL` referenciando `contract_items.id (ON DELETE SET NULL)`.
* Tabela de Pedidos Final (`purchase_order_items`) gravará em colunas fixas os valores pactuados (`agreed_price`, `agreed_deadline`), independentemente do update posterior na tabela de contratos, protegendo compras já executadas.
