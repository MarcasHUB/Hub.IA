# FASE 5A — MAPEAMENTO DO SCHEMA EXISTENTE

## 1. Tabelas existentes relevantes
- `organizations`: Organização base, contratante e contratado.
- `suppliers`: Atualmente um misto de espelho da rede e fornecedor não-conectado.
- `materials`: Material Master Global.
- `products`: Catálogo privado da empresa (vínculo ao material).
- `rfqs` / `quotation_requests`: Cotações em andamento.
- `user_roles`: Governança de Tenant (Resolvedor de `organization_id`).

## 2. Colunas Estruturais
- A chave primária padrão é `id` (UUID).
- Isolamento padrão: `organization_id` (UUID).
- Criação e modificação: `created_at`, `updated_at`, `created_by`.

## 3. Foreign Keys & Relacionamentos Atuais
- `products.material_id` → `materials.id`.
- `products.organization_id` → `organizations.id`.
- `user_roles.organization_id` → `organizations.id`.

## 4. Políticas (RLS)
- O padrão RLS da plataforma baseia-se na restrição onde `organization_id` do registro seja igual ao `organization_id` do usuário logado (via claim JWT ou query na `user_roles`).

## 5. Funções e Triggers
- Atualizações automáticas de `updated_at`.
- Proteção de campos administrativos (identificado uso na tabela `materials`).

## 6. Duplicidades Potenciais & Gaps Reais
- **Gaps reais:** Não há tabelas dedicadas a contratos, aditivos, saldo consumido ou versionamento de preço por período.
- **Duplicidades potenciais:** Há o perigo de se criar `contract_parties` duplicando lógicas de `organization_connections`. O módulo precisará referenciar as partes usando as chaves definitivas do Hub. 
- **Suppliers vs Organizations:** É crítico decidir se o contratado será um `organization_id` ou um `supplier_id`. O ideal é suportar ambos polimorficamente ou migrar suppliers totalmente para a malha de organizations (mesmo que com flag de `is_stub`).

## 7. Repositories e UI
- A aplicação utiliza Repositories pattern (ex: `SupabaseCategoryRepository`).
- A UI utiliza layouts responsivos.
- É possível o reaproveitamento dos componentes de "Upload de Documentos", "Aprovação de RFQ" (adaptação para fluxo de contrato) e "Listagem de Itens".
