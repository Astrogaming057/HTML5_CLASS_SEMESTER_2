@echo off
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
if exist "Astro Code Setup 1.0.0.exe" (
    start "" "Astro Code Setup 1.0.0.exe"
    echo Installer launched!
    goto :done
)

echo Installer not found with exact name, searching...
for %%f in ("Astro Code Setup"*.exe) do (
    echo Found installer: %%f
    start "" "%%f"
    echo Installer launched!
    goto :done
)

echo ERROR: No installer found in dist folder!
pause
exit /b 1

:done
cd ..