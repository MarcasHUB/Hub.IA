# HIERARQUIA DE PREÇOS E ORIGEM

O sistema determina o valor exibido na Cotação ou no Pedido respeitando a seguinte ordem cronológica e formal:

1. **Preço de Contrato Válido (Máxima Prioridade)**
   - O item de contrato ativo que referencie aquele `material_id` para o `supplier_organization_id` anula preços temporários ou catálogos. A vigência (start_date e end_date) e o status devem atestar a validade. Se vencido, ignora.

2. **Preço Negociado na Cotação (RFQ/Quotation)**
   - Caso um acordo pontual seja feito (sem contrato), o `agreed_price` vencedor na negociação de cotação torna-se o snapshot transacional.

3. **Preço do Catálogo Público/Oferta (`product_offers`)**
   - Se não há contrato nem negociação, mas o fornecedor publicou um preço de prateleira na rede para o Material Master.

4. **Preço Histórico Estimado (Catálogo Privado)**
   - Metadado interno salvo em `products.metadata->price`, baseado em compras anteriores da própria empresa. O sistema o usa apenas como referencial (Baseline estimate).

## Snapshot no Pedido Final
- No momento da conversão da decisão (`quotation_decisions` ou finalização do pedido via `internal_requests`/futura `purchase_orders`), a coluna explícita `agreed_price` na tabela de itens é populada. 
- O valor congelado fica imune a flutuações futuras do contrato ou de tabela, preservando auditoria.
