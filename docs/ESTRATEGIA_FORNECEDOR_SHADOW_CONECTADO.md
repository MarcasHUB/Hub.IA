# ESTRATÉGIA PARA FORNECEDOR SHADOW VS CONECTADO

## O Problema
Na Hub.IA, uma Organização compradora frequentemente precisa inserir um "Fornecedor" para atuar em pedidos ou contratos fechados no passado, antes de a outra empresa ingressar na plataforma Hub.IA.
Isso cria a tabela local/privada `suppliers` (Shadow).

Quando a outra parte efetivamente torna-se um tenant na plataforma (Tabela `organizations`), há a necessidade de transformar a referência da Compradora de local (`supplier_id`) para global conectada (`supplier_organization_id`).

## Estrutura no Módulo de Contratos
A tabela `contracts` foi modelada com flexibilidade estrita:
1. `supplier_id` (UUID Opcional)
2. `supplier_organization_id` (UUID Opcional)
3. Constraint `CHECK (supplier_id IS NOT NULL OR supplier_organization_id IS NOT NULL)`.

## A Conciliação (Transição)
A estratégia funcional para conciliação no futuro envolverá:
1. O Fornecedor Shadow é convidado via link (`supplier_invitations`).
2. O Fornecedor acessa/cria seu tenant Hub.IA (`organizations`).
3. Uma conexão B2B é firmada (`empresa_parceiros` / `connection_requests` atinge status "accepted").
4. O backoffice da Compradora roda a rotina "Associar Contrato ao Fornecedor Oficial".
5. Os contratos antigos sob `supplier_id` recebem UPDATE preenchendo o `supplier_organization_id`.

## Validação de Consistência (Alternativa Escolhida)
**Alternativa C (Validação de Banco + App)**
Durante a criação de um contrato onde ambos os IDs são informados, não usaremos uma tabela gigantesca de conciliação no momento do fechamento. A Aplicação no ato do envio garantirá que o `supplier_id` pertence a um registro de `empresa_parceiros` que referencie o `supplier_organization_id`. Uma trigger futura pode travar discrepâncias caso um Fornecedor Local seja indevidamente trocado para uma org alheia. Para a V1, a aplicação será o validador imediato da paridade antes do insert no Supabase, mas a consistência de banco (Constraint) só trava a obrigatoriedade lógica de existência.
