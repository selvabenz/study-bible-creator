@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Node.js 22+ is required for the current development build.
  pause
  exit /b 1
)
echo Starting Study Bible Creator development build...
start "" http://127.0.0.1:4173
node src\server.mjs
