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

Set-Content -Encoding UTF8 "VERSION" $newVersion

$packagePath = "dashboard\package.json"
$package = Get-Content $packagePath -Raw
$updatedPackage = [regex]::Replace($package, '"version"\s*:\s*"[0-9]+\.[0-9]+\.[0-9]+"', '"version": "' + $newVersion + '"', 1)
Set-Content -Encoding UTF8 $packagePath $updatedPackage

Write-Output "Version bumped: $current -> $newVersion"
