@echo off
setlocal EnableExtensions
title Uninstaller E-LearningQu Desktop

set "DEST=%LocalAppData%\Programs\E-LearningQu"

echo.
echo  ============================================
echo   Uninstaller E-LearningQu Desktop
echo  ============================================
echo.
echo  Menghapus %DEST% dan shortcut...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws=New-Object -ComObject WScript.Shell;" ^
  "foreach($p in @([Environment]::GetFolderPath('Desktop')+'\E-LearningQu Desktop.lnk',[Environment]::GetFolderPath('Programs')+'\E-LearningQu Desktop.lnk')){ if(Test-Path $p){ Remove-Item $p -Force } }"

if exist "%DEST%" rmdir /S /Q "%DEST%"

echo.
echo  Uninstall selesai.
echo.
pause
exit /b 0
