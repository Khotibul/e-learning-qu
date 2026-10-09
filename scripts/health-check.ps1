# health-check.ps1 — cek kesehatan server Next.js.
#   -Cycles N  : jumlah pemeriksaan (default 1)
#   -IntervalSec : jeda antar siklus (default 2)
# Exit 0 = semua siklus sehat; 1 = ada yang gagal.
param(
  [int]$Port = 3999,
  [int]$Cycles = 1,
  [int]$IntervalSec = 2,
  [int]$TimeoutSec = 10
)
$ErrorActionPreference = "Continue"
$pidFile = Join-Path $PSScriptRoot ".server.pid"
$scriptPid = 0
if (Test-Path $pidFile) { $scriptPid = [int](Get-Content $pidFile -Raw).Trim() }

$gagal = 0
for ($i = 1; $i -le $Cycles; $i++) {
  $owner = 0
  $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { $owner = [int]$c.OwningProcess }

  $sw = [Diagnostics.Stopwatch]::StartNew()
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$Port/login" -UseBasicParsing -TimeoutSec $TimeoutSec
    $ms = $sw.ElapsedMilliseconds
    if ($r.StatusCode -eq 200) {
      $ram = ""
      $op = Get-Process -Id $owner -ErrorAction SilentlyContinue
      if ($op) { $ram = " ram=$([math]::Round($op.WorkingSet64/1MB,1))MB" }
      Write-Output ("[{0}/{1}] OK HTTP 200 {2}ms port-owner={3}{4}" -f $i, $Cycles, $ms, $owner, $ram)
    } else {
      $gagal++
      Write-Output ("[{0}/{1}] FAIL HTTP {2}" -f $i, $Cycles, $r.StatusCode)
    }
  } catch {
    $gagal++
    $msg = if ($_.Exception.Response) { "HTTP $([int]$_.Exception.Response.StatusCode)" } else { "NETWORK: $($_.Exception.Message)" }
    Write-Output ("[{0}/{1}] GAGAL {2}" -f $i, $Cycles, $msg)
  }
  if ($i -lt $Cycles) { Start-Sleep -Seconds $IntervalSec }
}

if ($scriptPid -gt 0) {
  $alive = [bool](Get-Process -Id $scriptPid -ErrorAction SilentlyContinue)
  Write-Output "PID-FILE $scriptPid $(if ($alive) { 'HIDUP' } else { 'MATI' })"
}
if ($gagal -gt 0) { exit 1 } else { exit 0 }
