# ESTRATÉGIA DE TRANSIÇÃO PARA PRODUCT OFFERS

A tabela `product_offers` atual aponta fortemente para `product_id` (o SKU interno do Comprador/Organização primária) em vez de focar na estrutura universal `material_id`. 
Isso distorce a proposta de que a Oferta deveria ser do Fornecedor para um Master Data, em vez de Fornecedor para o código de estoque privado do Comprador.

## Alternativa Recomendada: A (Migration Separada)
- **Estratégia Escolhida:** Adicionar a coluna `material_id UUID NULL` à tabela `product_offers` em uma migration SEPARADA, e NÃO misturá-la com o módulo de Contratos.
- **Justificativa Técnica:** Contratos formam um módulo massivo e complexo isolado logicamente em acordos de preço firmados. `product_offers` é uma tabela de Catálogo de Preços Gerais Correntes de mercado. Misturá-los na mesma migration (Fase 4C.3) cria risco excessivo de rollback, além de afetar módulos pré-existentes que leem ofertas que poderiam falhar transacionalmente caso algo dê errado no módulo de Contratos.

## Plano de Transição Futura (Fase 5/Evolução)
1. Adição do `material_id` NULLABLE a `product_offers`.
2. Script/Job preenchendo todos os `product_offers.material_id` puxando do `products.material_id` correlato.
3. Alteração da Aplicação (App e Repositories) para ler e escrever a partir do `material_id`.
4. Alteração estrutural para tornar `material_id` NOT NULL em `product_offers` e descontinuar o uso de `product_id` na oferta pública.
