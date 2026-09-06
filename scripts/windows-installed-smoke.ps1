param(
  [Parameter(Mandatory=$true)][string]$InstallerPath
)
$ErrorActionPreference = 'Stop'
$installer = (Resolve-Path $InstallerPath).Path
Write-Host "Installing $installer silently..."
$install = Start-Process -FilePath $installer -ArgumentList '/S' -PassThru -Wait
if ($install.ExitCode -ne 0) { throw "NSIS installer failed with exit code $($install.ExitCode)" }

$candidates = @(
  (Join-Path $env:LOCALAPPDATA 'Study Bible Creator\Study Bible Creator.exe'),
  (Join-Path $env:ProgramFiles 'Study Bible Creator\Study Bible Creator.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Study Bible Creator\Study Bible Creator.exe')
) | Where-Object { $_ -and (Test-Path $_) }

if (-not $candidates) {
  $found = Get-ChildItem -Path $env:LOCALAPPDATA -Filter 'Study Bible Creator.exe' -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) { $candidates = @($found.FullName) }
}
if (-not $candidates) { throw 'Installed Study Bible Creator executable was not found.' }
$app = $candidates[0]
Write-Host "Launching installed app: $app"

$expectedLog = Join-Path $env:LOCALAPPDATA 'org.bridgeconn.studybiblecreator\startup.log'
if (Test-Path $expectedLog) { Remove-Item $expectedLog -Force }
$started = Get-Date
$process = Start-Process -FilePath $app -PassThru
$logPath = $null
try {
  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path $expectedLog) { $logPath = $expectedLog }
    if (-not $logPath) {
      $recent = Get-ChildItem -Path $env:LOCALAPPDATA -Filter 'startup.log' -File -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -ge $started.AddSeconds(-2) } |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if ($recent) { $logPath = $recent.FullName }
    }
    if ($logPath -and (Test-Path $logPath)) {
      $content = Get-Content $logPath -Raw
      if ($content -match 'main_window_navigated=true') {
        Write-Host 'Installed runtime smoke passed.'
        Write-Host $content
        exit 0
      }
      if ($content -match ' ERROR ') {
        throw "Installed app reported a startup error.`n$content"
      }
    }
    if ($process.HasExited) {
      $detail = if ($logPath -and (Test-Path $logPath)) { Get-Content $logPath -Raw } else { '<no startup.log>' }
      throw "Installed app exited before readiness with code $($process.ExitCode).`n$detail"
    }
    Start-Sleep -Milliseconds 500
    $process.Refresh()
  }
  $detail = if ($logPath -and (Test-Path $logPath)) { Get-Content $logPath -Raw } else { '<no startup.log>' }
  throw "Installed app did not become ready within 60 seconds.`n$detail"
}
finally {
  if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
}
