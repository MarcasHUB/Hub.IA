# ADR 0012 — Isolamento multi-tenant e RBAC canônico

## Status

Aceita em 2026-08-14 para o hotfix B1-R.1.

## Contexto

O tenant ativo ainda podia ser derivado de URL, `localStorage`, UUID sentinela ou da primeira linha de `user_roles`. A leitura ampla de `organizations`, policies permissivas e a duplicidade entre `profiles.is_super_admin` e `platform_admins` permitiam divergência entre a identidade exibida e a autoridade aplicada.

## Decisão

- O tenant de origem é sempre derivado de `auth.uid()` por `private.current_identity()` e pelo contexto autenticado.
- `/empresa` usa `get_my_organization_profile()` sem receber organização do navegador. `/empresa/:id` não é uma rota de perfil privado.
- Organizações de destino são expostas apenas por `get_public_organization_profile(target)` e `list_public_organizations()`, com projeções explícitas.
- Operadores do tenant são listados por `get_my_operators()`; repositories não escolhem tenant por membership arbitrária.
- `platform_admins` é a única autoridade global. A compatibilidade `is_super_admin()` consulta essa tabela e as telas globais usam RPCs administrativas dedicadas.
- Capabilities de frontend protegem a renderização das rotas críticas. RLS e RPCs permanecem a autoridade final.
- Policies conflitantes das tabelas críticas são removidas antes da criação de policies por operação. Escrita direta de logs por `anon` e `authenticated` é revogada.
- CNPJ recebe coluna normalizada somente com dígitos, índice único parcial e lock transacional antes de escrita.

## Consequências

- Cache visual pode permanecer no navegador, mas não participa de autorização, seleção de tenant ou construção de queries.
- Administrador de tenant não herda poderes globais; ADM Global não se torna membro implícito de outros tenants.
- Perfil público não reutiliza o payload privado da organização.
- Convites de operador retornam resposta externa neutra para conflitos de identidade e resolvem e-mail no backend.
- O replay local exige bootstrap explícito porque migrations históricas dependem de dados concretos, compartilham versões curtas e há arquivos SQL históricos malformados. Esses arquivos não são alterados por esta decisão.

## Validação

Os testes pgTAP de B1-R.1 exercitam API direta, RLS, perfis privado/público, cancelamento por papel, logs, autoridade global, CNPJ e grants das novas RPCs em PostgreSQL local.
