@echo off
cd /d "%~dp0"
echo Installing npm dependencies (includes proxy: bcryptjs, cors, http-proxy, jsonwebtoken)...
echo.
call npm install
if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
)
echo.
echo Done. Run start-proxy.bat to launch the proxy.
pause
