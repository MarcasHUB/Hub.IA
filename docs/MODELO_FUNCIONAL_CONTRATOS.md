# MODELO FUNCIONAL DE CONTRATOS E ITENS

A entidade `contracts` será um acordo firmado entre a `organization_id` compradora e a `supplier_organization_id` vendedora.

## Cabeçalho (`contracts`)
* **id**: (UUID) Obrigatório (V1).
* **organization_id**: (UUID) Obrigatório (V1). Comprador.
* **supplier_organization_id**: (UUID) Obrigatório (V1). O Fornecedor conectado.
* **contract_number**: (String) Obrigatório (V1). Formato gerado ou injetado do ERP.
* **title**: (String) Obrigatório (V1).
* **status**: (Enum) Obrigatório (V1). (`draft`, `active`, `expired`, `canceled`).
* **start_date** / **end_date**: (Date) Obrigatório (V1).
* **currency**: (String) Opcional (V1). Default 'BRL'.
* **payment_terms**: (String) Planejado futura.
* **created_by** / **updated_at**: Timestamps Obrigatórios.

## Itens (`contract_items`)
* **id**: (UUID) Obrigatório (V1).
* **contract_id**: (UUID) Obrigatório (V1). FK para `contracts`.
* **material_id**: (UUID) Obrigatório (V1). O elo com o catálogo global.
* **product_id**: (UUID) Opcional (V1). Mapeia para o SKU do comprador, se já existir.
* **supplier_code**: (String) Opcional (V1).
* **unit**: (String) Obrigatório (V1).
* **price**: (Numeric) Obrigatório (V1).
* **contracted_quantity** / **minimum_quantity**: (Int) Opcional (V1).
* **is_active**: (Boolean) Obrigatório (V1).

A rastreabilidade nas Cotações (`quotation_items.contract_item_id`) e nos Pedidos fará o elo da compra real baseada nestas cláusulas de preço e prazo.
