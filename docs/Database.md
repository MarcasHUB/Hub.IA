# Modelagem de Banco de Dados — Governança e Operadores (Sprint 12B)

Regras: Multi-tenant, Soft Delete, UUID v7/v4, Auditoria, RLS, Versionamento, Timezone UTC, Timestamps automáticos.

## Persistência de Homologação (Front-end)
Durante a fase de testes e homologação sem backend real conectado, os dados reais inseridos pelo usuário (produtos, colaboradores, cotações, logo e configurações da empresa) são persistidos e sincronizados no **localStorage** do navegador do cliente. As principais chaves são:
- `supplyhub_products`
- `supplyhub_sent_quotations`
- `supplyhub_operators_v2` (Operadores da governança)
- `supplyhub_segments_v2` (Segmentos cadastrados)
- `supplyhub_company_name` / `supplyhub_company_logo`
- `supplyhub_logged_operator`

---

## Estrutura Física de Tabelas (Supabase / PostgreSQL)

### 1. `organizations` (Ampliação)
Guarda as informações do Tenant/Empresa.
- `razao_social` (text): Razão social jurídica.
- `nome_fantasia` (text): Nome fantasia público.
- `cnpj` (text): CNPJ formatado da empresa.
- `email_corporativo` (text): E-mail de contato principal para comunicados e convites.
- `telefone` (text): Telefone institucional.
- `gestor_principal_id` (uuid FK -> operators): Operador que atua como gestor principal da conta.

### 2. `operators`
Representa os operadores humanos vinculados a uma empresa.
- `id` (uuid PK): Identificador único.
- `organization_id` (uuid FK -> organizations): Vínculo com a empresa (multi-tenant).
- `nome` (text), `sobrenome` (text): Nome do colaborador.
- `email` (text): E-mail exclusivo do operador.
- `telefone` (text), `cargo` (text): Contato e função corporativa.
- `perfil` (enum: `administrador`, `gestor`, `comprador`, `consulta`): Perfil de acesso.
- `status` (enum: `pendente`, `ativo`, `inativo`, `bloqueado`, `ferias`, `substituido`): Situação atual.
- `gestor_id` (uuid FK -> operators): Gestor hierárquico responsável.
- `invited_at`, `accepted_at`, `last_login_at`, `last_activity_at` (timestamptz): Timestamps de ciclo de vida e atividade.

### 3. `segments`
Segmentos ou categorias de compras/suprimentos cadastrados por empresa.
- `id` (uuid PK): Identificador único.
- `organization_id` (uuid FK -> organizations): Isolamento de tenant.
- `nome` (text): Nome da categoria (ex: EPI, Uniformes, Bombas).
- `descricao` (text): Detalhes sobre a categoria.
- `status` (text: `ativo`, `inativo`): Situação do segmento.
- `responsavel_id` (uuid FK -> operators): Responsável principal por este segmento.

### 4. `operator_segments`
Tabela de junção N:N associando operadores aos segmentos que eles podem gerenciar ou visualizar.
- `operator_id` (uuid FK -> operators)
- `segment_id` (uuid FK -> segments)
- `todos_segmentos` (boolean): Flag que, se verdadeira, concede acesso a todos os segmentos automaticamente.

### 5. `operator_invitations`
Controle de convites enviados para novos operadores. É a única fonte de verdade para o fluxo de ativação de conta.
- `id` (uuid PK)
- `organization_id` (uuid FK -> organizations)
- `invited_by_id` (uuid FK -> operators): Operador que gerou o convite.
- `email` (text): E-mail do convidado.
- `nome` (text): Nome do convidado.
- `cargo` (text), `perfil` (operator_perfil): Atributos do cargo/perfil a serem aplicados no aceite.
- `token` (text UNIQUE): Hash SHA-256 do link de convite.
- `status` (enum: `pendente`, `aceito`, `expirado`, `cancelado`): Status do convite.
- `segment_ids` (uuid[]): Lista de IDs de segmentos vinculados ao convite.
- `sent_at`, `expires_at`, `accepted_at` (timestamptz)
- `ip_aceite`, `user_agent_aceite` (text): Rastreabilidade do aceite.

### 6. `delegations`
Controle de substituições temporárias de operadores (férias, licenças).
- `operador_origem_id` (uuid FK -> operators)
- `operador_substituto_id` (uuid FK -> operators)
- `data_inicio`, `data_fim` (date): Período da delegação.
- `status` (enum: `ativa`, `encerrada`, `cancelada`)
- `segmentos_espelhados`, `permissoes_espelhadas` (boolean): Configurações de espelhamento de direitos.

### 7. `operator_sessions`
Rastreamento de conexões para garantia de sessão única por operador.
- `operator_id` (uuid FK -> operators)
- `token_hash` (text): Hash identificador do token da sessão.
- `status` (enum: `ativa`, `encerrada`, `expirada`)

### 8. `access_logs`
Logs de auditoria de login/logout/bloqueios.
- `operator_id` (uuid FK -> operators)
- `tipo` (enum: `login`, `logout`, `tentativa_falha`, `bloqueio`)
- `resultado` (text: `sucesso`, `falha`)

### 9. `operation_logs`
Trilha de auditoria detalhada de alterações de dados.
- `operator_id` (uuid FK -> operators)
- `entidade` (text): Nome da entidade modificada (ex: `produto`, `cotacao`).
- `acao` (text): Ação efetuada (`criou`, `editou`, `cancelou`, `aprovou`).
- `payload_antes`, `payload_depois` (jsonb): Diferença de estados.

### 10. `hubia_signals`
Alertas e notificações automáticas geradas pela inteligência artificial baseada em operadores e segmentos.
- `tipo_sinal` (enum: `oportunidade_saving`, `novo_fornecedor`, `cobertura_insuficiente`, `operador_inativo`, `convite_pendente`, `tendencia_mercado`)
- `descricao` (text): Mensagem do sinal.
- `dados` (jsonb): Metadados complementares do sinal.
- `lido` (boolean): Flag de leitura.