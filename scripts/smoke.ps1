# smoke.ps1 — smoke test HTTP end-to-end. TIDAK mematikan server, TIDAK mengubah
# data permanen (fixture dibuat & dibersihkan otomatis).
#
#   .\scripts\smoke.ps1 [-BaseUrl http://localhost:3999] [-TimeoutSec 15]
#
# Exit 0 = semua test wajib PASS (boleh ada SKIP); exit 1 = ada FAIL.
param(
  [string]$BaseUrl = "http://localhost:3999",
  [int]$TimeoutSec = 15
)
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$tmp = Join-Path $env:TEMP "elearningqu-smoke"
if (-not (Test-Path $tmp)) { New-Item -ItemType Directory -Path $tmp | Out-Null }

$pass = 0; $fail = 0; $skip = 0
$results = @()
function Check($nama, $diharapkan, $aktual, $detail = "") {
  $ok = ($diharapkan -contains "$aktual")
  if ($ok) { $script:pass++ } else { $script:fail++ }
  $script:results += [pscustomobject]@{
    Test = $nama; Harap = ($diharapkan -join "/"); Aktual = "$aktual"
    Hasil = $(if ($ok) { "PASS" } else { "FAIL" }); Detail = "$detail"
  }
}
function Skip($nama, $alasan) {
  $script:skip++
  $script:results += [pscustomobject]@{ Test = $nama; Harap = "-"; Aktual = "-"; Hasil = "SKIP"; Detail = $alasan }
}

# request: kembalikan @{ Code; Body }. Code 000 = gangguan jaringan/koneksi.
function Request($Method, $Path, $Headers = @(), $BodyFile = $null) {
  $curlArgs = @("-s", "--max-time", "$TimeoutSec", "-X", "$Method", "-w", "`n%{http_code}", "-o", "-", "$BaseUrl$Path")
  foreach ($h in $Headers) { $curlArgs += @("-H", $h) }
  if ($BodyFile) { $curlArgs += @("-d", "@$BodyFile") }
  $raw = & curl.exe @curlArgs 2>$null
  $code = "000"; $body = ""
  if ($raw) {
    $lines = @($raw | Where-Object { $_ -ne $null })
    if ($lines.Count -gt 0) { $code = ("$($lines[-1])").Trim(); if ($lines.Count -gt 1) { $body = ($lines[0..($lines.Count - 2)] -join "`n") } }
  }
  if ($code -notmatch '^\d+$') { $body = "$code"; $code = "000" }
  return @{ Code = $code; Body = $body }
}
function Detail($Code, $Body) {
  if ($Code -eq "000") { return "NETWORK: koneksi ke $BaseUrl gagal/timeout" }
  $b = "$Body"
  if ($b.Length -gt 160) { $b = $b.Substring(0, 160) + "..." }
  return "HTTP $Code $b"
}
function New-BodyFile($name, $content) {
  $p = Join-Path $tmp $name
  [IO.File]::WriteAllText($p, $content, (New-Object System.Text.UTF8Encoding($false)))
  return $p
}
function Bearer($id, $role, $t) {
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${id}:${role}:${t}"))
  return "Authorization: Bearer $b64"
}

Write-Output "=== SMOKE TEST $BaseUrl (timeout ${TimeoutSec}s/curl) ==="

# ── 0. Server hidup? ──
$ping = Request "GET" "/login"
if ($ping.Code -eq "000" -or $ping.Code -ge "500") {
  Check "server hidup (GET /login)" @("200") $ping.Code (Detail $ping.Code $ping.Body)
  Write-Output "SERVER MATI/TIDAK SEHAT — semua test berikutnya akan gagal jaringan. Jalankan scripts\start-server.ps1"
}
else { Check "server hidup (GET /login)" @("200") $ping.Code "" }

# ── Fixture (upload + perangkat) ──
$fx = $null
$fxRaw = & npx tsx (Join-Path $root "tools\smoke-fixture.ts") 2>&1 | Out-String
$fxLine = ($fxRaw -split "`r?`n" | Where-Object { $_ -match '"upload"' } | Select-Object -Last 1)
if ($fxLine) {
  try { $fx = $fxLine | ConvertFrom-Json } catch { $fx = $null }
}
if (-not $fx) { Write-Output "FIXTURE GAGAL — test upload & perangkat di-SKIP. (DB mati?) Output: $($fxRaw.Substring(0, [Math]::Min(300, $fxRaw.Length)))" }

$now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

