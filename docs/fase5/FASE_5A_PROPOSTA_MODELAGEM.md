# FASE 5A â€” PROPOSTA DE MODELAGEM

## 1. Tabelas Novas Sugeridas (Conceitual)
- `contracts`: Tabela central do contrato. ContÃ©m cabeÃ§alho, `organization_id`, `partner_organization_id`, status, datas de vigÃªncia, limites globais, origin, version.
- `contract_items`: Itens associados. ContÃ©m `contract_id`, `product_id` (para vincular com CatÃ¡logo Privado), quantidade estimada, saldo, datas de vigÃªncia do item.
- `contract_price_tiers`: Faixas temporais ou de volume para precificaÃ§Ã£o do item. Permite histÃ³rico nÃ£o destrutivo.
- `contract_documents`: Anexos (PDFs). ContÃ©m path no Supabase Storage.
- `contract_consumptions`: Tabela de saldo/consumo transacional. Registra dÃ©bito (pedido criado), crÃ©dito (pedido estornado). FK para `orders` (quando existir) ou `rfqs`.
- `contract_amendments`: Aditivos que versionam ou estendem condiÃ§Ãµes.

## 2. AlteraÃ§Ãµes em Tabelas Existentes
- Sem alteraÃ§Ãµes destrutivas. 
- Em `products` ou `rfq_items`: PossÃ­vel acrÃ©scimo de `current_contract_id` para caching leve de UI, embora a fonte de verdade deva ser query.
- Em `organizations`/`suppliers`: SerÃ¡ necessÃ¡rio parametrizar qual FK usar em `contracts.partner_organization_id`. Recomenda-se consolidaÃ§Ã£o das entidades.

## 3. Relacionamentos
- `contracts` â†’ `organizations` (Contractor)
- `contracts` â†’ `organizations` (Contractee)
- `contract_items` â†’ `contracts`
- `contract_items` â†’ `products` (CatÃ¡logo Privado)

## 4. Ãndices e Constraints
- UNIQUE para `(organization_id, contract_number)`.
- Ãndices em `(organization_id, status)` para performance do Dashboard.
- Constraints CHECK em datas (data_fim >= data_inicio).

## 5. RLS (Row Level Security)
- Todas as novas tabelas terÃ£o RLS ativa.
- `CREATE POLICY "isolation" ON contracts FOR ALL USING (organization_id = resolve_tenant());`

## 6. FunÃ§Ãµes
- CriaÃ§Ã£o de trigger para abatimento idempotente de saldo em `contract_items` ao inserir em `contract_consumptions`.

## 7. EstratÃ©gia de Migrations
- Novas tabelas isoladas.
- Scripts de up e down padronizados. Nenhuma quebra para quem nÃ£o utiliza o mÃ³dulo de contratos.
- Impacto zero na produÃ§Ã£o atual. EstratÃ©gia de feature flag na UI recomendada.

## Correções de Planejamento

### Contraparte de contrato
Não implementar associação polimórfica fraca baseada somente em partner_id/partner_type sem FK real. Avaliar:
- Alternativa A: Entidade intermediária de contraparte (business_partners).
- Alternativa B: Foreign keys explícitas (counterparty_organization_id, counterparty_supplier_id).

### Impacto em produção
Impacto esperado: baixo e controlado, sujeito à validação por migration, RLS, testes de integração, feature flag e homologação.

### Rollback
Não considerar DROP TABLE como estratégia padrão de rollback em produção. A estratégia futura deverá priorizar migrations incrementais, feature flags, e desativação lógica.
