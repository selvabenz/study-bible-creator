$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'Node.js 22+ is required for the current development build.'
}
Start-Process 'http://127.0.0.1:4173'
node src/server.mjs
