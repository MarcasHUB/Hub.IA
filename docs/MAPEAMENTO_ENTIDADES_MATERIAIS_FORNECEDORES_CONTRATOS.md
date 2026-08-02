# MAPEAMENTO DE ENTIDADES: MATERIAIS, FORNECEDORES E CONTRATOS

## 1. Material Master (`materials`)
- **Papel:** Identidade global centralizada de um material (Master Data).
- **Campos Principais:** `id`, `official_name`, `description`, `manufacturer_id`, `manufacturer_code`, `category_id`, `validation_status`.
- **Relações:** Apontado por `products.material_id`, `quotation_items.material_id`.

## 2. Fabricantes (`manufacturers`)
- **Papel:** Marca ou indústria produtora (Identidade Industrial).
- **Relações:** Base para garantir que o mesmo `manufacturer_code` não colida quando for de marcas diferentes.

## 3. Catálogo Privado (`products`)
- **Papel:** Produto inserido no dia a dia da organização compradora.
- **Campos Principais:** `id`, `organization_id`, `material_id`, `sku` (código próprio), coluna jsonb `metadata` abrigando `price`, `unit` e descrições internas.

## 4. Fornecedor (`suppliers`) e Conexões (`organization_connections`)
- **Papel:** Entidade comercial vendedora ou distribuidora. A estrutura já possui base para a Rede de Negócios (Business Network).

## 5. Ofertas e Catálogos de Fornecedor (`product_offers`)
- **Papel:** Indica que a organização vendedora comercializa um item mestre.
- **Campos Previstos:** Fornecedor (`supplier_id`), `material_id`, Preços padrão (quando público).

## 6. Cotações (`quotation_requests`, `supplier_quotations`)
- **Papel:** O processo de concorrência ou verificação de viabilidade.
- **Ligação:** Usa `quotation_items.material_id` como rastreabilidade. Snapshot é gerado no aceite.

## 7. Contratos (`contracts` e `contract_items` - PLANEJADOS)
- **Papel:** Representa um acordo formal com validade de preço, prazo e fornecimento.
- **Ligação com Material:** A tabela de itens referenciará `material_id` e o `supplier_id` (o contratado).
