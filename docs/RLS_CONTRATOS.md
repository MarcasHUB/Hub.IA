# SEGURANÇA E RLS: MÓDULO DE CONTRATOS

## Organização Compradora
As policies das tabelas `contracts` e `contract_items` são regidas primariamente por:
`organization_id = public.current_org_id()`

Isso garante que um Comprador logado visualize e opere 100% dos seus contratos internamente. 

## Organização Fornecedora
Quando o contrato possuir um `supplier_organization_id` válido e estiver ativo (status `active`, `expired`, `closed`), o RLS liberará a visualização para os usuários cujo `current_org_id()` seja o fornecedor logado.
No entanto, o Fornecedor **não deverá** alterar o contrato diretamente através da tabela. Ele participa por aprovação ou assinaturas que, em última instância, acionam functions (backend) seguras.

## ADM GLOBAL
Acesso a nível de linha garantido (quando em operação restrita/suporte) através de `is_platform_admin()`. 
*Aviso*: A política padrão do Supabase não deve liberar SELECT universal com `is_platform_admin() = true` sob o risco de vazamento involuntário de preços em relatórios gerais. O acesso aos dados transacionais (Preços, Quantidades) do ADM Global deve se dar de modo cirúrgico (RPC functions) e sempre acompanhado de log inquebrável, exceto para painéis analíticos que mascarem a identidade nominal do contrato.

## Segregação de Papéis e Permissões Internas (App Layer)
Dentro da mesma organização, será necessária a separação entre Operador Comum e Gestor. Como o RLS geralmente atua ao nível do Tenant, o bloqueio de "Inserção/Atualização" para um usuário que não seja "Aprovador/Manager" será administrado via validação de roles no Backend/Frontend ou Functions (ex: `user_has_role('contract_manager')`).
