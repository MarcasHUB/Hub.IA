# SCHEMA TÉCNICO DE CONTRATOS E ITENS

Este documento define os campos e tipos propostos para a primeira versão (V1) do módulo de Contratos.

## Tabela `contracts`

| Campo | Tipo | Obrigatoriedade | Justificativa |
| :--- | :--- | :--- | :--- |
| `id` | UUID | V1 | Chave primária. |
| `organization_id` | UUID | V1 | Organização compradora e dona do contrato. |
| `supplier_id` | UUID | V1 (Opcional se houver o conectado) | Fornecedor local sombra, não conectado à rede. |
| `supplier_organization_id` | UUID | V1 (Opcional se houver o local) | A outra ponta real conectada. |
| `contract_number` | TEXT | V1 | Identificação comercial. |
| `title` | TEXT | V1 | Nome ou resumo do acordo. |
| `status` | ENUM | V1 | Draft, active, expired, etc. |
| `start_date` / `end_date` | DATE | V1 | Vigência contratual estrita. |
| `currency_code` | TEXT | V1 | O padrão é 'BRL'. |
| `payment_terms` | TEXT | Futuro | Pode ser mapeado como campo estático. |
| `estimated_value` | NUMERIC | Opcional | Valor balizador do acordo (quando global). |
| `business_unit_id` | UUID | Futuro | Para orgs com filiais descentralizadas. |
| `created_at` / `updated_at` | TIMESTAMPTZ | V1 | Auditoria base. |

*Constraints:* `(organization_id, contract_number)` único. Checagem `supplier_id IS NOT NULL OR supplier_organization_id IS NOT NULL`.

## Tabela `contract_items`

| Campo | Tipo | Obrigatoriedade | Justificativa |
| :--- | :--- | :--- | :--- |
| `id` | UUID | V1 | PK. |
| `contract_id` | UUID | V1 | FK Cabeçalho. CASCADE ao deletar draft. |
| `organization_id` | UUID | V1 | Multi-tenant defensivo para RLS na listagem de itens. |
| `material_id` | UUID | V1 | **Obrigatório**. A V1 será exclusivamente de materiais padronizados (Material Master). |
| `product_id` | UUID | Opcional | Conecta ao SKU local caso preexistente. |
| `supplier_material_code`| TEXT | Opcional | Snapshot do código do fornecedor no ato do fechamento. |
| `unit` | TEXT | V1 | Unidade de medida pactuada. |
| `price` | NUMERIC | V1 | Snapshot congelado. |
| `contracted_quantity` | NUMERIC | Opcional | Para contratos de volume fechado. |

*Constraints:* `price >= 0`. Itens não podem ter material duplicado no mesmo período (Tratado preferencialmente no aplicativo).
