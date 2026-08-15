# ADR 0011 — Identidade canônica e RPCs de parceria

## Status

Aceita em 2026-08-14.

## Contexto

Os fluxos de autenticação, convites de operadores e parcerias derivavam a organização ativa de fontes concorrentes: `localStorage`, metadados editáveis do usuário, `profiles`, `operators` e `user_roles`. Algumas telas também escreviam diretamente em `connection_requests`. Isso permitia divergência de tenant, contorno do fluxo de aprovação e tratamento inconsistente de tokens.

## Decisão

- A identidade operacional é resolvida no PostgreSQL por `private.current_identity()`, exigindo alinhamento entre `profiles`, operador ativo e papel no mesmo tenant.
- O frontend obtém o contexto por `get_current_identity_context()`. O `localStorage` é apenas cache visual e nunca autoridade para autorização ou escopo de consultas.
- Criação, aprovação, resposta, cancelamento e encerramento de parcerias passam por RPCs `SECURITY DEFINER` com `search_path` fixo, privilégios mínimos e tenant derivado de `auth.uid()`.
- Convites de operador persistem somente SHA-256. O token bruto existe apenas durante a criação/rotação e é devolvido ao chamador autenticado para entrega ao destinatário.
- As Edge Functions autenticadas validam o JWT com `auth.getUser()` e não aceitam `organization_id` ou `invited_by_id` do navegador como fonte de autoridade.
- Convites públicos validam formato, expiração e hash; dados de rede e credenciais não são expostos.

## Consequências

- Relações inconsistentes entre `profiles`, `operators` e `user_roles` passam a falhar de forma fechada e exigem saneamento explícito.
- Escritas diretas em `connection_requests` por clientes autenticados são revogadas.
- O fluxo de comprador exige aprovação interna antes de ficar visível ao tenant destinatário; administradores podem solicitar diretamente.
- Empresas já cadastradas recebem solicitações por `connection_requests`, identificadas pelo UUID de destino; `invitations`, token e onboarding são exclusivos para empresas comprovadamente externas.
- A decisão entre conexão e onboarding é excludente e falha de forma fechada quando a busca por CNPJ falha, está incompleta ou retorna resultado ambíguo.
- Administradores e gestores ativos do tenant destinatário podem aceitar ou rejeitar solicitações e recebem a notificação correspondente. Compradores podem iniciar solicitações, sempre sujeitas à aprovação interna de administrador.
- Testes SQL transacionais cobrem isolamento de tenant, autoconexão, aceite bilateral e ciclo do convite sem persistir fixtures.
- A cadeia histórica de migrations ainda contém correções dependentes de dados específicos e precisa de saneamento separado para permitir replay integral em banco vazio.
