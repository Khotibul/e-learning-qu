# Proses internal: menjalankan Next.js dengan log append (dipanggil start-server.ps1).
param([int]$Port = 3999)
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
Set-Location $root
$logs = Join-Path (Split-Path -Parent $PSCommandPath) "logs"
if (-not (Test-Path $logs)) { New-Item -ItemType Directory -Path $logs | Out-Null }
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = Join-Path $logs "server-$stamp.log"
$errFile = Join-Path $logs "server-$stamp.err.log"
$node = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $node)) { $node = "node" }

# Next.js 16 + output:standalone → next start tidak valid. Pakai standalone server.js.
$standalone = Join-Path $root ".next\standalone\server.js"
if (Test-Path $standalone) {
  # build baru membuat ulang standalone tanpa static — copy dulu
  $stDest = Join-Path $root ".next\standalone\.next\static"
  if (-not (Test-Path $stDest)) {
    New-Item -ItemType Directory -Path (Split-Path $stDest) -Force | Out-Null
    Copy-Item -Path (Join-Path $root ".next\static") -Destination $stDest -Recurse -Force
  }
  $pubDest = Join-Path $root ".next\standalone\public"
  if ((Test-Path (Join-Path $root "public")) -and (-not (Test-Path $pubDest))) {
    Copy-Item -Path (Join-Path $root "public") -Destination $pubDest -Recurse -Force -ErrorAction SilentlyContinue
  }
  $env:PORT = "$Port"
  $env:NODE_ENV = "production"
  # Start-Process agar node lepas dari pipe wrapper & tetap hidup setelah script ini selesai
  $p = Start-Process -FilePath $node -ArgumentList "`"$standalone`"" -WorkingDirectory $root -PassThru -WindowStyle Hidden -RedirectStandardOutput $logFile -RedirectStandardError $errFile
  $p.WaitForExit()
} else {
  & $node node_modules\next\dist\bin\next start -p $Port *>> $logFile
}
