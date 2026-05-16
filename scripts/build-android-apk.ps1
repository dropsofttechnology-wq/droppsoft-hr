# Builds debug APK after npm run build:android. Requires Android Studio (bundled JBR) or JAVA_HOME.
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
  # Capacitor Android 8.x compiles with --release 21; JDK 17 fails with "invalid source release: 21"
  $candidates = @(
    "${env:ProgramFiles}\Eclipse Adoptium\jdk-21*",
    "${env:ProgramFiles}\Microsoft\jdk-21*",
    "${env:ProgramFiles}\Java\jdk-21",
    "$env:LOCALAPPDATA\Programs\Android\Android Studio\jbr",
    "${env:ProgramFiles}\Android\Android Studio\jbr",
    "${env:ProgramFiles}\Android\Android Studio1\jbr",
    "${env:ProgramFiles(x86)}\Android\Android Studio\jbr",
    "$env:LOCALAPPDATA\Android\Sdk\jbr",
    $env:JAVA_HOME,
    "${env:ProgramFiles}\Java\jdk-17",
    "${env:ProgramFiles}\Eclipse Adoptium\jdk-17*",
    "${env:ProgramFiles}\Microsoft\jdk-17*"
  )
  foreach ($p in $candidates) {
    if (-not $p) { continue }
    foreach ($d in (Get-Item $p -ErrorAction SilentlyContinue)) {
      $jdkRoot = $d.FullName
      if (Test-JdkAtLeast21 $jdkRoot) { return $jdkRoot }
    }
  }
  return $null
}

Write-Host "Dropsoft HR - building debug APK..." -ForegroundColor Cyan
if (-not (Test-Path "android\gradlew.bat")) {
  Write-Error "android\gradlew.bat not found. Run: npx cap add android (or pull repo with android/ folder)."
}

$jh = Find-JavaHome
if (-not $jh) {
  Write-Host ""
  Write-Host "No JDK 21+ found (Capacitor 8 requires Java 21 for the Android project)." -ForegroundColor Red
  Write-Host "Install Temurin 21, Android Studio with JBR 21+, or set JAVA_HOME to a JDK 21+ folder, then run npm run android:apk:win" -ForegroundColor Yellow
  exit 1
}

$env:JAVA_HOME = $jh
Write-Host "Using JAVA_HOME=$jh" -ForegroundColor Green
& npm run build:android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Push-Location android
& .\gradlew.bat assembleDebug --no-daemon
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { exit $code }

$debugDir = Join-Path $root "android\app\build\outputs\apk\debug"
$apk = Get-ChildItem -Path $debugDir -Filter "*.apk" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($apk) {
  Write-Host ""
  Write-Host "OK: $($apk.FullName)" -ForegroundColor Green
} else {
  Write-Warning 'Gradle reported success but APK not found in debug output folder.'
}
