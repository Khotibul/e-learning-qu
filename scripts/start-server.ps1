# start-server.ps1 — start Next.js production secara detached (WMI Win32_Process),
# sehingga TIDAK ikut mati bila tool/session OpenCode membatalkan process tree.
#
# Keluaran exit code:
#   0 = server sehat (baru start atau reuse yang sudah jalan)
#   1 = start gagal (lihat log di scripts/logs/)
#   2 = port dipakai proses lain — TIDAK disentuh
#   3 = production build tidak ada (jalankan npm run build)
param(
  [int]$Port = 3999,
  [int]$TimeoutSec = 90
)
$ErrorActionPreference = "Stop"
$scripts = $PSScriptRoot
$root = Split-Path -Parent $scripts
$logs = Join-Path $scripts "logs"
if (-not (Test-Path $logs)) { New-Item -ItemType Directory -Path $logs | Out-Null }
$pidFile = Join-Path $scripts ".server.pid"

function Test-Health {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$Port/login" -UseBasicParsing -TimeoutSec 5
    return ($r.StatusCode -eq 200)
  } catch { return $false }
}
function Get-PortOwner {
  $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { return [int]$c.OwningProcess } else { return 0 }
}

# 1) Sudah jalan & sehat? -> reuse
$existingPid = 0
if (Test-Path $pidFile) { $existingPid = [int](Get-Content $pidFile -Raw).Trim() }
$owner = Get-PortOwner
if ($owner -gt 0) {
  if ($existingPid -gt 0 -and (Get-Process -Id $existingPid -ErrorAction SilentlyContinue)) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
      if (Test-Health) { Write-Output "SERVER_READY pid=$existingPid port=$Port (reuse)"; exit 0 }
      Start-Sleep -Seconds 2
    }
    Write-Output "SERVER_UNHEALTHY pid=$existingPid port=$Port — health check gagal dalam ${TimeoutSec}s"
    exit 1
  }
  $opName = (Get-Process -Id $owner -ErrorAction SilentlyContinue).ProcessName
  Write-Output "PORT_CONFLICT port=$Port dipegang PID=$owner ($opName) yang bukan milik script ini — tidak dihentikan. Hentikan manual bila ini sisa proses."
  exit 2
}

# 2) Build tersedia?
if (-not (Test-Path (Join-Path $root ".next\BUILD_ID"))) {
  Write-Output "BUILD_MISSING — jalankan: npm run build"
  exit 3
}

# 3) Start detached via WMI (dibuat oleh service, lepas dari job tree tool)
$wrapper = Join-Path $scripts "run-node.ps1"
$cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$wrapper`" -Port $Port"
$res = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
  CommandLine      = $cmd
  CurrentDirectory = $root
}
if ($res.ReturnValue -ne 0) {
  Write-Output "START_FAILED WMI-rc=$($res.ReturnValue)"
  exit 1
}
$newPid = [int]$res.ProcessId
Set-Content -Path $pidFile -Value $newPid -Encoding ASCII
Write-Output "SERVER_STARTING pid=$newPid port=$Port"

# 4) Tunggu sehat
$deadline = (Get-Date).AddSeconds($TimeoutSec)
while ((Get-Date) -lt $deadline) {
  if (-not (Get-Process -Id $newPid -ErrorAction SilentlyContinue)) {
    $log = Get-ChildItem (Join-Path $logs "server-*.log") | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    Write-Output "START_FAILED — proses pid=$newPid keluar lebih dulu. Log terakhir:"
    if ($log) { Get-Content $log.FullName -Tail 30 | ForEach-Object { "  $_" } }
    exit 1
  }
  if (Test-Health) { Write-Output "SERVER_READY pid=$newPid port=$Port"; exit 0 }
  Start-Sleep -Seconds 2
}
Write-Output "START_TIMEOUT pid=$newPid — tidak sehat dalam ${TimeoutSec}s. Periksa scripts/logs/server-*.log"
exit 1
