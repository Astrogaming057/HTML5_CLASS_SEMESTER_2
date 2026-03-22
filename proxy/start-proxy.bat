@echo off
cd /d "%~dp0"
echo Starting Astro Code remote proxy...
echo Default: http://127.0.0.1:3030  (set PORT to change)
echo.

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

node proxy\index.js
if errorlevel 1 (
    echo.
    echo Proxy exited with an error.
    pause
)
