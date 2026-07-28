# Inventário Técnico do Módulo de Organizações

## 1. Estrutura do módulo
```
application
domain
infrastructure
presentation
index.ts
application\services
application\services\MembershipService.ts
application\services\OrganizationService.ts
domain\entities
domain\repositories
domain\entities\Organization.ts
domain\entities\OrganizationMembership.ts
domain\repositories\IOrganizationMembershipRepository.ts
domain\repositories\IOrganizationRepository.ts
infrastructure\repositories
infrastructure\repositories\LocalStorageOrganizationMembershipRepository.ts
infrastructure\repositories\LocalStorageOrganizationRepository.ts
presentation\components
presentation\pages
presentation\components\CompanyProfileView.tsx
presentation\pages\AdminCompanyProfilePage.tsx
presentation\pages\MinhaEmpresaPage.tsx
presentation\pages\OrganizationsListPage.tsx
application
domain
infrastructure
presentation
index.ts
application\dto
application\services
application\use-cases
application\dto\SupplierDTOs.ts
application\services\ConnectionService.ts
application\services\InvitationService.ts
application\use-cases\CreateSupplierUseCase.ts
domain\entities
domain\repositories
domain\entities\NetworkRequest.ts
domain\entities\OrganizationConnection.ts
domain\entities\Supplier.ts
domain\entities\SupplierInvitation.ts
domain\repositories\INetworkRequestRepository.ts
domain\repositories\IOrganizationConnectionRepository.ts
domain\repositories\ISupplierInvitationRepository.ts
domain\repositories\ISupplierRepository.ts
infrastructure\repositories
infrastructure\repositories\LocalStorageOrganizationConnectionRepository.ts
infrastructure\repositories\LocalStorageSupplierInvitationRepository.ts
infrastructure\repositories\SupabaseOrganizationConnectionRepository.ts
infrastructure\repositories\SupabaseSupplierRepository.ts
presentation\components
presentation\pages
presentation\components\CompanyDetailsDrawer.tsx
presentation\components\EditInviteModal.tsx
presentation\components\InviteCompanyModal.tsx
presentation\components\NetworkCompanyModal.tsx
presentation\components\PartnerCard.tsx
presentation\pages\tabs
presentation\pages\NetworkPage.tsx
presentation\pages\SupplierFormPage.tsx
presentation\pages\SuppliersListPage.tsx
index.tsx
```

## 2. Rotas

| Caminho | Componente | Utilização |
|---|---|---|
| /suppliers/network | NetworkPage | |
| /organizations | MinhaEmpresaPage | |
| /admin | GlobalAdminPage | |
| /admin/empresas | GlobalAdminPage | |
| /admin/empresas/:id | AdminCompanyProfilePage | |
| /admin/empresas/:id/comercial | AdminCompanyProfilePage | |
| /admin/empresas/:id/colaboradores | AdminCompanyProfilePage | |
| /admin/empresas/:id/operadores | AdminCompanyProfilePage | |
| /admin/empresas/:id/solicitantes | AdminCompanyProfilePage | |
| /admin/empresas/:id/permissoes | AdminCompanyProfilePage | |
| /admin/empresas/:id/aprovacoes | AdminCompanyProfilePage | |
| /admin/empresas/:id/delegacoes | AdminCompanyProfilePage | |
| /admin/empresas/:id/logs | AdminCompanyProfilePage | |
| /admin/materiais | GlobalAdminPage | |
| /admin/categorias | GlobalAdminPage | |
| /admin/segmentos | GlobalAdminPage | |
| /admin/campo | GlobalAdminPage | |
| /admin/app-campo | GlobalAdminPage | |
| /empresa | MinhaEmpresaPage | |
| /empresa/:id | MinhaEmpresaPage | |
| /empresa/comercial | MinhaEmpresaPage | |
| /empresa/colaboradores | MinhaEmpresaPage | |
| /empresa/solicitantes | MinhaEmpresaPage | |
| /empresa/permissoes | MinhaEmpresaPage | |
| /empresa/aprovacoes | MinhaEmpresaPage | |
| /empresa/delegacoes | MinhaEmpresaPage | |
| /empresa/logs | MinhaEmpresaPage | |
| /empresa/empresas | OrganizationsListPage | |

## 3. Componentes

