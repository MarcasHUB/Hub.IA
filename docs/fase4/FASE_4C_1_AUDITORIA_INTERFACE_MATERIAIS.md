# FASE 4C.1 â€” Auditoria e IntegraÃ§Ã£o da Interface de Materiais

## 1. Resumo Executivo
Esta auditoria avaliou a aderÃªncia da interface atual (Front-End) da Hub.IA frente Ã  arquitetura recÃ©m-implantada na Fase 4B (Material Master Global + Produtos Privados).
A arquitetura do Front-End (DDD) opera majoritariamente na entidade `Product`, utilizando `products` de forma unificada. O ID do Material Global (`material_id`) nÃ£o estÃ¡ plenamente inserido na UI e os mÃ©todos de submissÃ£o do formulÃ¡rio instanciam a entidade com o valor `undefined` para `materialId`, delegando ou perdendo seu preenchimento. Contudo, todos os campos cruciais (CÃ³digo do Fabricante e Fabricante) jÃ¡ estÃ£o presentes via coluna `metadata`, o que torna a transiÃ§Ã£o viÃ¡vel de maneira nÃ£o-destrutiva.

A principal desconexÃ£o atual estÃ¡ em salvar "campos globais" e "campos privados" na mesma tabela fÃ­sica/payload e em ausÃªncia explÃ­cita de "Adicionar Material Master Existente" vs "Criar Novo", uma vez que tudo Ã© tratado como um novo Product privado.

**RecomendaÃ§Ã£o:** A transiÃ§Ã£o deve ocorrer gradualmente. Primeiro, adaptando a interface para refletir visualmente a diferenÃ§a entre Globais e Privados (4C.2). Segundo, garantindo a ligaÃ§Ã£o correta via `material_id` ao criar novos produtos privados (4C.3). E em etapas finais, estruturar as visÃµes gerenciais (4C.6 e 4C.7).

## 2. Arquitetura Atual

*   **Rotas Encontradas:**
    *   `/products` -> `<ProductsListPage />` (Listagem, uso de filtros locais e carrinho).
    *   `/products/new` -> `<ProductFormPage />` (CriaÃ§Ã£o).
    *   `/products/:id` -> `<ProductFormPage />` (EdiÃ§Ã£o, tambÃ©m em Modal na Listagem).
*   **Componentes Principais:**
    *   `ProductsListPage.tsx`: Fetch por tenant (`SupabaseProductRepository.findAll`).
    *   `ProductFormPage.tsx`: Tabs de InformaÃ§Ãµes BÃ¡sicas, ClassificaÃ§Ã£o, Comercial, LogÃ­stica, Fornecedores e Documentos.
    *   `LinkSupplierModal.tsx`: Vincula `product_supplier` de forma independente.
*   **DomÃ­nio:**
    *   `Product.ts`: Entidade que jÃ¡ prevÃª `materialId?` (Opcional). A propriedade `isComplete` usa regras como obrigatoriedade de `manufacturerCode`.
    *   `ProductSupplier.ts`: Entidade pivot (privada).
*   **Use Cases:**
    *   `CreateProductUseCase`: Recebe DTO, instancia `Product` (com `materialId` undefined) e repassa ao repository.
*   **Repositories:**
    *   `SupabaseProductRepository`: LÃª de `products`. Mapeia domÃ­nio. A lÃ³gica de salvamento (`save`) constrÃ³i o objeto a persistir enviando o `material_id` da entidade ou null. Insere grande parte dos atributos na coluna JSONB `metadata` (incluindo `manufacturer_code`).
*   **Fluxo de Dados:**
    1. UI (`ProductFormPage`) constrÃ³i estado React local e agrega abas.
    2. Aciona Use Case ou Repository com os dados preenchidos.
    3. `material_id` atualmente nÃ£o Ã© tratado na UI/DTOs e acaba sempre sendo nulo/ignorado.

## 3. Matriz de Campos

