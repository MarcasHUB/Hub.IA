# Database

Regras: Multi-tenant, Soft Delete, UUID v7, Auditoria, RLS, Versionamento, Timezone UTC, Timestamps automáticos.

## Persistência de Homologação (Front-end)
Durante a fase de testes e homologação sem backend real conectado, os dados reais inseridos pelo usuário (produtos, colaboradores, cotações, logo e configurações da empresa) são persistidos e sincronizados no **localStorage** do navegador do cliente. As principais chaves são:
- `supplyhub_products`
- `supplyhub_sent_quotations`
- `supplyhub_colaboradores`
- `supplyhub_company_name` / `supplyhub_company_logo`
- `supplyhub_logged_operator`