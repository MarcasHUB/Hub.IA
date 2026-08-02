# AUDITORIA DE CONTRATOS

A auditoria sobre o Módulo de Contratos e Itens é central para o compliance B2B. As ações realizadas nas tabelas `contracts` e `contract_items` nunca sofrerão "alterações silenciosas" sem versionamento na auditoria base.

## O Papel do Trigger
O Supabase utilizará um Database Trigger anexado a ambas as tabelas:
- **Evento**: `AFTER INSERT, UPDATE, DELETE`.
- **Ação**: Invocação da function transacional `log_contract_changes()`.

## O que será logado?
A function irá injetar na tabela `audit_logs`:
1. `record_id`: O UUID do contrato ou item.
2. `table_name`: 'contracts' ou 'contract_items'.
3. `action_type`: 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE'.
4. `old_data` e `new_data`: Payload JSONB gerado via `row_to_json(OLD)` e `row_to_json(NEW)`.

## Acesso Excepcional (Break-Glass) Administrativo
Quando uma intervenção de ADM GLOBAL ocorrer para corrigir um valor falho (por bug sistêmico), a action não será um mero UPDATE no SQL Client. O sistema forçará a adoção de um RPC (`admin_correct_contract`), que exige a assinatura do Operador, Inserção Motivo Obrigatório ("Chamado 4014 - Correção de Banco") e disparará um log especial em `audit_logs` (ou similar) classificado como `ADMIN_OVERRIDE`.

## Proteção Imutável
A própria tabela `audit_logs` deve ter as permissões de UPDATE e DELETE absolutamente revogadas para qualquer usuário `authenticated`. Somente o superset de logs da infra e o role service_role podem inserir, para garantir trilha limpa.
