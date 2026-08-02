# DECISÕES PENDENTES E RISCOS: ARQUITETURA INTEGRADA

## 1. Módulo de Contratos e a Relação Fornecedor x Organização
- **Pendência:** A estrutura exata do novo módulo de Contratos (Tabelas: `contracts`, `contract_items`). Estas tabelas precisam ser provisionadas.
- **Risco:** O vínculo do Contrato deve ser flexível o suficiente para acomodar contratos sem `material_id` fixo? (e.g. contratos por valor ou prestação de serviço). A decisão inicial amarra fortemente itens de contrato a `material_id`.
- **Mitigação Recomendada:** Manter a relação opcional para prestação de serviços genéricos (caso exista), mas mandatória para produtos (bens de consumo/materiais indiretos).

## 2. Visibilidade da Tabela `product_offers`
- **Pendência:** A tabela `product_offers` foi planejada/encontrada, mas necessita auditoria do RLS. O RLS dessa tabela permite cruzamento de informações?
- **Decisão:** Avaliar se `product_offers` será usada estritamente como "catalogo público da plataforma" ou se há ofertas privadas (Supplier -> Organization específica) antes de formalizar em contrato.

## 3. Snapshot de Preços em Cotações e Pedidos
- **Pendência:** Em `quotation_items` e na estrutura `order_items` (ainda a ser revisada), o campo `agreed_price` é JSON ou coluna física? O snapshot precisa de um modelo blindado.
- **Decisão Recomendada:** Os pedidos (`orders`) nunca devem acessar o preço dinâmico; devem gravar uma cópia imutável dos valores da negociação.

## 4. Auditoria de Criação de Material Master
- **Pendência:** Quando o usuário cria uma solicitação via frontend, ele entra com `pending_review`. Mas não há uma tabela de comentários dedicada para a revisão de materiais.
- **Risco:** Falta de rastreabilidade do motivo de aprovação/rejeição.
- **Decisão Recomendada:** Utilizar ou expandir a `internal_request_messages` para abranger a conversa de curadoria, ou armazenar a "justificativa de rejeição" como um campo text simples em `materials`.
