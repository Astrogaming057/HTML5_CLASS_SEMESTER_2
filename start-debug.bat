@echo off
cd /d "%~dp0"
set HTMLCLASS_DEBUG=1
set NODE_OPTIONS=--trace-warnings
echo HTMLCLASS server DEBUG
echo - Verbose HTTP request logging
echo - uncaughtException / unhandledRejection logged
echo - GET /__api__/mode includes "debug": true
echo.

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

cd server
node index.js
if errorlevel 1 (
    echo.
    echo Server exited with an error.
    pause
)
