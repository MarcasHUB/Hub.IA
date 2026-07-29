# Fase 4A — Auditoria e Consolidação do Domínio de Materiais

## 1. Resumo Executivo
Esta auditoria avaliou a estrutura atual de produtos e materiais no banco de dados e no código-fonte, visando a implantação do modelo-alvo de Material Master Global, Catálogo da Empresa e Base de Abastecimento. Constatou-se que a aplicação frontend hoje consome exclusivamente a entidade `products` (comportando-se como o Catálogo da Empresa), enquanto tabelas globais introduzidas em tentativas anteriores (`materials`, `organization_materials`) estão subutilizadas. A relação comercial com fornecedores já utiliza `product_suppliers`.

## 2. Inventário do Banco de Dados
A análise abrangeu 56 tabelas, com foco nas seguintes estruturas de materiais:
- **`products`**: Tabela principal em uso. Contém `organization_id` (pertence ao tenant), `name`, `description`, `sku`, `category_id`, `manufacturer_code`, `is_active`.
- **`materials`**: Tabela de nível global (sem `organization_id`), contendo `code`, `name`, `description`, `group_code`, `ncm`. Criada em iterações passadas, mas não integrada aos fluxos (PR/ORC/PO).
- **`organization_materials`**: Tabela associativa entre `organizations` e `materials`, com `internal_code`. Subutilizada.
- **`product_suppliers`**: Tabela associativa ativa (`product_id` + `supplier_id` + `organization_id`), contendo `moq`, `lead_time_days`, `last_negotiated_price`, `purchase_unit`.
- **`categories`** e **`manufacturers`**: Tabelas auxiliares globais.
- **`internal_request_items`** e **`quotation_items`**: Ambas referenciam `product_id` (FK de `products`), e não de `materials`.

## 3. Inventário do Código (Frontend)
- O código atual concentra as operações de leitura e escrita no módulo `products` (ex: `ProductFormPage.tsx`, `ProductsListPage.tsx`).
- O domínio mapeia a entidade `Product.ts` (que engloba sku e fabricante) e o repositório `SupabaseProductRepository.ts`.
- O vínculo de compras está no `SupabaseProductSupplierRepository.ts` mapeado na entidade `ProductSupplier.ts`.
- Termos como `materials` e `organization_materials` quase não aparecem nos módulos, exceto em rascunhos de páginas (`NetworkPage.tsx`).

## 4. Modelo Atual vs Modelo-Alvo
- **Atual**: Cada empresa cria o seu próprio produto (`products`), sem uma base mestre unificada. Isso gera duplicação e impede análise global.
- **Alvo**:
  - **Material Master (Global)**: Entidade única (`materials` ou refatoração equivalente).
  - **Catálogo da Empresa**: Vínculo do tenant com o mestre (`products` reformulado ou `organization_materials`).
  - **Base de Abastecimento**: Vínculo com o fornecedor mantido e adaptado em `product_suppliers`.

## 5. Diagrama Textual das Entidades (Proposta de Adaptação Suave)
```text
[ materials ] (Material Master Global)
  |-- id (PK)
  |-- name, description, manufacturer_code, uom, is_active
  
      ^
      | (1:N)
      
[ products ] (Catálogo da Empresa - Reuso da tabela atual)
  |-- id (PK)
  |-- organization_id (Tenant)
  |-- material_master_id (FK nova p/ materials)
  |-- sku (código interno da empresa)
  |-- is_active

      ^
      | (1:N)
      
[ product_suppliers ] (Base de Abastecimento)
  |-- id (PK)
  |-- organization_id (Tenant proprietário)
  |-- product_id (FK p/ products/catálogo)
  |-- supplier_id (FK p/ fornecedor conectado)
  |-- moq, lead_time_days, last_negotiated_price
```

## 6. Matriz de Compatibilidade de Campos

