@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

REM Build + default install dir (Program Files) require elevation; avoid random failures.
>nul 2>&1 net session
if %errorlevel% neq 0 (
    echo Requesting administrator rights for Windows build/install...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -Verb RunAs -FilePath '%~f0'"
    exit /b 0
)

echo Building installer...
call npm run build:win
if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    pause
    exit /b %ERRORLEVEL%
)

echo Build completed successfully!
echo Launching installer...

cd dist
set "INSTALLER="
for %%f in ("Astro Code Setup *.exe") do (
    set "INSTALLER=%%~f"
    goto :launch
)

echo ERROR: No NSIS installer found in dist folder (expected Astro Code Setup *.exe).
echo Run build:win and check dist\ for the setup executable.
pause
exit /b 1

:launch
start "" "!INSTALLER!"
echo Installer launched: !INSTALLER!
cd ..
endlocal
