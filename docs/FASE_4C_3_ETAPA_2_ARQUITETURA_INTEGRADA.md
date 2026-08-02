# FASE 4C.3 ETAPA 2 — ARQUITETURA INTEGRADA

Este documento define a arquitetura oficial integrada entre Materiais, Fornecedores, Contratos, Cotações e Pedidos para a Hub.IA.

## 1. Princípios Arquiteturais
- **Reutilização Extrema:** Nenhuma entidade nova deve ser criada se o conceito já existir no Supabase.
- **Isolamento Multi-tenant:** Toda tabela com dados operacionais ou privados de catálogos deve referenciar `organization_id` ou equivalente, com políticas RLS associadas.
- **A Single Source of Truth:** O `material_id` da tabela `materials` (Material Master) é o eixo central que liga todas as pontas. 

## 2. Visão Global das Entidades e Relacionamentos
- **`materials`**: Material Master global e normativo. Contém `manufacturer_id` e a dupla de unicidade `manufacturer_id` + `normalized_manufacturer_code`.
- **`manufacturers`**: Entidade técnica/industrial da marca produtora.
- **`products`**: O catálogo privado de uma organização, ligando-se ao `material_id`. É onde habitam SKUs, unidades e observações locais de cada empresa.
- **`suppliers`** e **`organization_connections`**: Mapeiam a Rede de Negócios e as entidades que distribuem ou vendem.
- **`product_offers`**: Registra que um fornecedor comercializa um determinado material (vínculo com `material_id`).
- **`quotation_requests`, `supplier_quotations`, `rfqs`**: Formam o core de negociação já existente.
- **Contratos (Planejados)**: Estruturas `contracts` e `contract_items` a serem criadas vinculadas à `organization_id` compradora e `supplier_id` (o fornecedor).

## 3. Diretrizes de Segurança
O banco Supabase usará rigorosamente as funções `public.current_org_id()`, `public.is_super_admin()`, e `public.is_platform_admin()` para segregar o acesso (RLS). Operações de alteração de atributos globais de um material `validated` são restritas a administradores. 

## 4. O Fluxo Oficial de Compras
1. **Identificação**: Consulta em `materials`.
2. **Internalização**: Ligação do Material Global no catálogo privado (`products`).
3. **Sourcing**: Consulta de `product_offers` baseadas no `material_id`.
4. **Acordo (Contrato)**: Contratos fixam vigência e tabelas de preço sobre o `material_id` (e secundariamente o `sku` privado).
5. **Negociação / Pedido**: Cotações (`rfqs`) apontam para `quotation_items` `->` `material_id`. Pedidos gerarão snapshots das condições para assegurar rastreabilidade, consumindo contratos ativos quando existentes.
