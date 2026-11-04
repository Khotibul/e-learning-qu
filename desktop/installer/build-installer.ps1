param(
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [string]$Version = "1.1.0"
)
$ErrorActionPreference = "Stop"

$installerDir = $PSScriptRoot
$desktopRoot  = Split-Path $installerDir -Parent
$proj         = Join-Path $desktopRoot "src\E-LearningQu.Desktop\E-LearningQu.Desktop.csproj"
$staging      = Join-Path $installerDir "staging"
$dist         = Join-Path $installerDir "dist"
$setupProj    = Join-Path $installerDir "setup\Setup.csproj"
$payload      = Join-Path $installerDir "setup\payload.zip"
$setupExe     = Join-Path $dist "E-LearningQu-Desktop-Setup.exe"

$dotnet = "C:\Users\Risa\.dotnet\dotnet.exe"
if (-not (Test-Path $dotnet)) {
    $cmd = Get-Command dotnet -ErrorAction SilentlyContinue
    if ($cmd) { $dotnet = $cmd.Source }
}
if (-not $dotnet -or -not (Test-Path $dotnet)) { throw "dotnet.exe tidak ditemukan" }

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging, $dist -Force | Out-Null

Write-Host "[1/4] dotnet publish ($Configuration/$Runtime, self-contained)..."
& $dotnet publish $proj -c $Configuration -r $Runtime --self-contained true -o $staging --nologo `
    -p:Version=$Version -p:FileVersion=$Version -p:AssemblyVersion=$Version
if ($LASTEXITCODE -ne 0) { throw "dotnet publish gagal (exit $LASTEXITCODE)" }

Write-Host "[2/4] Menyalin Install.cmd / Uninstall.cmd / README.txt ke staging..."
Copy-Item -LiteralPath (Join-Path $installerDir "Install.cmd") -Destination $staging
Copy-Item -LiteralPath (Join-Path $installerDir "Uninstall.cmd") -Destination $staging
Copy-Item -LiteralPath (Join-Path $installerDir "README.txt") -Destination $staging

$exeCount = (Get-ChildItem $staging -Filter *.exe | Measure-Object).Count
if ($exeCount -lt 1) { throw "Publish output tidak berisi exe aplikasi" }

$zip = Join-Path $dist "E-LearningQu-Desktop-$Version-$Runtime.zip"
Write-Host "[3/4] Membuat zip: $zip"
if (Test-Path $zip) { Remove-Item $zip -Force }

# Salin dulu ke folder temp: antivirus/proses publish bisa sesaat mengunci DLL di staging
# (penyebab umum "file is being used by another process" pada Compress-Archive).
$zipSource = Join-Path $env:TEMP "elq-zip-$Version-$Runtime"
if (Test-Path $zipSource) { Remove-Item $zipSource -Recurse -Force }
New-Item -ItemType Directory -Path $zipSource -Force | Out-Null
& robocopy $staging $zipSource /E /R:5 /W:2 /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy staging ke temp gagal (exit $LASTEXITCODE)" }

$zipped = $false
for ($try = 1; $try -le 5 -and -not $zipped; $try++) {
    try {
        Compress-Archive -Path (Join-Path $zipSource "*") -DestinationPath $zip -Force
        $zipped = $true
    }
    catch {
        Write-Host "  [WARN] Zip percobaan $try gagal: $($_.Exception.Message)"
        if (Test-Path $zip) { Remove-Item $zip -Force -ErrorAction SilentlyContinue }
        Start-Sleep -Seconds (3 * $try)
    }
}
if (-not $zipped) { throw "Compress-Archive gagal setelah 5 percobaan" }
Remove-Item $zipSource -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "[4/4] Membuat Setup.exe self-extracting (payload = zip di atas)..."
# IExpress sudah tidak andal di Windows 11 (gagal membuka SED) → Setup.exe dibangun
# sebagai .NET single-file yang mengekstrak payload lalu menjalankan Install.cmd.
Copy-Item -LiteralPath $zip -Destination $payload -Force
$setupOut = Join-Path $dist "_setup"
if (Test-Path $setupOut) { Remove-Item $setupOut -Recurse -Force }

& $dotnet publish $setupProj -c $Configuration -r $Runtime --self-contained true -o $setupOut --nologo `
    -p:Version=$Version -p:FileVersion=$Version -p:AssemblyVersion=$Version `
    -p:PublishSingleFile=true -p:PublishTrimmed=true -p:DebugType=None
if ($LASTEXITCODE -ne 0) { throw "dotnet publish Setup gagal (exit $LASTEXITCODE)" }

$built = Join-Path $setupOut "E-LearningQu-Desktop-Setup.exe"
if (-not (Test-Path $built)) { throw "Setup.exe tidak dihasilkan oleh publish" }

if (Test-Path $setupExe) { Remove-Item $setupExe -Force }
Move-Item -LiteralPath $built -Destination $setupExe -Force
Remove-Item $setupOut -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $payload -Force -ErrorAction SilentlyContinue

$zipSize   = [math]::Round((Get-Item $zip).Length / 1MB, 1)
$setupSize = [math]::Round((Get-Item $setupExe).Length / 1MB, 1)
Write-Host ""
Write-Host "DONE"
Write-Host "  Setup.exe : $setupExe ($setupSize MB)"
Write-Host "  Zip       : $zip ($zipSize MB)"
Write-Host "  Staging   : $staging"
