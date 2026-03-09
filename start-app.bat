@echo off
echo Starting HTML Class IDE in App Mode...
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

REM Check if electron is installed
call npm list electron >nul 2>&1
if errorlevel 1 (
    echo Installing Electron...
    call npm install electron --save-dev
    echo.
)

echo Launching application...
echo.
node_modules\.bin\electron app\main.js

if errorlevel 1 (
    echo.
    echo Error: Could not start Electron. Trying with npx...
    npx electron app\main.js
)

echo.
echo Application exited. Press any key to close...
pause
