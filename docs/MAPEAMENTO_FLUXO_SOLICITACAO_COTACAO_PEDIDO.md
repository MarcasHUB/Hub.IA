# MAPEAMENTO DO FLUXO DE SOLICITAÇÃO A PEDIDO

## 1. Requisição Inicial (`internal_requests` e `internal_request_items`)
- **Papel:** É a solicitação que vem da operação/solicitante da empresa compradora. 
- **Decisão:** Não deve ser reutilizada como a tabela final de Pedidos de Compra externa (`purchase_orders`), pois seu domínio é puramente intra-organizacional.

## 2. Abertura ao Mercado (`quotation_requests` e `rfqs`)
- **Papel:** Representam o envelope da Cotação. `quotation_requests` e `rfqs` coexistem com ligeira sobreposição funcional no baseline. `rfqs` carrega explicitamente a relação Comprador x Fornecedor Unitária (Conversation).

## 3. Respostas de Fornecedores (`supplier_quotations` e `supplier_quotation_items`)
- **Papel:** As propostas recebidas. Nelas já pode haver injeção de valores acordados por contratos prévios (com identificador a ser incluído).

## 4. Decisão / Aprovação (`quotation_decisions`)
- **Papel:** Marco de escolha da melhor oferta. Gera os triggers operacionais.

## 5. Pedido Final (Emissão de `purchase_orders`)
- **Decisão Arquitetural:** O fluxo atual carece da tabela formal e blindada de encerramento chamada `purchase_orders` e `purchase_order_items`. Será necessário criá-la na Fase 5 para separar o "pedido colocado no fornecedor" da mera "solicitação interna" ou "finalização de cotação". A criação formal garantirá snapshots robustos (`agreed_price`) vinculando Cotação e Contrato simultaneamente.
