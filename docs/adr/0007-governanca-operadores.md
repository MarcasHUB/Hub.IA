# ADR 0007: Governança de Operadores, Segmentação e Controles da Empresa

## Status
Aprovado

## Contexto
O SupplyHub B2B necessita de uma estrutura robusta de controle de acesso, divisão de responsabilidades e auditoria. A empresa (Tenant) em si não realiza ações; as ações são realizadas pelos seus operadores (usuários humanos). Estes operadores necessitam de perfis de acesso (Administrador, Gestor, Comprador, Consulta), status operacionais específicos (Ativo, Pendente, Inativo, Bloqueado, Férias, Substituído) e segmentação por categorias de suprimentos (EPIs, Motores, Bombas, etc.). Esta divisão serve não apenas para controle de permissões, mas também para alimentar os modelos futuros de inteligência da Hub.IA (saving por segmento, alertas automáticos, etc.).

## Decisão
Decidimos por:
1. Criar a estrutura física de banco de dados multi-tenant composta por tabelas dedicadas: `operators`, `segments`, `operator_segments`, `operator_invitations`, `delegations`, `operator_sessions`, `access_logs`, `operation_logs`, `hubia_signals` e `supplier_segments`.
2. Remover os campos de convite (`invite_token` e `invite_expires_at`) da tabela `operators`, centralizando o fluxo de convites unicamente na tabela `operator_invitations` para manter uma única fonte de verdade.
3. Tornar o vínculo a **Segmento** estritamente obrigatório no cadastro de novos **Produtos** e **Fornecedores** (com pelo menos um segmento no caso de fornecedores).
4. Implementar o menu principal **Minha Empresa** como a central de governança, contendo abas e visualização para Dados da Empresa, Operadores, Segmentos, Delegações Temporárias e Logs de Auditoria.
5. Manter a separação de escopos onde o Supabase Auth cuida apenas da identidade de login (email/senha/recuperação) e o banco de dados do SupplyHub cuida do ciclo de vida de operadores, permissões, perfis, logs e inteligência.

## Consequências
- A Hub.IA ganha uma base contextual estruturada de quem comprou o quê, quais operadores respondem por quais categorias, e qual a taxa de engajamento do time.
- Implementação de segurança aprimorada com controle de sessão única por operador e logs rastreáveis de auditoria.
- A governança fica simplificada e exposta diretamente no painel "Minha Empresa" para o gestor.
