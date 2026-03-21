@echo off
cd /d "%~dp0"
node "%~dp0scan-folder.mjs" %*
if errorlevel 1 pause
exit /b %errorlevel%
pause