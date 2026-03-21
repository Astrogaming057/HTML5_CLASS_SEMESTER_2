@echo off
cd /d "%~dp0"
set PROXY_DEBUG=1
set HTMLCLASS_PROXY_DEBUG=true
set NODE_OPTIONS=--trace-warnings
echo HTMLCLASS Remote Proxy DEBUG
echo - Request logging to console
echo - GET /api/remote/status reports proxyDebug: true
echo.

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

node index.js
if errorlevel 1 (
    echo.
    echo Proxy exited with an error.
    pause
)
