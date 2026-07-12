$ErrorActionPreference = 'Stop'
$rootDir = "e:\SupplyHUB"

Write-Host "Iniciando reestruturação..."

# Criar pastas raízes se não existirem
$rootDirs = @("src\kernel", "src\core", "src\contracts", "src\infrastructure", "src\sdk", "src\modules", "src\shared")
foreach ($dir in $rootDirs) {
    if (!(Test-Path "$rootDir\$dir")) {
        New-Item -Path "$rootDir\$dir" -ItemType Directory -Force | Out-Null
    }
}

# Mover docs
if (!(Test-Path "$rootDir\docs")) {
    New-Item -Path "$rootDir\docs" -ItemType Directory -Force | Out-Null
}
if (Test-Path "$rootDir\apps\web\docs\*") {
    Move-Item -Path "$rootDir\apps\web\docs\*" -Destination "$rootDir\docs\" -Force -ErrorAction SilentlyContinue
}

# Mover src da web
if (Test-Path "$rootDir\apps\web\src\*") {
    $items = Get-ChildItem -Path "$rootDir\apps\web\src\"
    foreach ($item in $items) {
        $dest = "$rootDir\src\" + $item.Name
        if (Test-Path $dest) {
            # Se for diretório, mover conteúdo interno
            if ($item.PSIsContainer) {
                Move-Item -Path "$($item.FullName)\*" -Destination $dest -Force -ErrorAction SilentlyContinue
            } else {
                Move-Item -Path $item.FullName -Destination $dest -Force -ErrorAction SilentlyContinue
            }
        } else {
            Move-Item -Path $item.FullName -Destination "$rootDir\src\" -Force -ErrorAction SilentlyContinue
        }
    }
}

# Mover testes
if (Test-Path "$rootDir\apps\web\tests\*") {
    if (!(Test-Path "$rootDir\tests")) {
        New-Item -Path "$rootDir\tests" -ItemType Directory -Force | Out-Null
    }
    Move-Item -Path "$rootDir\apps\web\tests\*" -Destination "$rootDir\tests\" -Force -ErrorAction SilentlyContinue
}

# Remover apps e packages
Remove-Item -Path "$rootDir\apps" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$rootDir\packages" -Recurse -Force -ErrorAction SilentlyContinue

# Criar .env.example
New-Item -Path "$rootDir\.env.example" -ItemType File -Force -Value "VITE_SUPABASE_URL=`r`nVITE_SUPABASE_ANON_KEY=" | Out-Null

# Ajustar módulos
$modulesDir = "$rootDir\src\modules"

# Remover module "companies" se existir e garantir "organizations"
if (Test-Path "$modulesDir\companies") {
    Remove-Item -Path "$modulesDir\companies" -Recurse -Force -ErrorAction SilentlyContinue
}

# Recriar pastas que foram exigidas agora
$newContracts = @("api", "events", "interfaces", "messages", "dto")
foreach ($dir in $newContracts) {
    New-Item -Path "$rootDir\src\contracts\$dir" -ItemType Directory -Force | Out-Null
}

$newSdk = @("sap", "totvs", "oracle", "openai", "outlook", "teams")
foreach ($dir in $newSdk) {
    New-Item -Path "$rootDir\src\sdk\$dir" -ItemType Directory -Force | Out-Null
}

New-Item -Path "$rootDir\tests\performance" -ItemType Directory -Force | Out-Null

$newKernel = @("config", "events", "logger", "audit", "notifications", "features", "providers", "router", "middlewares", "di")
foreach ($dir in $newKernel) {
    New-Item -Path "$rootDir\src\kernel\$dir" -ItemType Directory -Force | Out-Null
}

$moduleList = @("admin", "ai", "audit", "auth", "categories", "dashboard", "employees", "files", "identity", "integrations", "notifications", "organizations", "products", "quotations", "reports", "search", "settings", "suppliers", "units", "workflows")

foreach ($mod in $moduleList) {
    if (!(Test-Path "$modulesDir\$mod")) {
        New-Item -Path "$modulesDir\$mod" -ItemType Directory -Force | Out-Null
    }
    
    $modDirs = @(
        "application\dto",
        "application\services",
        "application\use-cases",
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
        New-Item -Path "$modulesDir\$mod\$dir" -ItemType Directory -Force | Out-Null
    }
    New-Item -Path "$modulesDir\$mod\index.ts" -ItemType File -Force -Value "// Barrel export para $mod" | Out-Null
}

Write-Host "Reestruturação finalizada!"
