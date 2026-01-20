# checkpoint.ps1 — Spaço da Jhuséna
$ErrorActionPreference = "Stop"

function TryGit($gitArgs) {
  try { return (& git @gitArgs 2>$null) } catch { return $null }
}

# Garante que está em repo git
$gitRoot = (TryGit @("rev-parse","--show-toplevel") | Select-Object -First 1)
if (-not $gitRoot) {
  Write-Host "❌ Não encontrei um repositório Git aqui." -ForegroundColor Red
  exit 1
}
$gitRoot = $gitRoot.Trim()
Set-Location $gitRoot

$now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$branch = ((TryGit @("rev-parse","--abbrev-ref","HEAD")) | Select-Object -First 1).Trim()
$lastCommit = ((TryGit @("rev-parse","--short","HEAD")) | Select-Object -First 1)
$lastMsg = "-"


if (-not $lastCommit) { $lastCommit = "-" }
if (-not $lastMsg) { $lastMsg = "-" }

# Status curto do git
$gitStatus = TryGit @("status","--porcelain")
if (-not $gitStatus) { $gitStatus = @() }

# Linhas completas do status (pra mostrar no CHECKPOINT)
$changed = @()
foreach ($line in $gitStatus) {
  if ($line) { $changed += $line }
}

# ✅ Arquivos alterados (lista limpa) — para "Arquivos que vamos mexer"
$arquivos = @()
foreach ($line in $changed) {
  if ($line.Length -ge 4) {
    $path = $line.Substring(3).Trim()
    if ($path) { $arquivos += $path }
  }
}
$arquivos = $arquivos | Sort-Object -Unique

# (opcional) tira o próprio checkpoint da lista, pra não poluir
$arquivos = $arquivos | Where-Object { $_ -ne "CHECKPOINT.md" -and $_ -ne "checkpoint.ps1" }

# Sugestões automáticas
$problemaAtual = "PDV/Overrides: consolidar tela de auditoria + resumo do topo"
$proximoMicroPasso = "Criar/ajustar view e rota da tela de overrides para alimentar os cards do resumo"

$checkpointPath = Join-Path $gitRoot "CHECKPOINT.md"

$body = @"
# CHECKPOINT - Spaco da Jhusena

Data: $now
Branch: $branch
Ultimo commit:
$lastCommit



Status do Git:
$(if ($changed.Count -gt 0) { ($changed -join "`n") } else { "Working tree limpo OK" })

Problema atual:
$problemaAtual

Proximo micro-passo:
$proximoMicroPasso

Arquivos que vamos mexer:
$(if ($arquivos.Count -gt 0) { ($arquivos -join "`n") } else { "-" })
"@


# ✅ Força UTF-8 com BOM (evita SpaÃ§o / ðŸ§­)
[System.IO.File]::WriteAllText($checkpointPath, $body, (New-Object System.Text.UTF8Encoding($true)))

Write-Host "✅ CHECKPOINT.md atualizado!" -ForegroundColor Green
Write-Host "Arquivo: $checkpointPath"
