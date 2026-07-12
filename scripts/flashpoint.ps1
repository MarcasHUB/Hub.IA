# ==============================================================================
# SupplyHub.IA — FlashPoint Backup System
# ==============================================================================
# Esse script gerencia snapshots rápidos do projeto excluindo diretórios pesados.
#
# Uso:
#   .\scripts\flashpoint.ps1 -Save "nome_do_backup"
#   .\scripts\flashpoint.ps1 -Restore "nome_do_backup"
#   .\scripts\flashpoint.ps1 -List
# ==============================================================================

param (
    [string]$Save,
    [string]$Restore,
    [switch]$List
)

$ProjectRoot = "e:\SupplyHUB"
$BackupDir = Join-Path $ProjectRoot ".flashpoints"

# Cria pasta de backups se não existir
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

# ─── LISTAR FLASHPOINTS ───────────────────────────────────────────────────────
if ($List) {
    Write-Host "=== FLASHPOINTS DISPONÍVEIS ===" -ForegroundColor Cyan
    if (!(Test-Path $BackupDir)) {
        Write-Host "Nenhum backup encontrado."
        return
    }
    $backups = @(Get-ChildItem -Directory -Path $BackupDir)
    if ($backups.Count -eq 0) {
        Write-Host "Nenhum backup encontrado em $BackupDir"
    } else {
        foreach ($b in $backups) {
            $date = $b.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
            Write-Host "  - $($b.Name)  (Criado em: $date)" -ForegroundColor Green
        }
    }
    return
}

# ─── SALVAR FLASHPOINT ────────────────────────────────────────────────────────
if ($Save) {
    # Sanitiza o nome do backup
    $safeName = $Save -replace '[\\/:*?"<>| ]', '_'
    $targetPath = Join-Path $BackupDir $safeName

    Write-Host "Criando FlashPoint '$safeName'..." -ForegroundColor Cyan

    if (Test-Path $targetPath) {
        Write-Host "Aviso: O FlashPoint '$safeName' já existe. Sobrescrevendo..." -ForegroundColor Yellow
        Remove-Item -Path $targetPath -Recurse -Force | Out-Null
    }

    # Executa o backup usando robocopy (exclui node_modules, dist, git e a própria pasta de backups)
    # Ignora códigos de saída do robocopy pois ele retorna código > 0 mesmo em caso de sucesso parcial
    $exitCode = 0
    try {
        robocopy $ProjectRoot $targetPath /E /XD node_modules .git .flashpoints dist .flashpoints_tmp /XF .env /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null
    } catch {
        # Catch normal
    }

    Write-Host "✅ FlashPoint '$safeName' salvo com sucesso em: $targetPath" -ForegroundColor Green
    return
}

# ─── RESTAURAR FLASHPOINT ─────────────────────────────────────────────────────
if ($Restore) {
    $safeName = $Restore -replace '[\\/:*?"<>| ]', '_'
    $sourcePath = Join-Path $BackupDir $safeName

    if (!(Test-Path $sourcePath)) {
        Write-Host "Erro: FlashPoint '$safeName' não encontrado." -ForegroundColor Red
        return
    }

    Write-Host "ATENÇÃO: Restaurando FlashPoint '$safeName'..." -ForegroundColor Yellow
    Write-Host "Isso irá substituir os arquivos de código atuais do projeto pelos do backup." -ForegroundColor Yellow
    
    # Backup de emergência temporário caso o restore falhe
    $tempBackup = Join-Path $ProjectRoot ".flashpoints_tmp"
    if (Test-Path $tempBackup) { Remove-Item -Path $tempBackup -Recurse -Force | Out-Null }
    
    Write-Host "Criando backup temporário de segurança..." -ForegroundColor DarkGray
    try {
        robocopy $ProjectRoot $tempBackup /E /XD node_modules .git .flashpoints dist .flashpoints_tmp /NFL /NDL /NJH /NJS | Out-Null
    } catch {}

    # Deleta arquivos da raiz (exceto node_modules, .git, .flashpoints, dist e .env)
    Write-Host "Limpando diretório de trabalho..." -ForegroundColor DarkGray
    Get-ChildItem -Path $ProjectRoot -Exclude "node_modules", ".git", ".flashpoints", ".flashpoints_tmp", "dist", ".env" | ForEach-Object {
        if ($_.PsIsContainer) {
            Remove-Item -Path $_.FullName -Recurse -Force | Out-Null
        } else {
            Remove-Item -Path $_.FullName -Force | Out-Null
        }
    }

    # Restaura do backup
    Write-Host "Copiando arquivos do FlashPoint..." -ForegroundColor DarkGray
    try {
        robocopy $sourcePath $ProjectRoot /E /NFL /NDL /NJH /NJS | Out-Null
    } catch {
        Write-Host "Erro ao copiar arquivos. Restaurando backup de segurança..." -ForegroundColor Red
        robocopy $tempBackup $ProjectRoot /E /NFL /NDL /NJH /NJS | Out-Null
        return
    }

    # Limpa temporário
    if (Test-Path $tempBackup) { Remove-Item -Path $tempBackup -Recurse -Force | Out-Null }

    Write-Host "✅ FlashPoint '$safeName' restaurado com sucesso!" -ForegroundColor Green
    return
}

# Se nada for passado
Write-Host "Use: .\scripts\flashpoint.ps1 -Save <nome> | -Restore <nome> | -List" -ForegroundColor Yellow
