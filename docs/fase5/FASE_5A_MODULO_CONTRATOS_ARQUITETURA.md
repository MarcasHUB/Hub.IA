# FASE 5A — MÓDULO DE CONTRATOS (ARQUITETURA)

## 1. Escopo
O módulo gerenciará contratos comerciais/fornecimento, integrados com a Rede de Negócios, Materiais, Fornecedores, Cotações e Pedidos.
Não abrangerá áreas fiscais, contábeis, de estoque físico ou pagamentos, atuando estritamente na governança da negociação B2B.

## 2. Fluxos
1. **Elaboração:** Criação do Rascunho → Definição de Partes → Inclusão de Itens e Valores.
2. **Aprovação:** Submissão → Aprovação (com regras de alçada) → Assinatura/Ativação.
3. **Consumo:** Associação a Pedidos e RFQs → Dedução de Saldo (quantidade ou valor) → Gatilho de Alertas (Threshold).
4. **Encerramento:** Aditivo de renovação ou Encerramento / Cancelamento.

## 3. Entidades (Lógico)
- **Contrato Base:** Cabeçalho, Partes (Comprador/Fornecedor), Vigência, Valores Globais.
- **Itens do Contrato:** Material ou Serviço, Quantidade, Valor Unitário, Vigência Específica, Faixas de Preço.
- **Documentos:** Anexos (PDFs, minutas), versionados via Supabase Storage.
- **Aditivos e Histórico:** Versionamento para não corromper histórico ativo de preços anteriores.
- **Consumo:** Registro idempotente do vínculo com pedido/cotação.

## 4. Relacionamentos
- `organization_id` obrigatório (tenant principal).
- Contratante: FK para `organizations`.
- Contratado: FK para `organizations` (conectada) ou `suppliers` (privado).
- Itens: FK para `products` (Catálogo Privado) que faz ponte para `materials`.

## 5. Permissões e Perfis
Baseado em capabilities:
- `contract:read`, `contract:create`, `contract:approve`, `contract:amend`, `contract:consume`.
- O ADM GLOBAL não tem permissão para ler, aprovar ou modificar valores/condições, possuindo apenas acesso a logs técnicos e relatórios macro agregados (anonimizados onde aplicável).

## 6. Status
`draft` → `in_negotiation` → `pending_approval` → `approved` → `active` → `suspended` / `expired` / `closed` / `cancelled`.

## 7. Integrações
- **Cotações (RFQ):** Sugestão automática de fornecedores e preços previstos em contrato.
- **Pedidos:** Ao converter, abate saldo, salva snapshot do preço, invoca `Event Bus`.
- **Materiais:** Aba "Contratos" dentro do material exibe acordos vigentes.

## 8. Telas
1. Dashboard de Contratos (resumo, alertas, saldos, expiring).
2. Listagem (filtros robustos por vigência, parceiro e material).
3. Detalhes (Tabs: Visão Geral, Partes, Vigência, Itens, Preços, Consumo, Aprovações, Documentos, Aditivos, Histórico).

## 9. Notificações e Auditoria
- Via sistema de eventos (`Event Bus`) existente na Hub.IA. 
- Disparos: aprovações, threshold de saldo, vencimento, suspensão, criação de aditivo.
- Auditoria de todas as trocas de status.

## 10. RLS
- Tabelas restritas via policy `organization_id = (select organization_id from user_roles...)`.
- ADM Global não faz bypass em RLS de contratos.

## 11. Fases
(Ver `ROADMAP_FASES_4C_3_A_5A_8.md`)