| Componente | Props | Arquivo |
|---|---|---|
| CompanyProfileView | `{ organizationId, mode }: CompanyProfileViewProps` | \src\modules\organizations\presentation\components\CompanyProfileView.tsx |
| AdminCompanyProfilePage | `nenhuma` | \src\modules\organizations\presentation\pages\AdminCompanyProfilePage.tsx |
| MinhaEmpresaPage | `nenhuma` | \src\modules\organizations\presentation\pages\MinhaEmpresaPage.tsx |
| OrganizationsListPage | `nenhuma` | \src\modules\organizations\presentation\pages\OrganizationsListPage.tsx |
| CompanyDetailsDrawer | `{ isOpen, onClose, partner }: CompanyDetailsDrawerProps` | \src\modules\suppliers\presentation\components\CompanyDetailsDrawer.tsx |
| EditInviteModal | `{ isOpen, onClose, onSuccess, partner }: EditInviteModalProps` | \src\modules\suppliers\presentation\components\EditInviteModal.tsx |
| InviteCompanyModal | `{ isOpen, onClose, onSuccess }: InviteCompanyModalProps` | \src\modules\suppliers\presentation\components\InviteCompanyModal.tsx |
| NetworkCompanyModal | `{ org, isOpen, onClose, onConnectSuccess }: NetworkCompanyModalProps` | \src\modules\suppliers\presentation\components\NetworkCompanyModal.tsx |
| PartnerCard | `{    partner,    onRemove,    onAccept,    onReject,    onCancel,   onEdit,   onViewDetails,   highlight  }: {   partner: Partner;   onRemove: (id: string` | \src\modules\suppliers\presentation\components\PartnerCard.tsx |
| NetworkPage | `nenhuma` | \src\modules\suppliers\presentation\pages\NetworkPage.tsx |
| SupplierFormPage | `nenhuma` | \src\modules\suppliers\presentation\pages\SupplierFormPage.tsx |
| SuppliersListPage | `nenhuma` | \src\modules\suppliers\presentation\pages\SuppliersListPage.tsx |

## 4. Banco de dados

### Tabela: `organizations`

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
name VARCHAR(255) NOT NULL,
document VARCHAR(50) NOT NULL,
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

### Tabela: `empresa_cnaes`

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
cnae_code VARCHAR(50) NOT NULL,
description TEXT,
is_primary BOOLEAN DEFAULT false,
created_at TIMESTAMPTZ DEFAULT NOW()
```

### Tabela: `empresa_certificacoes`

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
certification_id UUID NOT NULL REFERENCES public.certifications(id) ON DELETE CASCADE,
created_at TIMESTAMPTZ DEFAULT NOW(),
UNIQUE(organization_id, certification_id)
```

### Tabela: `empresa_estados_atendidos`

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
state_code VARCHAR(2) NOT NULL,
created_at TIMESTAMPTZ DEFAULT NOW(),
UNIQUE(organization_id, state_code)
```

### Tabela: `organization_segments`

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
segment_id UUID NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
origem VARCHAR(50) DEFAULT 'usuario', -- usuario, hub_ia, cnae
created_at TIMESTAMPTZ DEFAULT NOW(),
UNIQUE(organization_id, segment_id)
```

### Tabela: `empresa_catalogo`

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
internal_code VARCHAR(100),
brand VARCHAR(255),
manufacturer VARCHAR(255),
description TEXT,
image_url TEXT,
status VARCHAR(50) DEFAULT 'ativo', -- ativo, inativo, pendente_curadoria
material_type VARCHAR(50) DEFAULT 'fornecido', -- fornecido, comprado, ambos
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

### Tabela: `empresa_parceiros`

```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
partner_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
relationship_type VARCHAR(50) NOT NULL, -- Fornecedor, Cliente, Parceiro Comercial, Parceiro Logistico
status VARCHAR(50) DEFAULT 'Novo', -- Novo, Conectado, Ativo, Inativo, Bloqueado
origem_relacionamento VARCHAR(50) DEFAULT 'manual', -- convite, hub_ia, marketplace, cotacao, manual
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW(),
UNIQUE(organization_id, partner_id, relationship_type)
```

## 5. Políticas RLS

| Tabela | Política | Tipo | Condição |
|---|---|---|---|
| organizations | organizations_update | FOR UPDATE TO authenticated | `public.has_org_access(id` |
| empresa_cnaes | empresa_cnaes_org_all | FOR ALL | `organization_id = current_org_id(` |
| empresa_cnaes | empresa_cnaes_read_all | FOR SELECT | `true` |
| empresa_certificacoes | empresa_certificacoes_org_all | FOR ALL | `organization_id = current_org_id(` |
| empresa_certificacoes | empresa_certificacoes_read_all | FOR SELECT | `true` |
| empresa_estados_atendidos | empresa_estados_atendidos_org_all | FOR ALL | `organization_id = current_org_id(` |
| empresa_estados_atendidos | empresa_estados_atendidos_read_all | FOR SELECT | `true` |
| organization_segments | organization_segments_org_all | FOR ALL | `organization_id = current_org_id(` |
| organization_segments | organization_segments_read_all | FOR SELECT | `true` |
| empresa_catalogo | empresa_catalogo_org_all | FOR ALL | `organization_id = current_org_id(` |
| empresa_catalogo | empresa_catalogo_read_all | FOR SELECT | `true` |
| empresa_parceiros | empresa_parceiros_org_all | FOR ALL | `organization_id = current_org_id(` |
| empresa_parceiros | empresa_parceiros_read_all | FOR SELECT | `true` |

## 6. Hooks

| Hook | Arquivo |
|---|---|

