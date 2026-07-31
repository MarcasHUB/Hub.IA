# ROADMAP INTEGRADO (FASES 4C.3 a 5A.8)

## Ordem de Execução e Dependências

### PREPARAÇÃO (Bloqueantes Resolvidos)
1. **HOTFIX 4C.2.1**
   - **Status**: Concluído
   - **Entregável**: Tenants estabilizados.

### FUNDAÇÕES (Catálogo e Materiais)
2. **Fase 4C.3 — Identificação do Material Master**
   - **Objetivo**: Priorizar `Código do Fabricante` na busca; evitar duplicidade; debounce.
3. **Fase 4C.4 — Catálogo Privado**
   - **Objetivo**: Concluir o vínculo entre Material Master e Produtos da empresa (`Código Próprio`).
4. **Fase 4C.5 — Materiais e Fornecedores**
   - **Objetivo**: Vincular organizações/suppliers aos materiais (quem fornece o quê).
5. **Fase 4C.6 — Preparação para Contratos**
   - **Objetivo**: Auditoria técnica das tabelas de parceiros e cotações para receber FKs de contratos.

### MÓDULO DE CONTRATOS (5A)
6. **Fase 5A.1 — Auditoria do módulo de Contratos**
   - **Objetivo**: O presente escopo (já entregue via estes documentos).
7. **Fase 5A.2 — Contrato base**
   - **Objetivo**: Cabeçalho, Partes, CRUD de Rascunho, Status.
8. **Fase 5A.3 — Itens e materiais**
   - **Objetivo**: Inserção de itens (referenciando `products`), quantidades, preços básicos.
9. **Fase 5A.4 — Documentos e aprovações**
   - **Objetivo**: Upload Supabase Storage, fluxos de aprovação usando Event Bus.
10. **Fase 5A.5 — Preços, saldos e aditivos**
    - **Objetivo**: Versionamento de preço (faixas de vigência), histórico de aditivos não-destrutivos.
11. **Fase 5A.6 — Integração com cotações**
    - **Objetivo**: Tela de RFQ passa a sugerir preços baseados em contratos vigentes.
12. **Fase 5A.7 — Integração com pedidos**
    - **Objetivo**: Geração de consumo contratual transacional, baixa de saldo automática.
13. **Fase 5A.8 — Dashboard e inteligência**
    - **Objetivo**: Indicadores gerenciais, alertas de renovação. IA assistiva (planejamento futuro).

## Critérios de Entrada / Saída
- **Entrada Geral (5A):** Material Master em produção (4C completada).
- **Saída Geral (5A):** Fluxo E2E homologado em staging sem tocar nas políticas globais.

## Pontos de Autorização
Avanços de 5A dependem expressamente da revisão de arquitetura (apresentada no Doc 2 e Doc 4) e autorização humana de DBA/Arquiteto-chefe para criar as migrations em `supabase/migrations`.
