# FASE 4C.3 ETAPA 3 — VALIDAÇÃO FUNCIONAL

## 1. Modelo de Fornecedores (`suppliers` vs `organizations`)
- A tabela `organizations` é o topo da hierarquia, o 'Tenant' da Hub.IA.
- A tabela `suppliers` (linha 2466) vincula-se a `organization_id` da empresa compradora. 
- Quando a empresa se conecta a outra via `empresa_parceiros` (ou `organization_connections`), o `supplier` representa o "Vendor Record" no ERP privado do comprador, não a identidade única global.
- **Recomendação para Contratos:** Um contrato é bilateral. Logo, a FK ideal para a ponta do fornecedor é **`supplier_organization_id`**, referenciando a `organizations` verdadeira da contraparte conectada, garantindo uso transversal no sistema. Em cenários on-boarding (fornecedor não tem org), o contrato só fica "ativo" no sistema se houver match.

## 2. Estrutura de `product_offers`
- Contém `organization_id`, `product_id`, `supplier_id`, `unit_price`, `minimum_order_quantity`.
- Problema: Liga-se a `product_id` em vez de `material_id`. Logo, o fornecedor está ofertando em cima do SKU da empresa compradora. 
- A coluna `supplier_material_code` fará sentido se adicionarmos FK para `material_id`. Por ora, `product_offers` atua apenas como lista de preços acordados temporários. Não é um catálogo global.

## 3. Segurança RLS & Auditoria Geral
- **ADM GLOBAL**: Acesso via `is_platform_admin()` confere liberação global. Contratos serão visíveis apenas em metadados caso necessário auditar, sem alterar conteúdo.
- Auditoria: Usa-se o trigger central do Supabase + `audit_logs`. Alterações de preço e status do contrato requererão rastreio de `old_price` e `new_price`.