| Campo | Origem | Escopo | EdiÃ§Ã£o na Interface | Destino Recomendado |
| :--- | :--- | :--- | :--- | :--- |
| Nome do Produto | Form | Indefinido (Atualmente Privado) | Qualquer empresa | Global (Material Master) |
| Fabricante / Marca | Form (Basic) | Indefinido | Qualquer empresa | Global (Material Master) |
| CÃ³digo Fabricante | Form (Basic) | Indefinido | Qualquer empresa | Global (Material Master) |
| Categoria Principal | Form (Classif) | Indefinido | Qualquer empresa | Global (Material Master) |
| Imagem | Form (Basic) | Indefinido | Qualquer empresa | Global (Material Master) |
| DescriÃ§Ã£o TÃ©cnica | Form (Basic) | Indefinido | Qualquer empresa | Global (Material Master) |
| CÃ³d. Comercial (SKU) | Form (Basic) | Privado | Qualquer empresa | Privado (products.sku) |
| Disp. Venda / Compra | Form (Basic) | Privado | Qualquer empresa | Privado / Relacional |
| Papel (Revenda/Fab) | Form (Basic) | Privado | Qualquer empresa | Relacional |
| PreÃ§o de ReferÃªncia | Form (Comercial) | Privado | Qualquer empresa | Privado |
| MOQ / MÃºltiplo | Form (Comercial) | Privado | Qualquer empresa | Privado |
| LogÃ­stica (Peso/Dim) | Form (LogÃ­stica) | Privado (Geralmente) | Qualquer empresa | Privado / Global? (Depende da Curadoria) |
| Fornecedores | Form (Aba Suppl) | Relacional | Qualquer empresa | products_suppliers (Privado) |
| NCM | Form (Classif) | Privado/Global | Qualquer empresa | Remover futuramente |

## 4. Matriz Global versus Privado (Proposta de AdaptaÃ§Ã£o Visual)

**Material Master Global:**
*   Nome (Padronizado)
*   Fabricante
*   CÃ³digo do Fabricante
*   Categoria Global
*   Imagem Principal
*   DescriÃ§Ã£o TÃ©cnica Completa

**Produto Privado da Empresa:**
*   SKU / CÃ³digo Comercial Interno
*   PreÃ§o e Custos
*   ConfiguraÃ§Ã£o LogÃ­stica (Interna)
*   Documentos e EvidÃªncias locais

**Relacionamentos:**
*   Fornecedores Vinculados
*   Papel (Esta empresa compra/vende este material)

**Curadoria Administrativa:**
*   UnificaÃ§Ã£o
*   ModeraÃ§Ã£o de Status Completo (isComplete)

## 5. Problemas Encontrados

*   **CRÍTICO:** `Product.ts` define `materialId` de forma flexível, mas `CreateProductUseCase` força `undefined` em novos cadastros de UI. Qualquer novo produto hoje nasce órfão e com RLS de produto privado.
*   **ALTO:** O formulário mistura visualmente os campos. Um Comprador editando o Nome ou Fabricante altera isso apenas em seu produto privado, não melhorando o Catálogo Global e potencialmente fragmentando os dados caso queira atualizar um Material.
*   **ALTO:** Divergência não explicada entre os 57 materiais exibidos na interface e os 69 products/materials existentes no remoto.
*   **MÉDIO:** Risco de duplicação por Nome. O debounce/busca de Similar usa `name === name || code === code`. Porém, uma empresa pode forçar a criação ignorando o modal de similares.
*   **MÉDIO:** O NCM e controles que não fazem parte do B2B de suprimentos (ex: estoques muito complexos ou recebimentos inexistentes na UI atual) precisam ser limpos para simplificar o formulário.
*   **MELHORIA:** Mover "Papel de Compra/Venda/Fabricação" e Fornecedores para abas mais adequadas aos conceitos de Rede / Oferta (Offer).
*   **PENDÊNCIAS DE CONCILIAÇÃO:** 1

## 6. DesconexÃµes de Dados

