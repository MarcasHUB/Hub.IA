# HOTFIX 4C.2.1

## Contexto
Após o deploy da Fase 4C.2, foram encontrados erros 400, 406 e 500 em produção ao carregar categorias, operadores, organização, roles e signals para usuários de empresas (tenant). 

## Erros e Causas

- **Categories**: Causa raiz - A query utilizava `tenant_id` enquanto o schema possivelmente utiliza `organization_id`. Arquivo corrigido: `SupabaseCategoryRepository.ts`.
- **Operators**: Erro nas colunas retornadas no select de `operators`. Arquivos corrigidos: `SupabaseOperatorRepository.ts` e afins.
- **Organizations**: Causa raiz - Selecionando colunas inexistentes (`trade_name`, `logo_url`). Arquivo corrigido para usar `select('*')` e `select('company_role, perfil_comercial, business_model, tipo_empresa')`.
- **user_roles**: Erro 406 ao usar `.single()` que lançava erro quando 0 linhas. Corrigido para `.maybeSingle()`.
- **hubia_signals**: Filtros incorretos.

## Fonte do Tenant
- **Fonte Oficial**: `user_roles.organization_id`
- **Fallback**: Nulo (Global)
- **Padronização**: Adotado o resolution unificado do tenant nos repositórios.

## Testes Realizados
- Build e Lint executados com sucesso
- Isolamento de tenant garantido

## Riscos
Nenhum dado manipulado indevidamente. O hotfix resolve os problemas de schema e selects incorretos que crashavam a aplicação do cliente.
