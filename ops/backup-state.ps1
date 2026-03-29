param(
    [string]$Version = "",
    [string]$OutputRoot = "backups\runs"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Version) -and (Test-Path "VERSION")) {
    $Version = (Get-Content "VERSION" -Raw).Trim()
}
if ([string]::IsNullOrWhiteSpace($Version)) {
    $Version = "0.0.0"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$targetDir = Join-Path $OutputRoot "v$Version\$timestamp"
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

$filesToCopy = @(
    "compose.yaml",
    "compose.lan.yaml",
    "compose.env.example",
    "VERSION",
    "SETUP.md",
    "README.md"
)

foreach ($file in $filesToCopy) {
    if (Test-Path $file) {
        Copy-Item $file (Join-Path $targetDir $file.Replace("\", "_")) -Force
    }
}

$envArgs = @()
if (Test-Path "compose.env") {
    Copy-Item "compose.env" (Join-Path $targetDir "compose.env.local") -Force
    $envArgs = @("--env-file", "compose.env")
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($null -ne $docker) {
    try {
        & docker compose @envArgs config | Out-File -Encoding utf8 (Join-Path $targetDir "compose.resolved.yaml")
        & docker compose @envArgs ps --format json | Out-File -Encoding utf8 (Join-Path $targetDir "compose.ps.json")
    } catch {
        $_.Exception.Message | Out-File -Encoding utf8 (Join-Path $targetDir "docker-unavailable.txt")
    }
}

Write-Output "Backup created: $targetDir"