| Estrutura Atual (`products`) | Uso Atual | Estrutura-Alvo | Ação Proposta | Impacto/Risco |
| :--- | :--- | :--- | :--- | :--- |
| `name`, `description`, `manufacturer_code` | Utilizados na criação do produto | Material Master (`materials`) | **Migrar (Backfill)** para nova ou existente tabela global `materials`. | Baixo (depende do backfill). |
| `sku` | Identificador na empresa | Catálogo da Empresa | **Manter** em `products` (representando o código interno). | Baixo. Preserva UX. |
| `organization_id` | Dono do registro | Catálogo da Empresa | **Manter** em `products`. | Nenhum (RLS preservada). |
| FK `product_id` nas Requisições/Cotações | Vínculo de compras | Catálogo da Empresa | **Manter**. As requisições continuam apontando para o catálogo da empresa (`products`). | Mínimo. Evita quebrar fluxos PR/ORC. |

## 7. Matriz de Relacionamentos
- **`internal_request_items`** ➔ Aponta para `products.id`. Mantém-se inalterado.
- **`quotation_items`** ➔ Aponta para `products.id`. Mantém-se inalterado.
- **`product_suppliers`** ➔ Aponta para `products.id` e `suppliers.id`. Mantém-se inalterado.

## 8. Segurança e Multi-tenancy (Estratégia)
- **Material Master (`materials`)**: RLS de leitura (`FOR SELECT`) baseada em `has_org_access` (se associada a catálogo) ou pública, se o catálogo mestre for aberto. Edição restrita a `platform_admin`.
- **Catálogo da Empresa (`products`)**: RLS inalterada. Isolamento via `organization_id`.
- **Base de Abastecimento (`product_suppliers`)**: RLS inalterada. Propriedade garantida pela `organization_id` do comprador.
- **Helpers**: Quaisquer novas checagens usarão os helpers `SECURITY DEFINER` validados na Fase 3.

## 9. Análise da Tela Material × Fornecedor
A tela hoje está estruturada ao redor do `product_suppliers` (no drawer de fornecedores e produtos). A interface precisa ser modernizada para permitir:
- Selecionar o item do catálogo (`products`).
- Listar fornecedores via tabela `product_suppliers`.
- Visualizar `moq`, `lead_time`, `purchase_unit`.
- (Pendente) Decidir se o fornecedor será o `organizations` conectado ou o antigo `suppliers`.

## 10. Impacto em PR ➔ ORC ➔ PO
O modelo sugerido preserva a tabela `products` como "Catálogo da Empresa". Com isso, as tabelas `internal_request_items` e `quotation_items` que apontam para `products.id` **não quebram**. A integração flui naturalmente, injetando os dados do Material Master através de um `JOIN` ou view. 

## 11. Divisão Final das Subfases

- **Fase 4A**: Auditoria e arquitetura de compatibilidade (Concluída neste doc).
- **Fase 4B**: Estruturação do Material Master Global.
  - Ajuste/Criação da tabela global (`materials`).
  - Adição da coluna `material_master_id` em `products`.
  - Backfill dos dados de `products` (nome, fabricante) para `materials`.
  - Refatoração dos Repositories no backend.
- **Fase 4C**: Tela e domínio Material × Fornecedor.
  - Refatoração da UI para gestão comercial do material.
  - Ajustes em `product_suppliers`.
- **Fase 4D**: Importação inteligente (Fluxo de reconciliação de Master vs Catálogo).
- **Fase 4E**: Fluxos PR ➔ ORC ➔ PO.
  - Garantir que as telas de requisição exibam os dados globais.
- **Fase 4F**: Testes, RLS, regressão e encerramento.

## 12. Dúvidas que Dependem de Decisão Funcional
1. O Material Master (`materials`) será visível para todos os tenants pesquisarem ou somente se a Hub.IA fizer a curadoria?
2. A Base de Abastecimento deve continuar referenciando o fornecedor na tabela legacy `suppliers` ou deve migrar para `organizations` da rede B2B?
