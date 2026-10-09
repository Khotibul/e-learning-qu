# Proses internal: menjalankan Next.js dengan log append (dipanggil start-server.ps1).
param([int]$Port = 3999)
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
Set-Location $root
$logs = Join-Path (Split-Path -Parent $PSCommandPath) "logs"
if (-not (Test-Path $logs)) { New-Item -ItemType Directory -Path $logs | Out-Null }
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = Join-Path $logs "server-$stamp.log"
$node = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $node)) { $node = "node" }

# Next.js 16 + output:standalone → next start tidak valid. Pakai standalone server.js.
$standalone = Join-Path $root ".next\standalone\server.js"
if (Test-Path $standalone) {
  $env:PORT = "$Port"
  $env:NODE_ENV = "production"
  # standalone server butuh .next/static & public di-copy — asumsikan build script sudah handle
  & $node $standalone *>> $logFile
} else {
  & $node node_modules\next\dist\bin\next start -p $Port *>> $logFile
}
