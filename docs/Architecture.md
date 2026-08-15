# Architecture

Documentação da arquitetura.
# Isolamento de identidade B1-R.1

O contexto autenticado é a única origem de `organization_id`. Rotas e repositories podem receber UUIDs de destino, mas nunca um UUID de origem como autoridade. O perfil privado é obtido por RPC sem argumento; perfis de rede e administração global usam projeções/RPCs separadas. A matriz de capabilities em `src/core/config/permissions.ts` controla apenas a renderização, enquanto RLS e RPCs fazem a autorização final. A decisão completa está registrada na ADR 0012.