## 7. Serviços

| Serviço | Arquivo |
|---|---|
| MembershipService | \src\modules\organizations\application\services\MembershipService.ts |
| OrganizationService | \src\modules\organizations\application\services\OrganizationService.ts |
| LocalStorageOrganizationMembershipRepository | \src\modules\organizations\infrastructure\repositories\LocalStorageOrganizationMembershipRepository.ts |
| LocalStorageOrganizationRepository | \src\modules\organizations\infrastructure\repositories\LocalStorageOrganizationRepository.ts |
| ConnectionService | \src\modules\suppliers\application\services\ConnectionService.ts |
| InvitationService | \src\modules\suppliers\application\services\InvitationService.ts |
| LocalStorageOrganizationConnectionRepository | \src\modules\suppliers\infrastructure\repositories\LocalStorageOrganizationConnectionRepository.ts |
| LocalStorageSupplierInvitationRepository | \src\modules\suppliers\infrastructure\repositories\LocalStorageSupplierInvitationRepository.ts |
| SupabaseOrganizationConnectionRepository | \src\modules\suppliers\infrastructure\repositories\SupabaseOrganizationConnectionRepository.ts |
| SupabaseSupplierRepository | \src\modules\suppliers\infrastructure\repositories\SupabaseSupplierRepository.ts |

## 8. Campos existentes

*(Mapeamento não-exaustivo baseado nas colunas básicas e UI)*
| Campo UI | Coluna Banco | Tabela | Utilizado | Observação |
|---|---|---|---|---|
| Razão Social | razao_social / name | organizations | Sim | |
| Nome Fantasia | nome_fantasia / trade_name | organizations | Sim | |
| CNPJ | document / cnpj | organizations | Sim | |
| Site | website | organizations | Sim | |
| Telefone | phone | organizations | Sim | |
| Email | email | organizations | Sim | |
| Endereço (Logradouro, etc) | address_street, etc | organizations | Sim | Adicionado via migration 18 |
| CNAEs | cnae_code | empresa_cnaes | Sim | Tabela auxiliar |
| Certificações | certification_id | empresa_certificacoes | Sim | Tabela auxiliar |
| Segmentos | segment_id | organization_segments | Sim | Tabela auxiliar |
| Estados Atendidos | state_code | empresa_estados_atendidos | Sim | Tabela auxiliar |
| Raio de Atendimento | area_cobertura_raio | organizations | Sim | |

## 9. Área geográfica

- **Implementação atual:** Utiliza a coluna `area_cobertura_raio` na tabela `organizations`.
- **Onde é utilizada:**
```

```
- **Impacto da alteração:** Transformar de input numérico para select exigirá alterar o tipo no banco de dados se for Integer, ou mapear as novas strings. Atualmente parece ser salva no JSON ou em coluna específica. A mudança afetará a busca por raio em filtros futuros.

## 10. Dependências

- **Dashboard:** Sinais, métricas (usa organization_id)
- **Rede e Parceiros:** Módulo `suppliers` (empresa_parceiros, convites)
- **Convites:** Relacionado à empresa base
- **Cotações:** Requisições de cotação atreladas à empresa
- **Produtos:** `empresa_catalogo` atrela produtos à empresa
- **Chat:** Mensagens contextualizadas pela empresa

## 11. Código morto

- **Rotas mortas:** `/admin/empresas/:id` recém-criada mas solicitada remoção.
- **Componentes:** `AdminCompanyProfilePage` será obsoleto.
- Aprofundamento necessário para hooks/páginas legados da Fase 1, já que muitos ainda podem ler `localStorage` ao invés da prop.

## 12. Possíveis riscos

- **Modal vs Tabs:** O `CompanyProfileView` atual possui tabs complexas (Colaboradores, Logs). Colocar tudo isso dentro de um Modal causará problemas graves de UX (modal dentro de modal, overflow de tela, carregamento excessivo). O modal deve ser estritamente para dados comerciais/gerais.
- **Remoção de rotas atuais:** Quebra de links salvos (bookmarks) pelos administradores.
- **Alteração no banco:** Mudar `area_cobertura_raio` pode quebrar queries existentes que assumam tipo numérico.

## 13. Sugestões arquiteturais

1. **Criar `CompanyProfileForm` isolado:** Em vez de tentar enfiar o `CompanyProfileView` (que é uma página com layout de 2 colunas e navegação) no Modal, extrair apenas o formulário central (`DadosEmpresaTab`) para um componente `CompanyProfileForm`. O `CompanyProfileModal` e o `MinhaEmpresaPage` usariam esse form.
2. **Sub-abas no Modal:** Evitar gerenciar colaboradores e permissões dentro do modal de perfil. O modal deve ter apenas "Dados Gerais" e "Área Comercial". A gestão de usuários deve ter tela/modal próprio se necessário.
3. **Componentização de Selects:** O novo select de Área Geográfica deve usar o componente de Dropdown/Select padronizado do projeto.
