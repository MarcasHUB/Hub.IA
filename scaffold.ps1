$ErrorActionPreference = 'Stop'

$rootDir = "e:\SupplyHUB"

Write-Host "Criando Monorepo..."
New-Item -Path "$rootDir\package.json" -ItemType File -Force -Value @"
{
  `"name`": `"supplyhub-monorepo`",
  `"private`": true,
  `"workspaces`": [
    `"apps/*`",
    `"packages/*`"
  ]
}
"@

New-Item -Path "$rootDir\apps\web" -ItemType Directory -Force | Out-Null
New-Item -Path "$rootDir\packages\hub-core" -ItemType Directory -Force | Out-Null

Write-Host "Criando hub-core..."
$hubCoreDirs = "auth", "ui", "logger", "audit", "events", "notifications", "utils", "components"
foreach ($dir in $hubCoreDirs) {
  New-Item -Path "$rootDir\packages\hub-core\src\$dir" -ItemType Directory -Force | Out-Null
}

Write-Host "Criando apps\web..."
$appDir = "$rootDir\apps\web"
$baseDirs = @(
  "docs\adr",
  "docs\api",
  "src\kernel\di",
  "src\kernel\events",
  "src\kernel\logger",
  "src\kernel\features",
  "src\kernel\config",
  "src\kernel\providers",
  "src\kernel\router",
  "src\kernel\middlewares",
  "src\kernel\notifications",
  "src\core\audit",
  "src\core\auth",
  "src\core\config",
  "src\core\events",
  "src\core\features",
  "src\core\hooks",
  "src\core\layouts",
  "src\core\logger",
  "src\core\providers",
  "src\core\router",
  "src\core\types",
  "src\core\utils",
  "src\infrastructure\api",
  "src\infrastructure\cache",
  "src\infrastructure\queue",
  "src\infrastructure\storage",
  "src\infrastructure\supabase",
  "src\modules",
  "src\shared\assets",
  "src\shared\components",
  "src\shared\constants",
  "src\shared\enums",
  "src\shared\hooks",
  "src\shared\services",
  "src\shared\types",
  "src\shared\utils",
  "src\shared\validators",
  "src\contracts\api",
  "src\contracts\events",
  "src\contracts\interfaces",
  "src\contracts\messages",
  "src\sdk",
  "tests\e2e",
  "tests\integration",
  "tests\unit"
)

foreach ($dir in $baseDirs) {
  New-Item -Path "$appDir\$dir" -ItemType Directory -Force | Out-Null
}

Write-Host "Criando Módulos..."
$modules = @("admin", "ai", "audit", "auth", "categories", "companies", "core", "dashboard", "employees", "files", "identity", "integrations", "notifications", "organizations", "products", "quotations", "reports", "search", "settings", "suppliers", "units", "workflows")

foreach ($mod in $modules) {
  $modDirs = @(
    "application\services",
    "application\use-cases",
    "application\dto",
    "domain\entities",
    "domain\repositories",
    "domain\services",
    "domain\value-objects",
    "infrastructure\mappers",
    "infrastructure\repositories",
    "presentation\components",
    "presentation\hooks",
    "presentation\pages",
    "presentation\routes",
    "schemas",
    "types"
  )
  foreach ($dir in $modDirs) {
    New-Item -Path "$appDir\src\modules\$mod\$dir" -ItemType Directory -Force | Out-Null
  }
  New-Item -Path "$appDir\src\modules\$mod\index.ts" -ItemType File -Force -Value "// Barrel export para o módulo $mod" | Out-Null
}

Write-Host "Criando arquivos de Configuração em src\core\config..."
$configFiles = @("environment.ts", "constants.ts", "permissions.ts", "roles.ts", "routes.ts", "features.ts")
foreach ($file in $configFiles) {
  New-Item -Path "$appDir\src\core\config\$file" -ItemType File -Force -Value "// $file" | Out-Null
}

Write-Host "Criando Docs..."
$docs = @{
  "Architecture.md" = "# Architecture`n`nDocumentação da arquitetura."
  "Modules.md" = "# Modules`n`nDocumentação dos módulos de negócio."
  "Database.md" = "# Database`n`nRegras: Multi-tenant, Soft Delete, UUID v7, Auditoria, RLS, Versionamento, Timezone UTC, Timestamps automáticos."
  "Roadmap.md" = "# Roadmap`n`nFase 1: Foundation -> Fase 2: Identity -> Fase 3: Organizations -> Fase 4: Suppliers -> Fase 5: Products -> Fase 6: Catalog -> Fase 7: Search -> Fase 8: Quotations -> Fase 9: Purchase Requests -> Fase 10: Dashboard -> Fase 11: AI -> Fase 12: SAP Integration -> Fase 13: Mobile"
  "Standards.md" = "# Standards`n`nIDs: UUID v7`nTime: UTC / ISO8601`nDB: snake_case`nTS: camelCase`nClasses: PascalCase`nMódulos: kebab-case"
  "Conventions.md" = "# Conventions`n`nNomenclatura, organização, commits, branches, componentes, hooks, services, repositories, DTOs, interfaces, eventos."
}

foreach ($key in $docs.Keys) {
  New-Item -Path "$appDir\docs\$key" -ItemType File -Force -Value $docs[$key] | Out-Null
}

Write-Host "Criando ADRs iniciais..."
New-Item -Path "$appDir\docs\adr\0001-domain-driven.md" -ItemType File -Force -Value "# 0001 - Domain Driven Architecture" | Out-Null
New-Item -Path "$appDir\docs\adr\0002-supabase-choice.md" -ItemType File -Force -Value "# 0002 - Escolha do Supabase" | Out-Null
New-Item -Path "$appDir\docs\adr\0003-react-query.md" -ItemType File -Force -Value "# 0003 - Uso do React Query para State Management" | Out-Null

Write-Host "Criando rule global para documentação viva..."
New-Item -Path "$rootDir\.agents" -ItemType Directory -Force | Out-Null
New-Item -Path "$rootDir\.agents\AGENTS.md" -ItemType File -Force -Value @"
# Regras do Workspace SupplyHub

Sempre que realizar uma alteração na arquitetura ou adicionar novos módulos:
1. Atualize obrigatoriamente a documentação dentro de `apps/web/docs/`.
2. Caso seja uma decisão arquitetural, adicione um novo registro em `apps/web/docs/adr/`.
"@ | Out-Null

Write-Host "Scaffolding concluído com sucesso!"