# ════ A. KEAMANAN ENDPOINT FINGERPRINT ════
Write-Output "--- A. Fingerprint /api/fingerprint/scan ---"
$bodyInvalid = New-BodyFile "scan-invalid.json" "{bukan-json"
$r = Request "POST" "/api/fingerprint/scan" @("Content-Type: application/json") $bodyInvalid
Check "body JSON rusak -> 400" "400" $r.Code (Detail $r.Code $r.Body)

$bodyKosong = New-BodyFile "scan-kosong.json" '{"scanId":"S1","tipe":"MASUK"}'
$r = Request "POST" "/api/fingerprint/scan" @("Content-Type: application/json") $bodyKosong
Check "tanpa kode+apiKey -> 401" "401" $r.Code (Detail $r.Code $r.Body)

$bodySalah = New-BodyFile "scan-salah.json" '{"perangkatKode":"TIDAK-TERDAFTAR","apiKey":"fp:salah","scanId":"SMOKE-1","tipe":"MASUK"}'
$r = Request "POST" "/api/fingerprint/scan" @("Content-Type: application/json") $bodySalah
Check "device tak terdaftar -> 401" "401" $r.Code (Detail $r.Code $r.Body)
$parsed = $r.Body | ConvertFrom-Json -ErrorAction SilentlyContinue
Check "respons 401 device salah: success=false" "False" "$($parsed.success)" $r.Body

if ($fx) {
  $bAktifSalah = New-BodyFile "scan-aktif-salah.json" ("{`"perangkatKode`":`"$($fx.devices.aktif.kode)`",`"apiKey`":`"fp:key-salah`",`"scanId`":`"SMOKE-2`",`"tipe`":`"MASUK`"}")
  $r = Request "POST" "/api/fingerprint/scan" @("Content-Type: application/json") $bAktifSalah
  Check "device AKTIF + API key salah -> 401" "401" $r.Code (Detail $r.Code $r.Body)

  $bNonaktif = New-BodyFile "scan-nonaktif.json" ("{`"perangkatKode`":`"$($fx.devices.nonaktif.kode)`",`"apiKey`":`"$($fx.devices.nonaktif.key)`",`"scanId`":`"SMOKE-3`",`"tipe`":`"MASUK`"}")
  $r = Request "POST" "/api/fingerprint/scan" @("Content-Type: application/json") $bNonaktif
  Check "device NONAKTIF + key valid -> 403" "403" $r.Code (Detail $r.Code $r.Body)

  $bScanId = New-BodyFile "scan-tanpa-scanid.json" ("{`"perangkatKode`":`"$($fx.devices.aktif.kode)`",`"apiKey`":`"$($fx.devices.aktif.key)`",`"tipe`":`"MASUK`"}")
  $r = Request "POST" "/api/fingerprint/scan" @("Content-Type: application/json") $bScanId
  Check "auth lolos tapi scanId kosong -> 200 + hasil GAGAL (bisnis, bukan auth)" "200" $r.Code (Detail $r.Code $r.Body)
  $p2 = $r.Body | ConvertFrom-Json -ErrorAction SilentlyContinue
  Check "hasil[0].status GAGAL (tidak membuat absensi)" "GAGAL" "$($p2.hasil[0].status)" $r.Body
} else {
  Skip "device AKTIF + API key salah -> 401" "fixture gagal"
  Skip "device NONAKTIF + key valid -> 403" "fixture gagal"
  Skip "auth lolos + scanId kosong -> GAGAL" "fixture gagal"
}

# ════ B. NOTIFIKASI (auth) ════
Write-Output "--- B. Notifikasi ---"
$r = Request "GET" "/api/notifikasi"
Check "GET /api/notifikasi tanpa auth -> 401" "401" $r.Code (Detail $r.Code $r.Body)
$r = Request "POST" "/api/notifikasi" @("Content-Type: application/json") (New-BodyFile "notif-empty.json" "{}")
Check "POST /api/notifikasi tanpa auth -> 401" "401" $r.Code (Detail $r.Code $r.Body)

