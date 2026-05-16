$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Get-JavaMajorVersion([string]$javaExe) {
  $old = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $err = & $javaExe -version 2>&1 | Out-String
  } finally {
    $ErrorActionPreference = $old
  }
  if ($err -match 'version "(\d+)') { return [int]$Matches[1] }
  if ($err -match 'version "1\.(\d+)') { return [int]$Matches[1] }
  return 0
}

function Test-JdkAtLeast21([string]$jdkRoot) {
  $je = Join-Path $jdkRoot "bin\java.exe"
  if (-not (Test-Path $je)) { return $false }
  return (Get-JavaMajorVersion $je) -ge 21
}

function Find-JavaHome {
  $candidates = @(
    "${env:ProgramFiles}\Eclipse Adoptium\jdk-21*",
    "${env:ProgramFiles}\Microsoft\jdk-21*",
    "${env:ProgramFiles}\Java\jdk-21",
    "$env:LOCALAPPDATA\Programs\Android\Android Studio\jbr",
    "${env:ProgramFiles}\Android\Android Studio\jbr",
    "${env:ProgramFiles}\Android\Android Studio1\jbr",
    "${env:ProgramFiles(x86)}\Android\Android Studio\jbr",
    "$env:LOCALAPPDATA\Android\Sdk\jbr",
    $env:JAVA_HOME
  )
  foreach ($p in $candidates) {
    if (-not $p) { continue }
    foreach ($d in (Get-Item $p -ErrorAction SilentlyContinue)) {
      if (Test-JdkAtLeast21 $d.FullName) { return $d.FullName }
    }
  }
  return $null
}

Write-Host "Dropsoft HR - building Play Store bundle..." -ForegroundColor Cyan
if (-not (Test-Path "android\gradlew.bat")) {
  Write-Error "android\gradlew.bat not found."
}

$jh = Find-JavaHome
if (-not $jh) {
  Write-Error "JDK 21+ is required for the Android project."
}
$env:JAVA_HOME = $jh
Write-Host "Using JAVA_HOME=$jh" -ForegroundColor Green

& npm run build:android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Push-Location android
& .\gradlew.bat bundleRelease --no-daemon
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { exit $code }

$bundleDir = Join-Path $root "android\app\build\outputs\bundle\release"
$bundle = Get-ChildItem -Path $bundleDir -Filter "*.aab" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($bundle) {
  Write-Host ""
  Write-Host "OK: $($bundle.FullName)" -ForegroundColor Green
} else {
  Write-Warning "Gradle reported success but AAB not found in release bundle folder."
}
