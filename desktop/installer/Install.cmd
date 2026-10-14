@echo off
setlocal EnableExtensions
title Installer E-LearningQu Desktop

set "DEST=%LocalAppData%\Programs\E-LearningQu"
set "EXE=E-LearningQu.Desktop.exe"

rem  Normalisasi path sumber: buang trailing backslash agar " \"% " tidak merusak parser robocopy
for %%I in ("%~dp0.") do set "SRC=%%~fI"

echo.
echo  ============================================
echo   Installer E-LearningQu Desktop
echo  ============================================
echo.
echo  Sumber : %SRC%
echo  Tujuan : %DEST%
echo.

if not exist "%SRC%\%EXE%" (
    echo  [ERROR] %EXE% tidak ditemukan di folder installer ini.
    echo  Pastikan Install.cmd berada sejajar dengan %EXE%.
    echo.
    pause
    exit /b 1
)

rem  Tutup aplikasi yang sedang berjalan; file terkunci membuat penyalinan parsial/gagal
tasklist /FI "IMAGENAME eq %EXE%" 2>nul | find /I "%EXE%" >nul
if not errorlevel 1 (
    echo  [INFO] Aplikasi sedang berjalan - menutup dulu...
    taskkill /IM %EXE% /F >nul 2>&1
    ping -n 3 127.0.0.1 >nul
)

echo  [1/2] Menyalin file aplikasi...
robocopy "%SRC%" "%DEST%" /E /XD "dist" /R:3 /W:2 /NFL /NDL /NJH /NJS /NP >nul
set "RC=%ERRORLEVEL%"
if %RC% GEQ 8 (
    echo  [ERROR] Penyalinan file gagal. Kode: %RC%
    echo  Pastikan tidak ada program yang mengunci file di %DEST%,
    echo  lalu jalankan Install.cmd ini lagi.
    echo.
    pause
    exit /b 1
)

if not exist "%DEST%\%EXE%" (
    echo  [ERROR] %EXE% tidak ditemukan di tujuan setelah penyalinan.
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
