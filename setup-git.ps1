$ErrorActionPreference = 'SilentlyContinue'
$rootDir = "e:\SupplyHUB"

Write-Host "Criando arquivos do repositório..."

# .gitignore
$gitignore = @"
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Configurações de ambiente
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.env.production

# Dependências
node_modules/
dist/
coverage/
build/
.pnp
.pnp.js

# Editor
.vscode/*
!.vscode/extensions.json
.idea
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# OS
.DS_Store
Thumbs.db
"@
New-Item -Path "$rootDir\.gitignore" -ItemType File -Force -Value $gitignore | Out-Null

# README.md
$readme = @"
# SupplyHub

**SupplyHub** é uma plataforma SaaS de compras corporativas que conecta empresas e fornecedores em um marketplace privado e inteligente. O sistema visa substituir processos manuais (como e-mail, WhatsApp e planilhas) por um ambiente automatizado para reduzir custos e aumentar a concorrência e transparência.

## Arquitetura
A arquitetura do SupplyHub foi construída com base em **Domain Driven Design (DDD)**, atuando como um Monólito Modular com separação clara entre as camadas de Kernel, Domínio, Aplicação e Apresentação, além de suportar a comunicação interna por um Event Bus.

## Estrutura de Diretórios
- `src/kernel/`: Ferramentas globais (Event Bus, Logger, DI, Providers).
- `src/modules/`: Módulos de negócios independentes (Auth, Identity, Organizations, Suppliers, etc).
- `src/infrastructure/`: Comunicação com serviços externos, como banco de dados.
- `src/contracts/`: Interfaces para integrações futuras.
- `src/sdk/`: SDK interno para serviços de terceiros (SAP, Oracle, TOTVS).
- `src/shared/`: Recursos reutilizáveis pela camada de apresentação.
- `docs/`: Documentação viva e Architecture Decision Records (ADRs).

## Instalação e Execução
1. Instale as dependências: `npm install`
2. Copie o arquivo de configuração de ambiente: `cp .env.example .env` (e adicione as credenciais do Supabase).
3. Inicie o servidor: `npm run dev`

## Roadmap
O detalhamento do roadmap está localizado na documentação: [Roadmap](./docs/Roadmap.md)
"@
New-Item -Path "$rootDir\README.md" -ItemType File -Force -Value $readme | Out-Null

# CHANGELOG.md
$changelog = @"
# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

## [Unreleased]
### Adicionado
- Fundação inicial da plataforma (Monólito Modular com DDD).
- Implementação dos diretórios de Kernel, Modules, Infrastructure, SDK, Contracts e Shared.
- Documentação viva inicial (ADRs, Database, Roadmap, Conventions, Modules).
- Inicialização da camada de UI base para a Sprint 1 (MVP).
"@
New-Item -Path "$rootDir\CHANGELOG.md" -ItemType File -Force -Value $changelog | Out-Null

# LICENSE
$license = @"
Copyright (c) 2024 SupplyHub

Todos os direitos reservados.
Este código é proprietário e confidencial. A cópia, distribuição ou modificação não autorizada deste software é estritamente proibida.
"@
New-Item -Path "$rootDir\LICENSE" -ItemType File -Force -Value $license | Out-Null

Write-Host "Inicializando Git..."
Push-Location $rootDir
git init
git checkout -b main
git add .
git commit -m "chore: initial project setup and foundation"
git checkout -b develop
Pop-Location

Write-Host "Configuração do repositório finalizada!"
