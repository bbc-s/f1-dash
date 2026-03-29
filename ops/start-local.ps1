param(
    [switch]$LanMode,
    [switch]$BuildFromSource
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path "compose.env")) {
    Copy-Item "compose.env.example" "compose.env"
}

$dockerCliPath = "C:\Program Files\Docker\Docker\resources\bin"
if (Test-Path $dockerCliPath) {
    $env:Path += ";$dockerCliPath"
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI is not available. Install Docker Desktop first."
}

$engineReady = $false
for ($i = 0; $i -lt 6; $i++) {
    try {
        docker info *> $null
        if ($LASTEXITCODE -eq 0) {
            $engineReady = $true
            break
        }
    } catch {
    }

    if ($i -eq 0) {
        Start-Process -FilePath "C:\Program Files\Docker\Docker\Docker Desktop.exe" | Out-Null
    }
    Start-Sleep -Seconds 20
}

if (-not $engineReady) {
    throw "Docker Engine is not ready. Open Docker Desktop and wait until status is Running."
}

powershell -ExecutionPolicy Bypass -File ".\ops\backup-state.ps1"

if ($BuildFromSource) {
    if ($LanMode) {
        docker compose --env-file compose.env -f compose.yaml -f compose.local-build.yaml -f compose.lan.yaml up -d --build
    } else {
        docker compose --env-file compose.env -f compose.yaml -f compose.local-build.yaml up -d --build
    }
} else {
    if ($LanMode) {
        docker compose --env-file compose.env -f compose.yaml -f compose.lan.yaml up -d --pull always
    } else {
        docker compose --env-file compose.env -f compose.yaml up -d --pull always
    }
}

docker compose --env-file compose.env ps
