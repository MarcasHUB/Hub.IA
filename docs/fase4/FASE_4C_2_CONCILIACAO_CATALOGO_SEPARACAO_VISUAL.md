# FASE 4C.2 — Conciliação do Catálogo e Separação Visual Global versus Privado

## 1. Resumo Executivo
Esta etapa implementou a separação visual entre os dados do Material Master Global e os dados privados da empresa na interface de edição/criação de produtos (`ProductFormPage`). Antes das alterações, realizamos uma conciliação que explicou a discrepância de contagem (57 materiais exibidos na interface vs 69 registros na base remota). O fluxo de persistência existente foi preservado, garantindo que as regras de negócio e multitenancy não fossem afetadas.

## 2. Conciliação do Catálogo

A discrepância identificada na Fase 4C.1 foi plenamente justificada pela arquitetura de multitenancy (`organization_id` / RLS):

* **public.products (Remoto):** 69 registros totais.
* **public.materials (Remoto):** 69 registros totais.
* **Itens exibidos na tela (`/products`):** 57 registros.
* **Diferença (12 registros):** Pertencem a uma outra organização (`organization_id` distinto) inserida durante testes anteriores ou na carga inicial.
* **Validação RLS:** A interface consulta a tabela `public.products` filtrando pelo `tenantId` da organização atual. O repositório `SupabaseProductRepository` adiciona corretamente este filtro, limitando a exibição aos 57 produtos pertencentes à empresa atual.
* **Conclusão:** Não há perda de dados ou registros corrompidos (órfãos/sem material_id). O sistema de isolamento de tenants (RLS / Filtro de Repositório) está funcionando conforme projetado.

A fonte oficial da listagem de materiais *da empresa* continua sendo `public.products`, enquanto `public.materials` atua silenciosamente no backend como o Material Master Global da Hub.IA.

## 3. Modificações na Interface (`ProductFormPage.tsx`)

Para educar o usuário e preparar a integração plena do Catálogo Global (Fase 4C.3), a interface do formulário de produto foi reorganizada em dois blocos lógicos na aba de "Informações Básicas":

### Bloco 1 - Identificação Global do Material
* **Campos:** Nome, Fabricante, Código do Fabricante, Imagem, Descrição Técnica e Categoria Global.
* **Comportamento Visual:**
  * Caso o produto possua um `materialId` (já vinculado à rede), uma tag verde/azul "Catálogo Global" é exibida, e os inputs correspondentes ficam desabilitados (`disabled`), impedindo que a empresa altere dados globais acidentalmente.
  * Caso seja um produto novo ou sem `materialId`, a tag "Material Global Pendente" alerta que os dados fornecidos serão usados para criar/vincular um registro no Catálogo Global, mas permite a edição.

### Bloco 2 - Dados Internos da Sua Empresa
* **Campos:** SKU (Código Comercial da Revenda), Papel (Revenda/Fabricante), Disponibilidade de Compra/Venda e Evidência Técnica.
* **Comportamento Visual:** Estes campos continuam totalmente editáveis, independentemente do vínculo com o Material Master, pois pertencem unicamente ao tenant.

## 4. Preservação da Persistência Atual
* A lógica do botão de salvar (`handleSave`) foi atualizada para incluir e repassar o `materialId` existente, garantindo que o vínculo `products.material_id -> materials.id` não seja sobrescrito com `undefined` durante edições.
* Nenhuma alteração foi feita nos arquivos de Repositório (`SupabaseProductRepository`) ou Entidades (`Product.ts`), minimizando os riscos e cumprindo o escopo estrito e incremental definido para a Fase 4C.2.

## 5. Testes Realizados (Validação Conceitual e de Build)
1. **Edição de Produto Vinculado:** Os campos globais ficam desabilitados para edição. A preservação do `materialId` ao salvar foi assegurada.
2. **Criação de Novo Produto:** O modal permite o preenchimento dos campos globais.
3. **Build e Compilação:** `npm run build` validado sem erros relacionados aos estados de `materialId`.
4. **Isolamento Tenant:** A ausência de alterações nas classes de domínio/repositório garante que a visualização de 57 itens continue intacta.

## 6. Próximos Passos (Fase 4C.3)
Na próxima fase, o foco será alterar o fluxo de criação de **novos itens** para que o usuário busque ativamente em `public.materials` antes de criar um novo produto privado. Se o material global existir, o formulário de criação já será preenchido e bloqueado com os dados globais.
