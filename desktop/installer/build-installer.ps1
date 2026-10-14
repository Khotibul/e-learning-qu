param(
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64",
    [string]$Version = "1.0.0"
)
$ErrorActionPreference = "Stop"

$installerDir = $PSScriptRoot
$desktopRoot  = Split-Path $installerDir -Parent
$proj         = Join-Path $desktopRoot "src\E-LearningQu.Desktop\E-LearningQu.Desktop.csproj"
$staging      = Join-Path $installerDir "staging"
$dist         = Join-Path $installerDir "dist"
$dotnet       = "C:\Users\Risa\.dotnet\dotnet.exe"

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging, $dist -Force | Out-Null

Write-Host "[1/4] dotnet publish ($Configuration/$Runtime, self-contained)..."
& $dotnet publish $proj -c $Configuration -r $Runtime --self-contained true -o $staging --nologo
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
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zip

Write-Host "[4/4] Membuat Setup.exe via IExpress (best-effort, opsional)..."
try {
    $ixRoot    = Join-Path $env:TEMP "elq-ix"
    $ixStaging = Join-Path $ixRoot "staging"
    if (Test-Path $ixRoot) { Remove-Item $ixRoot -Recurse -Force }
    New-Item -ItemType Directory -Path $ixStaging -Force | Out-Null
    & robocopy $staging $ixStaging /E /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy ke $ixStaging gagal" }

    $sedPath   = Join-Path $ixRoot "setup.sed"
    $setupExe  = Join-Path $dist "E-LearningQu-Desktop-Setup.exe"
    if (Test-Path $setupExe) { Remove-Item $setupExe -Force }

$ixBase   = $ixStaging.TrimEnd('\') + '\'
$ixSetup  = Join-Path $ixRoot "E-LearningQu-Desktop-Setup.exe"
$files    = Get-ChildItem $ixStaging -Recurse -File | Sort-Object FullName

$dirList = New-Object System.Collections.Generic.List[string]
$dirList.Add($ixBase)
Get-ChildItem $ixStaging -Recurse -Directory | Sort-Object FullName | ForEach-Object {
    $dirList.Add($_.FullName.TrimEnd('\') + '\')
}

$strings = New-Object System.Collections.Generic.List[string]
$sourceFilesLines = New-Object System.Collections.Generic.List[string]
$sectionBlocks = New-Object System.Collections.Generic.List[string]
$fileIdx = 0
for ($d = 0; $d -lt $dirList.Count; $d++) {
    $dirPath = $dirList[$d]
    $sourceFilesLines.Add("SourceFiles$d=$dirPath")
    $sectionLines = New-Object System.Collections.Generic.List[string]
    foreach ($f in $files) {
        if ((($f.DirectoryName.TrimEnd('\')) + '\') -eq $dirPath) {
            $strings.Add("FILE$fileIdx=`"$($f.Name)`"")
            $sectionLines.Add("%FILE$fileIdx%=")
            $fileIdx++
        }
    }
    $sectionBlocks.Add("[SourceFiles$d]")
    foreach ($l in $sectionLines) { $sectionBlocks.Add($l) }
}
$stringsBlock    = ($strings -join "`r`n")
$sourceFilesBody = ($sourceFilesLines -join "`r`n")
$sectionsBlock   = ($sectionBlocks -join "`r`n")

$sed = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=0
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=%AdminQuietInstCmd%
UserQuietInstCmd=%UserQuietInstCmd%
SourceFiles=SourceFiles
[Strings]
InstallPrompt=
DisplayLicense=
FinishMessage=Instalasi selesai. Aplikasi terpasang di LocalAppData\Programs\E-LearningQu dan shortcut dibuat di Desktop serta Start Menu.
TargetName=$ixSetup
FriendlyName=E-LearningQu Desktop
AppLaunched=cmd.exe /c Install.cmd /nopause
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
$stringsBlock
[SourceFiles]
$sourceFilesBody
$sectionsBlock
"@
Set-Content -LiteralPath $sedPath -Value $sed -Encoding ASCII

# Catatan: JANGAN pakai /Q — IExpress Win11 exit 0 tanpa output. Zombie makecab juga harus dibersihkan.
# Pakai Start-Process + timeout karena tanpa /Q IExpress bisa hang di dialog error.
Get-Process IExpress -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process makecab -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
$ixp = Start-Process -FilePath "C:\Windows\System32\IExpress.exe" -ArgumentList "/N","`"$sedPath`"" -PassThru
$ixDeadline = (Get-Date).AddMinutes(15)
while (-not $ixp.HasExited -and (Get-Date) -lt $ixDeadline) { Start-Sleep -Seconds 10 }
if (-not $ixp.HasExited) {
    Stop-Process -Id $ixp.Id -Force -ErrorAction SilentlyContinue
    throw "IExpress timeout 15 menit"
}
if (-not (Test-Path $ixSetup)) { throw "IExpress selesai tapi Setup.exe tidak ada" }
Move-Item -LiteralPath $ixSetup -Destination $setupExe -Force
}
catch {
    Write-Host "  [WARN] Setup.exe (IExpress) dilewati: $($_.Exception.Message)"
    Write-Host "  [WARN] Gunakan zip + Install.cmd untuk instalasi."
}

$zipSize = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host ""
Write-Host "DONE"
if (Test-Path $setupExe) {
    $setupSize = [math]::Round((Get-Item $setupExe).Length / 1MB, 1)
    Write-Host "  Setup.exe : $setupExe ($setupSize MB)"
}
Write-Host "  Zip       : $zip ($zipSize MB)"
Write-Host "  Staging   : $staging"
