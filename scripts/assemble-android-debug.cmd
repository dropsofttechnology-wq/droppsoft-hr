@echo off

setlocal EnableDelayedExpansion



REM Runs assembleDebug. Capacitor Android 8+ needs JDK 21+ (not 17). Prefer Temurin 21 over JAVA_HOME.

REM From repo root: npm run android:assemble



set "ROOT=%~dp0.."

cd /d "%ROOT%"



REM 1) Prefer JDK 21 installs (JAVA_HOME may still point to JDK 17)

for /d %%J in ("%ProgramFiles%\Eclipse Adoptium\jdk-21*") do (

  if exist "%%~J\bin\java.exe" (

    set "JAVA_HOME=%%~J"

    goto have_java

  )

)

for /d %%J in ("%ProgramFiles%\Microsoft\jdk-21*") do (

  if exist "%%~J\bin\java.exe" (

    set "JAVA_HOME=%%~J"

    goto have_java

  )

)

if exist "%ProgramFiles%\Java\jdk-21\bin\java.exe" (

  set "JAVA_HOME=%ProgramFiles%\Java\jdk-21"

  goto have_java

)



if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" goto have_java



if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" (

  set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"

  goto have_java

)

if exist "%ProgramFiles%\Android\Android Studio1\jbr\bin\java.exe" (

  set "JAVA_HOME=%ProgramFiles%\Android\Android Studio1\jbr"

  goto have_java

)

if exist "%ProgramFiles(x86)%\Android\Android Studio\jbr\bin\java.exe" (

  set "JAVA_HOME=%ProgramFiles(x86)%\Android\Android Studio\jbr"

  goto have_java

)

if exist "%LOCALAPPDATA%\Programs\Android\Android Studio\jbr\bin\java.exe" (

  set "JAVA_HOME=%LOCALAPPDATA%\Programs\Android\Android Studio\jbr"

  goto have_java

)



echo.

echo ERROR: No JDK 21+ found. Capacitor 8 requires Java 21 for Gradle.

echo Install Temurin 21 ^(e.g. winget install EclipseAdoptium.Temurin.21.JDK^) or set JAVA_HOME to JDK 21+.

echo.

exit /b 1



:have_java

echo Using JAVA_HOME=%JAVA_HOME%

echo.

cd /d "%ROOT%\android"

call gradlew.bat assembleDebug %*

set "ERR=%ERRORLEVEL%"

cd /d "%ROOT%"

exit /b %ERR%

