# FASE 4C.3 — Identificação e Vinculação ao Material Master

## Objetivo
Esta fase altera a ordem do fluxo de cadastro de materiais para garantir que a identificação e o vínculo ao Material Master aconteçam antes do preenchimento dos dados internos da empresa, evitando duplicidades.

## Fluxo Aprovado
Novo Material
    ↓
Código do Fabricante
    ↓
Pesquisa no Catálogo Global
    ├── Encontrado
    │      ↓
    │  Confirmar Material
    │      ↓
    │  Vincular material_id
    │      ↓
    │  Preencher dados internos
    │
    └── Não encontrado
           ↓
       Confirmar novo cadastro
           ↓
       Preencher dados globais
           ↓
       Criar Material Pendente
           ↓
       Vincular material_id
           ↓
       Preencher dados internos

## Estados da Interface
- Aguardando Código do Fabricante
- Pesquisando no Catálogo Global
- Material encontrado
- Múltiplos materiais encontrados
- Material não encontrado
- Material selecionado
- Material Global Pendente
- Erro ao pesquisar
- Sem permissão

## Estratégia de Busca
1. Prioridade: Código do Fabricante exato
2. Prioridade: Fabricante + Código do Fabricante
3. Prioridade: Código normalizado
**Debounce**: Utilizar debounce entre 500ms e 800ms. Não pesquisar por strings muito curtas e nunca associar automaticamente por nome.

## Regras de Vínculo
A vinculação só ocorrerá mediante seleção e confirmação explícita do usuário. Não utilizar vinculação baseada apenas em semelhança nominal. Os campos globais ficam desabilitados após o vínculo e é retornado a tag "Catálogo Global".

## Regras de Criação Pendente
Ao não encontrar, permite cadastrar um novo material, mantendo o Código do Fabricante inserido inicialmente. A criação gera um "Material Master" com status de "pendente" que deve ser aprovado por curadoria no futuro.

## Separação Global vs Privado
- Dados globais (Nome, Fabricante, Categoria Global, Descrição, etc)
- Dados privados (Código Interno da Empresa, tags de compra/venda, Categoria Local)

## Critérios de Aceite
- [ ] Código do Fabricante solicitado primeiro
- [ ] Busca em `public.materials` com debounce 500-800ms
- [ ] Possibilidade de vincular `material_id` caso encontrado
- [ ] Material inexistente libera cadastro apenas após confirmação
- [ ] Código inicial preservado
- [ ] O produto privado continua filtrado por tenant
- [ ] Não são criadas duplicidades determinísticas
- [ ] Usuário comum não altera Material Master Global validado

**A Fase 4C.3 não foi implementada durante o Hotfix 4C.2.1. O fluxo foi apenas definido e documentado para execução posterior.**
