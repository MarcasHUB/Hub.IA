# ESTRATÉGIA DE ROLLBACK DA MIGRATION DE CONTRATOS

## Contexto de Risco
A migration de contratos introduz tabelas inteiramente novas (isentas de conflito destrutivo inicial) mas que, a partir do instante em que são povoadas e ligadas (FK) a cotações ou pedidos futuros, tornam-se âncoras inquebráveis do sistema de concorrência.

## Passo 1: Rollback Antes de Dados em Produção (Safe)
- Exclusão das Políticas (RLS):
  `DROP POLICY "Comprador ve seus contratos" ON public.contracts;`
- Exclusão dos Índices parciais e principais.
- `DROP TABLE public.contract_items CASCADE;`
- `DROP TABLE public.contracts CASCADE;`
- `DROP TYPE public.contract_status;`

## Passo 2: Rollback Pós-Uso em Produção (Risco Alto)
- Caso haja Cotações geradas com `contract_item_id` (assumindo futura integração), um simples `DROP TABLE CASCADE` destruirá a referência primária auditável de preço dessas negociações ou deixará colunas orfãs.
- **Estratégia Defensiva**: O Supabase não permite Down Migrations nativas tão fácil em pipelines normais de Continuous Deployment. Portanto, a estratégia de rollback de contratos após transações financeiras e comerciais é **Forward-Fix** (Migration de correção para frente) com inativação lógica.
- A exclusão via script manual jamais poderá utilizar `CASCADE` sem um backup e snapshot anterior de `quotation_items` envolvidos.
