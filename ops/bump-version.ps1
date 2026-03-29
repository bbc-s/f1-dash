$ErrorActionPreference = "Stop"

if (-not (Test-Path "VERSION")) {
    throw "VERSION file not found"
}

$current = (Get-Content "VERSION" -Raw).Trim()
if ($current -notmatch '^(\d+)\.(\d+)\.(\d+)$') {
    throw "VERSION must be in format MAJOR.MINOR.PATCH"
}

$major = [int]$Matches[1]
$minor = [int]$Matches[2]
$patch = [int]$Matches[3] + 1
$newVersion = "$major.$minor.$patch"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path "VERSION"), "$newVersion`n", $utf8NoBom)

$packagePath = "dashboard\package.json"
$package = Get-Content $packagePath -Raw
$updatedPackage = [regex]::Replace($package, '"version"\s*:\s*"[0-9]+\.[0-9]+\.[0-9]+"', '"version": "' + $newVersion + '"', 1)
[System.IO.File]::WriteAllText((Resolve-Path $packagePath), $updatedPackage, $utf8NoBom)

Write-Output "Version bumped: $current -> $newVersion"
