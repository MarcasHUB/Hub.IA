# ADR-0004: Rede de Empresas, Central de Notificações e Dual-Role de Cotações

**Data:** 2026-07-11  
**Status:** Aceito  
**Autor:** SupplyHub.IA Engineering Team

---

## Contexto

O sistema precisava evoluir de um cadastro estático de fornecedores para uma **rede dinâmica de parceiros B2B** onde empresas podem se conectar, trocar cotações e ser notificadas de eventos relevantes em tempo real.

Três decisões foram tomadas de forma integrada nesta sprint:

1. **Rede de Empresas** — substituição da lista estática de fornecedores por um diretório de empresas com sistema de conexão (convites)
2. **Central de Notificações** — sistema de alertas in-app acionados por eventos de domínio
3. **Dual-role de Cotações** — separação explícita entre empresas que **compram** (enviam RFQs) e empresas que **vendem** (recebem RFQs e respondem)

---

## Decisão

### 1. Modelo de Dados para Rede de Empresas

Criadas duas tabelas:

- `companies`: Diretório público de empresas na plataforma (leitura pública, escrita restrita ao proprietário)
- `connection_requests`: Tabela de vínculos bidirecionais com status `pending | accepted | rejected | canceled`

**Regra de negócio:** Uma empresa aparece em "Meus Parceiros → PARCEIROS" apenas se o status for `accepted`. Se `pending`, aparece em "AGUARDANDO". Ao cancelar, o registro vai para `canceled` e a empresa volta a ser visível na Rede de Empresas.

### 2. Central de Notificações

Tabela `notifications` com:
- `type`: enum com 8 tipos de evento
- `is_read`: flag para contagem de badge
- `action_url`: deep link direto para o contexto do evento
- `metadata`: JSONB para dados adicionais

**Triggers automáticos de banco de dados** acionam inserções na tabela `notifications` quando:
- Um `connection_request` é inserido → notifica org alvo
- Um `connection_request` muda para `accepted` → notifica quem enviou
- Um `supplier_quotation` é inserido → notifica fornecedor (para vender)
- Um `supplier_quotation` muda para `Sent` → notifica comprador (proposta recebida)

**Frontend:** `NotificationContext` com estado global, mock data para dev, integração Supabase ativada automaticamente quando `auth.getUser()` retorna usuário real.

### 3. Dual-Role de Cotações

A tela "Minhas Cotações" foi dividida em duas abas:
- **COTAÇÕES ENVIADAS**: cotações que a empresa criou como compradora (RFQs)
- **COTAÇÕES RECEBIDAS**: cotações que a empresa recebeu como fornecedora (para responder e vender)

Esta separação resolve a ambiguidade de uma empresa poder atuar dos dois lados da transação na mesma sessão.

### 4. E-mail Transacional (Edge Function)

Criada a Edge Function `send-quotation-email` com 3 templates HTML responsivos:
- `quotation_sent_to_supplier`: notifica fornecedor sobre nova RFQ
- `quotation_response_received`: notifica comprador sobre nova proposta
- `connection_invite`: e-mail de convite de parceria

O bloco de envio está comentado, aguardando ativação de provedor de e-mail (Resend recomendado).

---

## Consequências

**Positivas:**
- Experiência B2B completa: comprar E vender pela mesma plataforma
- Notificações em tempo real prontas para Supabase Realtime
- E-mail transacional estruturado, pronto para ativação com 1 chave de API
- UX consistente: cada evento de domínio gera sua notificação correspondente

**Negativas / Tradeoffs:**
- Mocks de dados mantidos até conexão real do Supabase Auth
- Triggers de banco exigem `organization_id` preenchido nos `users`, o que depende do fluxo de onboarding (ainda pendente)

---

## Alternativas Consideradas

| Alternativa | Motivo da Rejeição |
|-------------|--------------------|
| Usar Supabase Realtime direto (sem tabela notifications) | Sem persistência histórica; usuário não veria notificações antigas ao voltar |
| Polling periódico em vez de triggers | Latência alta e desperdício de recursos |
| Separar comprador/fornecedor em tipos de conta | Limita flexibilidade; uma empresa pode ser os dois |
