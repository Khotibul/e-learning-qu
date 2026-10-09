# Proses internal: menjalankan Next.js dengan log append (dipanggil start-server.ps1).
param([int]$Port = 3999)
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
Set-Location $root
$logs = Join-Path (Split-Path -Parent $PSCommandPath) "logs"
if (-not (Test-Path $logs)) { New-Item -ItemType Directory -Path $logs | Out-Null }
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$node = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $node)) { $node = "node" }
& $node node_modules\next\dist\bin\next start -p $Port *>> (Join-Path $logs "server-$stamp.log")