# ════ C. MATRIX AKSES UPLOAD (IDOR) ════
Write-Output "--- C. Akses /api/upload/[id] ---"
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$tsExp = $now - (8 * 24 * 60 * 60 * 1000)
$hSiswa = $null; $hExp = $null
if ($fx) {
  $hSiswa = Bearer $fx.users.siswaId "SISWA" $ts
  $hExp   = Bearer $fx.users.siswaId "SISWA" $tsExp
}
if ($fx) {
  $r = Request "GET" "/api/upload/$($fx.upload.pub)"
  Check "upload PUBLIK tanpa login -> 200" "200" $r.Code (Detail $r.Code $r.Body)
  $r = Request "GET" "/api/upload/$($fx.upload.priv)"
  Check "upload PRIVAT tanpa login -> 401" "401" $r.Code (Detail $r.Code $r.Body)
  $r = Request "GET" "/api/upload/$($fx.upload.priv)" @($hSiswa)
  Check "upload PRIVAT pemilik sendiri -> 200" "200" $r.Code (Detail $r.Code $r.Body)
  $r = Request "GET" "/api/upload/$($fx.upload.internal)"
  Check "upload INTERNAL tanpa login -> 401" "401" $r.Code (Detail $r.Code $r.Body)
  $r = Request "GET" "/api/upload/$($fx.upload.internal)" @($hSiswa)
  Check "upload INTERNAL user login lain -> 200" "200" $r.Code (Detail $r.Code $r.Body)
  $r = Request "GET" "/api/upload/$($fx.upload.priv)" @($hExp)
  Check "upload Bearer kedaluwarsa -> 401" "401" $r.Code (Detail $r.Code $r.Body)

  # Token dengan role tidak cocok ditolak getMobileUser (boundary auth mobile).
  # IDOR pemilik-lain yang sesungguhnya diuji di tools/test-upload-akses.ts.
  $r = Request "GET" "/api/upload/$($fx.upload.priv)" @((Bearer $fx.users.siswaId "GURU" $ts))
  Check "upload PRIVAT token role salah -> 401 (role tidak cocok)" "401" $r.Code (Detail $r.Code $r.Body)
} else {
  foreach ($n in @("upload PUBLIK tanpa login -> 200", "upload PRIVAT tanpa login -> 401", "upload PRIVAT pemilik -> 200", "upload INTERNAL tanpa login -> 401", "upload INTERNAL user login -> 200", "upload Bearer kedaluwarsa -> 401", "upload PRIVAT role salah -> 401")) { Skip $n "fixture gagal" }
}

# ════ D. MOBILE API ════
Write-Output "--- D. Mobile API ---"
$r = Request "POST" "/api/mobile/auth/login" @("Content-Type: application/json") (New-BodyFile "login-salah.json" '{"email":"tidak@ada.local","password":"SALAH","role":"SISWA"}')
Check "mobile login kredensial salah -> 401" "401" $r.Code (Detail $r.Code $r.Body)

$sid = if ($fx) { $fx.users.siswaId } else { "00000000-0000-0000-0000-000000000000" }
$r = Request "GET" "/api/mobile/siswa/kehadiran" @((Bearer $sid "SISWA" $now))
if ($fx) { Check "GET mobile kehadiran Bearer siswa -> 200" "200" $r.Code (Detail $r.Code $r.Body) }
else { Skip "GET mobile kehadiran Bearer siswa -> 200" "fixture gagal" }
$r = Request "GET" "/api/mobile/siswa/kehadiran"
Check "GET mobile kehadiran tanpa auth -> 401" "401" $r.Code (Detail $r.Code $r.Body)
$r = Request "GET" "/api/mobile/siswa/kehadiran" @((Bearer $sid "SISWA" $tsExp))
Check "GET mobile kehadiran Bearer kedaluwarsa -> 401" "401" $r.Code (Detail $r.Code $r.Body)

# ════ E. AUDIT: request auth-gagal tidak membuat data ════
Write-Output "--- E. Audit fixture (harus 0) ---"
$auRaw = & npx tsx (Join-Path $root "tools\smoke-fixture.ts") --audit 2>&1 | Out-String
$auLine = ($auRaw -split "`r?`n" | Where-Object { $_ -match '"events"' } | Select-Object -Last 1)
if ($auLine) {
  try {
    $au = $auLine | ConvertFrom-Json
    Check "tidak ada event fingerprint dari request 401/403" "0" "$($au.events)" $auLine
    Check "tidak ada absensi dari fixture smoke" "0" "$($au.absensiDariSmoke)" $auLine
  } catch { Skip "audit event/absensi" "parse gagal: $auLine" }
} else { Skip "audit event/absensi" "fixture --audit gagal" }

# ── Cleanup fixture (tidak mengubah data permanen) ──
$clRaw = & npx tsx (Join-Path $root "tools\smoke-fixture.ts") --cleanup 2>&1 | Out-String
if ($clRaw -match "cleaned") { Write-Output "FIXTURE_CLEANED" } else { Write-Output "FIXTURE_CLEANUP GAGAL: $($clRaw.Substring(0, [Math]::Min(200, $clRaw.Length)))" }

# ── Laporan ──
Write-Output ""
$results | Format-Table -AutoSize
Write-Output "SMOKE HASIL: $pass PASS, $fail FAIL, $skip SKIP (total $($results.Count))"
if ($fail -gt 0) { exit 1 } else { exit 0 }
