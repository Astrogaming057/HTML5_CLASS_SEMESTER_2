@echo off
echo ========================================
echo   HTML Class IDE - Update from GitHub
echo ========================================
echo.

REM Check if git is available
where git >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git is not installed or not in PATH
    echo Please install Git from https://git-scm.com/
    pause
    exit /b 1
)

echo [1/4] Checking current status...
git status
echo.

echo [2/4] Fetching latest changes from GitHub...
git fetch origin
if errorlevel 1 (
    echo ERROR: Failed to fetch from GitHub
    pause
    exit /b 1
)
echo.

echo [3/4] Pulling latest changes...
git pull origin main
if errorlevel 1 (
    echo.
    echo WARNING: Git pull encountered conflicts or errors
    echo You may need to resolve conflicts manually
    pause
    exit /b 1
)
echo.

echo [4/4] Updating dependencies...
if exist "package.json" (
    echo Installing/updating npm packages...
    call npm install
    if errorlevel 1 (
        echo WARNING: npm install encountered errors
    ) else (
        echo Dependencies updated successfully
    )
) else (
    echo No package.json found, skipping dependency update
)
echo.

echo ========================================
echo   Update Complete!
echo ========================================
echo.
echo Changes have been pulled from GitHub.
echo Dependencies have been updated.
echo.
echo Note: If the server is running, you may need to restart it.
echo.

pause
