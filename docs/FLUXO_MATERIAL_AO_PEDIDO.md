# FLUXO ARQUITETURAL: MATERIAL MASTER AO PEDIDO

```mermaid
graph TD
    %% Entidades Master Data Globais
    M[materials] -->|Identidade Global| MA[manufacturers]
    
    %% Catálogo Privado
    M -->|Vínculo por material_id| P[products - Catálogo Privado]
    
    %% Fornecedor e Ofertas
    M -->|Ofertado por| PO[product_offers]
    S[suppliers] -->|Fornece a Oferta| PO
    
    %% Contratos
    M -->|Contratado| CI[contract_items]
    C[contracts] -->|Contém| CI
    S -->|Assina o Contrato| C
    
    %% Fluxo de Cotação e Pedido
    P -->|Usuário solicita compra| QR[quotation_requests]
    QR -->|Gera cotações via material_id| SQ[supplier_quotations]
    SQ -->|Itens referenciam material_id e contrato aplicável| SQI[supplier_quotation_items]
    SQI -->|Aprovação| QD[quotation_decisions]
    QD -->|Emissão| O[orders]
    O -->|Snapshot comercial de contrato/cotação| OI[order_items]
    OI -->|Rastreabilidade final| M
```

## Resumo do Ciclo de Vida
1. A Organização Compradora **interna** o `materials.id` dentro do seu catálogo `products`.
2. A Organização Fornecedora expõe sua venda através de `product_offers.material_id`.
3. Ambos podem formalizar um **Contrato** cujos itens amarram `contract_items.material_id`.
4. Uma requisição entra via `quotation_requests` vinculada à Organização compradora.
5. Quando gerada a Cotação (RFQ/Quotation), o sistema avalia se há Contrato pré-existente.
6. A finalização no Pedido gera um snapshot inalterável das condições acordadas, garantindo isolamento temporal.
