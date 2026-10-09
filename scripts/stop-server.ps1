# stop-server.ps1 — hentikan server milik script ini dengan aman.
# Exit 0 = berhenti / sudah tidak jalan; 2 = port dipakai proses asing (tidak disentuh).
param([int]$Port = 3999, [int]$TimeoutSec = 15)
$ErrorActionPreference = "Continue"
$pidFile = Join-Path $PSScriptRoot ".server.pid"

if (-not (Test-Path $pidFile)) {
  $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) {
    Write-Output "PORT_DIBUKA_PID_ASYING port=$Port owner=$($c.OwningProcess) — tidak dihentikan (tidak ada PID file)."
    exit 2
  }
  Write-Output "TIDAK_BERJALAN — tidak ada PID file dan port $Port bebas."
  exit 0
}

$serverPid = [int](Get-Content $pidFile -Raw).Trim()
$proc = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
if (-not $proc) {
  Remove-Item $pidFile -Force
  Write-Output "SUDAH_MATI pid=$serverPid (PID file dibersihkan)."
  exit 0
}

# taskkill /T mematikan tree: wrapper powershell + node child-nya
& taskkill /PID $serverPid /T /F 2>&1 | Out-Null

$deadline = (Get-Date).AddSeconds($TimeoutSec)
while ((Get-Date) -lt $deadline) {
  $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $c) { break }
  Start-Sleep -Milliseconds 500
}

$c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($c) {
  Write-Output "STOP_PARTIAL pid=$serverPid dibunuh, tetapi port $Port masih dipegang PID $($c.OwningProcess) — kemungkinan proses lain."
  exit 2
}
Remove-Item $pidFile -Force
Write-Output "SERVER_STOPPED pid=$serverPid port=$Port bebas."
exit 0
