@echo off
setlocal EnableExtensions
title Installer E-LearningQu Desktop

set "DEST=%LocalAppData%\Programs\E-LearningQu"
set "EXE=E-LearningQu.Desktop.exe"

echo.
echo  ============================================
echo   Installer E-LearningQu Desktop
echo  ============================================
echo.
echo  Tujuan : %DEST%
echo.

if not exist "%~dp0%EXE%" (
    echo  [ERROR] %EXE% tidak ditemukan di folder installer ini.
    echo  Pastikan Install.cmd berada sejajar dengan %EXE%.
    echo.
    pause
    exit /b 1
)

echo  [1/2] Menyalin file aplikasi...
robocopy "%~dp0" "%DEST%" /E /XD "dist" /NFL /NDL /NJH /NJS /NP >nul
if %ERRORLEVEL% GEQ 8 (
    echo  [ERROR] Penyalinan file gagal. Kode: %ERRORLEVEL%
    echo.
    pause
    exit /b 1
)

echo  [2/2] Membuat shortcut (Desktop + Start Menu)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws=New-Object -ComObject WScript.Shell;" ^
  "$exe='%DEST%\%EXE%';" ^
  "$d=$ws.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\E-LearningQu Desktop.lnk');$d.TargetPath=$exe;$d.WorkingDirectory='%DEST%';$d.Save();" ^
  "$m=$ws.CreateShortcut([Environment]::GetFolderPath('Programs')+'\E-LearningQu Desktop.lnk');$m.TargetPath=$exe;$m.WorkingDirectory='%DEST%';$m.Save()"
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Gagal membuat shortcut.
    pause
    exit /b 1
)

echo.
echo  ============================================
echo   Instalasi selesai!
echo   Jalankan dari Desktop: "E-LearningQu Desktop"
echo  ============================================
echo.
if /I not "%~1"=="/nopause" pause
exit /b 0
