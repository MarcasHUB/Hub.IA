# ADR 0010: Refatoração do Carrinho e Fluxo de Prévia de Requisição

## Status
Aprovado

## Contexto
O fluxo de criação de cotações precisava de uma experiência corporativa mais refinada e transparente para o comprador, aproximando a usabilidade dos requisitos reais de suprimentos:
1. Nomenclatura coerente no catálogo de materiais (renomeando "Adicionar à RC" para "Adicionar ao Carrinho").
2. Gaveta de carrinho moderna ("Carrinho Corporativo") com possibilidade de anotações e especificações técnicas individuais por item do material.
3. Tela única e centralizada de "Prévia da Requisição" antes do envio, com prazos, prioridades, tipo de BID e fornecedores reais carregados a partir do banco de dados (Supabase), priorizando os vinculados à base de abastecimento.

## Decisão
Implementamos as seguintes modificações:
- **Contexto do Carrinho (`QuotationCartContext.tsx`):** Expandimos a interface `CartItem` para incluir `sku`, `partNumber`, `supplier` e `notes` (observações por item). Criamos o método `updateNotes` para atualização em tempo real na interface da gaveta.
- **Layout de Aplicação (`AppLayout.tsx`):** Redesenhou-se a gaveta lateral para exibir os novos badges e metadados dos materiais, bem como a área de anotação individual. O botão de fechamento aciona agora o modal de Prévia no próprio Layout.
- **Modal de Prévia (`QuotationTypeModal.tsx`):** Reescreveu-se o componente para carregar todos os fornecedores cadastrados no Supabase via `SupabaseSupplierRepository` e as associações preferenciais via `SupabaseProductSupplierRepository`. O formulário agora é unificado, contém um campo **Solicitante** editável (pré-preenchido com o nome do operador logado) e dispara o callback de gravação para as chaves `supplyhub_quotations` e `supplyhub_sent_quotations` no localStorage.
- **Filtros e Busca Ampliada (`QuotationsListPage.tsx`):**
  - Adicionado botão de **"Limpar"** de forma absoluta no canto direito do input de busca, ativado somente quando há texto digitado.
  - A pesquisa foi ampliada para filtrar cotações por nome de material, solicitante, SKU, Part Number e ID da RC de forma case-insensitive.
- **Hierarquia Visual dos Cards e Navegação:**
  - O título principal do card de requisição passou a ser o **ID/Código da RC** (ex: `RC-2026-47327`), que agora é um elemento clicável direcionando o comprador diretamente para a tela de propostas (`/quotations/:id/compare`).
  - O resumo de itens contidos na requisição (incluindo quantitativo) é listado de forma detalhada no corpo do card.

## Consequências
- A integração entre o carrinho, a geração de cotações e o painel comparativo de propostas está 100% aderente ao fluxo B2B corporativo.
- Mantivemos total compatibilidade com o fluxo de chat (`ChatDrawer`), que consome o mesmo componente de modal de forma transparente.