*   **Campo persistido nÃ£o integrado ao Backend Global:** A busca e criaÃ§Ã£o de similar no `ProductFormPage` nÃ£o consulta a tabela `materials` via MaterialRepository, consulta o `SupabaseProductRepository` (somente os produtos privados do prÃ³prio tenant, logo o aviso de similares funciona sÃ³ para duplicidades *internas*, e nÃ£o da rede global).
*   **O `material_id` ausente do Form:** Quando carregado para ediÃ§Ã£o, ele vem no objeto, mas se Ã© salvo como um novo, perde-se completamente a referÃªncia a um Material Global.

## 7. Riscos de Multitenancy

*   **EdiÃ§Ã£o Cruzada e Risco Global:** Hoje, a ediÃ§Ã£o nÃ£o afeta outros tenants pois todos editam apenas seu registro na tabela `products`. PorÃ©m, assim que integrarmos com `materials` na UI, hÃ¡ risco severo: Um tenant nÃ£o deve editar os campos Globais livremente se o Material for de uso comum, ou precisarÃ¡ gerar logs de auditoria e pendÃªncia.
*   **AusÃªncia de Filtro Global de Semelhantes:** A rede precisa avisar o usuÃ¡rio que "O Material X jÃ¡ existe na rede global, deseja vincular?". Atualmente ele olha apenas o seu tenant.

## 8. Plano da Fase 4C (PrÃ³ximas Subetapas Recomendadas)

*   **Fase 4C.2 â€” SeparaÃ§Ã£o visual entre global e privado (Prioridade 1):** Reorganizar o formulÃ¡rio `ProductFormPage` existente para evidenciar os campos globais. Alterar labels e agrupamentos sem mexer no banco. Isso educa os usuÃ¡rios e previne fragmentaÃ§Ã£o.
*   **Fase 4C.3 â€” Adicionar Material Master ao catÃ¡logo da empresa:** Criar um UseCase/fluxo na criaÃ§Ã£o de novos itens que pesquise em `materials`. Se o Material Global existir, o Form de criaÃ§Ã£o jÃ¡ vem com os "campos globais" bloqueados/preenchidos, obrigando o usuÃ¡rio a fornecer o CÃ³digo Interno, vinculando-os automaticamente na persistÃªncia.
*   **Fase 4C.4 â€” Papel da empresa no material:** Formalizar a flag "Vende/Compra/Fabrica" num contexto B2B (tabela de ofertas vs relaÃ§Ã£o de comprador).
*   **Fase 4C.5 â€” Empresas e fornecedores relacionados:** Adaptar a visualizaÃ§Ã£o da tela para que um Comprador encontre Vendedores que possuem aquele Material.
*   **Fase 4C.6 e 4C.7 â€” Curadoria e NotificaÃ§Ãµes:** Construir painÃ©is ADM Globais.
*   **Fase 4C.8 â€” Testes Finais.**

---
*Documento autogerado na conclusão da Auditoria Fase 4C.1*

FASE 4C.1 CONCLUÍDA — AUDITORIA APROVADA

A implementação da separação visual deve começar pela conciliação obrigatória entre os 57 materiais da interface e os 69 products/materials existentes no ambiente remoto.
 

## 9. PENDÊNCIA 4C — CONCILIAÇÃO ENTRE CATÁLOGO VISUAL PUBLIC.PRODUCTS E MATERIAL MASTER GLOBAL

public.products remoto: 69
public.materials remoto: 69
itens exibidos na tela: 57
ativos: 53
inativos: 4
diferença a explicar: 12

* qual consulta gera os 57?
* qual organização está selecionada?
* quantos produtos pertencem à organização atual?
* se os 12 restantes pertencem a outra organização?
* se existem filtros adicionais?
* se existe limite paginação ou agrupamento?
* se todos os 57 possuem material_id?
* se os 57 material_id pertencem aos 69 Materials?
* se existem Materials sem Product vinculado?
* se a tela consulta uma view tabela ou lista diferente?
* se contadores e cards usam a mesma fonte de dados?

