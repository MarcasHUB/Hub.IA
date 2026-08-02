# DECISÕES DA ETAPA 2 CORRIGIDAS

Este documento formaliza as correções de rota decididas e ratificadas na Etapa 3 frente ao entendimento inicial da Etapa 2.

## 1. Relação com Fornecedores
- **Anteriormente (Etapa 2):** Havia incerteza sobre qual entidade amarrar o fornecedor (suppliers ou organization).
- **Corrigido (Etapa 3):** Os contratos de fornecimento exigem vínculo direto no nível macro `organization_id` da outra parte via campo `supplier_organization_id`. A tabela `suppliers` (linha 2466) amarra-se como lista local (agenda do comprador), não como chave de partição multi-tenant global para um contrato cross-organization.

## 2. Pedidos de Compra (Orders)
- **Anteriormente (Etapa 2):** Pensava-se em adaptar extensivamente as tabelas de pedidos existentes para abranger as novas regras macro.
- **Corrigido (Etapa 3):** Identificado que `internal_requests` tem escopo exclusivamente intra-empresa (requisições de almoxarifado/aprovação). Não deve ser sobreposto. Deve-se desenhar e criar na Fase 5 as entidades robustas específicas: `purchase_orders` e `purchase_order_items`.

## 3. Preços de Ofertas vs Catálogos
- **Anteriormente (Etapa 2):** Hipótese de `product_offers` atuar simultaneamente como catálogo público e vitrine contratual.
- **Corrigido (Etapa 3):** `product_offers` não servirá para vitrine contratual fixa (que agora terá sua própria tabela), mas sim como as tabelas de preços correntes de mercado/spots de fornecedores, sempre submissas em hierarquia a qualquer preço de Contrato Válido (conforme estipulado em `HIERARQUIA_PRECOS_E_ORIGEM.md`).

## 4. Auditoria Administrativa e ADM GLOBAL
- **Anteriormente (Etapa 2):** "O ADM GLOBAL tem acesso vedado aos contratos."
- **Corrigido (Etapa 3):** A afirmação foi refinada. O ADM GLOBAL tem acesso bloqueado ao CONTEÚDO (preços e dados sensíveis) sem break-glass justificado, mas DEVE possuir visão administrativa dos metadados (existência do contrato, vigência e volume transacionado) para fins de suporte à integridade sistêmica.
