# Fase 4B: Material Master & Catalog (Concluída)

## 1. Arquitetura Final

Esta fase consolida a separação conceitual e física entre:

*   **`public.materials` (Material Master Global):** Representa o catálogo global da plataforma SupplyHUB. Contém as definições canônicas dos materiais (nome oficial, fabricante, código do fabricante). É governado pela curadoria global (Platform Admins) e compartilhado anonimamente ou explicitamente entre os tenants quando validado.
*   **`public.products` (Catálogo Privado):** Representa o portfólio interno de um Tenant (Organização). Contém os SKUs internos, preços, controle de estoque e descrições personalizadas.

### 1.1 Vínculo Oficial
O único vínculo físico autorizado entre as duas entidades é:
`public.products.material_id REFERENCES public.materials(id)`

Não foi e não será criada a coluna `material_master_id`.

## 2. Governança e Regras de Negócio

### 2.1 Constraint `materials_manufacturer_code_pair`
A constraint garante integridade lógica na identificação de um material masterizado:
```sql
CONSTRAINT "materials_manufacturer_code_pair" CHECK (
  (((manufacturer_id IS NULL) AND (manufacturer_code IS NULL)) OR 
   ((manufacturer_id IS NOT NULL) AND (manufacturer_code IS NOT NULL)))
)
```
- Apenas materiais com um `manufacturer_id` validado/cadastrado podem possuir um `manufacturer_code`.
- Materiais sem fabricante definido devem manter ambos nulos.

### 2.2 Normalização Determinística
Para evitar duplicidades, o sistema agora normaliza automaticamente chaves de busca através da função `public.normalize_text_key()`.
- Nomes de fabricantes e materiais: `lower(trim(regexp_replace(unaccent(...))))`.
- Códigos de fabricantes: `BTRIM(UPPER(code))` para preservação de hifens e formatações exatas, porém insensíveis a capitalização e espaços laterais.

### 2.3 Resolução de Manufacturers
Durante o backfill, o sistema busca um `manufacturer_id` na tabela `manufacturers` comparando o nome normalizado. Se não encontrar, ele cria (upsert determinístico) antes de processar a união do material.

### 2.4 Status de Curadoria (Enum)
A enumeração `material_validation_status` suporta:
- `pending_review` (pendente)
- `needs_correction` (correção solicitada)
- `validated` (aprovado)
- `rejected` (rejeitado - NOVO)
- `merged` (mesclado - NOVO)

(O estado inativo é controlado pela coluna booleana `is_active = false`).

### 2.5 Trigger de Proteção (RLS e Curadoria)
A curadoria é estritamente protegida pela função `protect_material_admin_fields()`, invocada em um trigger `BEFORE INSERT OR UPDATE`. Usuários comuns (`authenticated`) não podem:
- Criar materiais com status diferente de `pending_review`.
- Alterar campos administrativos (status, reviewed_by, merged_into, master_owner).
- Mudar a visibilidade de materiais.
Somente `Platform Admin` ou `Super Admin` possuem essa permissão.

### 2.6 RLS (Row Level Security)
- **SELECT:** Usuários autenticados acessam materiais `validated` e ativos, e os seus próprios `pending_review`.
- **INSERT:** Tenants inserem materiais atrelados às suas orgs, forçadamente como `pending_review`.
- **UPDATE:** Tenants editam apenas os próprios materiais que estejam em revisão/correção.
- **DELETE:** Restrito a administradores, protegidos por `ON DELETE RESTRICT` via FK de produtos.

## 3. Lógica do Backfill e Matriz C1-C10

As regras de match para produtos pré-existentes (`material_id IS NULL`) garantem idempotência perfeita:

1. **A. Já Preenchido:** Intocado.
2. **B. Fabricante + Código:** É a chave preferencial. Se encontrar um único material com essa combinação normalizada, vincula. Se zero ou múltiplos, cria um novo `pending_review`. Produtos de orgs distintas com o mesmo fabricante e código apontarão para o mesmo material. (Cenários C2 e C3).
3. **C. Código Sem Fabricante:** Busca por código. Se único, vincula (C6). Se ambíguo ou inexistente, cria um novo sem código e sem fabricante, mantendo os metadados apenas no produto (C7).
4. **D/E. Apenas Nome ou Vazio:** Cria um material isolado novo `pending_review` (C4, C5, C8). O nome nunca é usado para unificar automaticamente, evitando falsos positivos.

## 4. Métricas e Idempotência

O backfill foi executado localmente de forma isolada do ambiente de produção (C1-C10 validados por fixtures).

### Métricas Obtidas
*   **Total de Produtos na base de testes:** 11
*   **Fabricantes criados:** 5
*   **Materiais (Master):** 17
*   **Produtos unificados no Backfill:** 100% dos produtos zeraram a fila de `material_id IS NULL`.

A idempotência foi provada rodando a Procedure uma segunda vez:
*   **Novas inserções/updates:** 0

### Pré-Validação Remota (Somente Leitura)
*   **Produtos no Supabase Produção:** 69
*   **Produtos sem fabricante (metadata):** 65
*   **Produtos sem manufacturer_code:** 69
Não haverá ambiguidade de conflito ou código duplicado quando a procedure for aplicada remotamente, devido à ausência atual de `manufacturer_code` nos registros reais.

## 5. Riscos Restantes e Próximos Passos (Fase 5)
- **Migração Remota:** O deploy (push) está explicitamente paralisado nesta documentação até aprovação executiva.
- A **Fase 5** deverá implementar as interfaces frontend de aprovação e governança global (Painel do Platform Admin para a curadoria).
