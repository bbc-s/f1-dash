param(
  [switch]$NoCache = $true
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$composeArgs = @('--env-file','compose.env','-f','compose.yaml','-f','compose.local-build.yaml')

Write-Host '==> stopping stack'
docker compose @composeArgs down

Write-Host '==> building images'
if ($NoCache) {
  docker compose @composeArgs build --no-cache web api realtime archive
} else {
  docker compose @composeArgs build web api realtime archive
}

Write-Host '==> starting stack'
docker compose @composeArgs up -d --force-recreate

Write-Host '==> verifying web'
$resp = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/dashboard
if ($resp.StatusCode -ne 200) {
  throw "Dashboard check failed with status $($resp.StatusCode)"
}

if ($resp.Content -notmatch 'Version:\s*</p>|Version:') {
  Write-Warning 'Dashboard responded but footer marker not found.'
}

Write-Host '==> done'
docker compose @composeArgs ps
