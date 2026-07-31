# PLANO INTEGRADO — MATERIAIS, FORNECEDORES E CONTRATOS

## 1. Arquitetura atual encontrada
O ecossistema Hub.IA encontra-se na transição entre cadastros locais de produtos e o catálogo global de materiais (Material Master).
Atualmente:
- Há separação incipiente entre `materials` (Catálogo Global) e `products` (Catálogo Privado).
- O HOTFIX 4C.2.1 sanou os gargalos de tenant (`organization_id`) e uso inadequado de Single() nas roles.
- `suppliers` tem papel dúbio entre organização da rede e fornecedor privado.

## 2. Dependências
Para que o Módulo de Contratos (5A) seja funcional, as seguintes premissas devem ser atendidas:
1. Material Master totalmente funcional, sem duplicidades (4C.3 e 4C.4).
2. Rede de Negócios (Suppliers vs Organizations) clarificada (4C.5).
3. Unificação e higienização das FKs de `organization_id`.

## 3. Fases
- **Fase 4C.3:** Identificação e Vinculação ao Material Master
- **Fase 4C.4:** Catálogo Privado da Empresa
- **Fase 4C.5:** Fornecedores, Parceiros e Material
- **Fase 4C.6:** Base para o Módulo de Contratos
- **Fase 5A:** Módulo de Contratos (Dividido de 5A.1 a 5A.8)

## 4. Riscos
- Risco de corrupção do multi-tenancy caso o ADM Global receba permissões indevidas na modelagem de contratos.
- Duplicidade de materiais (mitigado pelo fluxo de busca prévia).
- Desalinhamento entre o fornecedor local/privado e o parceiro conectado na rede.

## 5. Ordem de Implementação
A execução deve respeitar de forma estrita o `ROADMAP_FASES_4C_3_A_5A_8.md`. Nenhuma fase posterior de Contratos deverá começar sem que as fundações de Materiais estejam homologadas e em produção.

## 6. Critérios de Aceite
- [ ] Material Master possui chave única protegendo fabricante e código.
- [ ] Empresas não podem alterar catálogo global, apenas o privado (`products`).
- [ ] O Módulo de Contratos funciona integralmente sobre entidades existentes (Materiais e Fornecedores/Organizações).
- [ ] RLS preservado em todas as tabelas, impedindo vazamento de contratos.

## 7. Pontos de Decisão
- Definir como `suppliers` será tratado (espelho ou entidade real). Recomendação: usar `organizations` conectados via `organization_connections` para rede de negócios, e `suppliers` apenas para cadastros privados de fornecedores não integrados ao Hub.
