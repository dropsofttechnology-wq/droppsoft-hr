# Dropsoft HR — Android APK (Capacitor)

The mobile build is a **WebView** around the same React app. It talks to the **same HR REST API** as the desktop app (your PC or server running `npm run server` / Dropsoft HR with `HR_API_BIND=0.0.0.0`). There is **no SQLite database inside the APK**.

## Prerequisites

- **Node.js** (for builds)
- **JDK 17+** and **Android Studio** (or `JAVA_HOME` set so `android/gradlew.bat` runs)
- HR API reachable from the phone (**same Wi‑Fi** or VPN), typically `http://<server-lan-ip>:32100`

**Build order:** `npm run build:android` produces `dist/` with **relative** asset paths for Capacitor. Before packaging **Windows Electron** again, run `npm run build` (default Vite build, base `/`) so the desktop app’s `dist/` is correct.

## One-time: set the server URL

1. Copy `.env.android` to `.env.android.local` (optional; `.env.android` is committed with a default).
2. Set **`VITE_ANDROID_API_URL`** to your API base (no trailing slash), e.g.  
   - Physical device: `http://192.168.1.50:32100`  
   - Android Emulator → Windows host: `http://10.0.2.2:32100`  
3. Rebuild the web assets and sync:

```bash
npm run build:android
```

4. Build the debug APK:

**Windows (auto-find Android Studio JDK):**

```powershell
npm run android:apk:win
```

**If `gradlew` says `JAVA_HOME is not set`:** install [Android Studio](https://developer.android.com/studio), then either set **`JAVA_HOME`** to its **`jbr`** folder (e.g. `C:\Program Files\Android\Android Studio\jbr`), or from the repo root run:

```bat
npm run build:android
npm run android:assemble
```

(`android:assemble` runs `scripts\assemble-android-debug.cmd`, which auto-detects the Studio JDK on Windows, including `C:\Program Files\Android\Android Studio1\jbr`.)

**JAVA_HOME** must be the **`jbr`** folder inside Android Studio (bundled JDK), not the `Android Studio1` folder itself — e.g. `C:\Program Files\Android\Android Studio1\jbr`.

### “Could not reach … 127.0.0.1” on the phone

`127.0.0.1` on Android is **the phone**, not your PC. Set **`VITE_ANDROID_API_URL`** in **`.env.android`** (or **`.env.android.local`**) to your **PC’s LAN IP**, e.g. `http://192.168.1.50:32100`, then **`npm run build:android`** and **`npm run android:assemble`** again. The app now ignores desktop **`VITE_LOCAL_API_URL`** in the Capacitor build so this mistake is harder to repeat.

**Manual (after `JAVA_HOME` points to JDK 17+, e.g. Android Studio `jbr`):**

```bash
npm run android:apk
```

Or open the `android` folder in **Android Studio** → **Build → Build APK(s)**.

### Where is the APK? (important)

Gradle does **not** put the installable APK in `android/build/` at the repo root.

The debug APK is here:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Notice **`app/build`** (the **app** module), then **`outputs/apk/debug`**.

From the project root, check:

```bash
npm run android:apk-path
```

If that path is missing but Gradle said **BUILD SUCCESSFUL**, confirm you ran **`assembleDebug`** (or **`npm run android:apk`**) and that you are looking on the **same machine** where Gradle ran. Some tools hide `build/` folders in the editor — use **File Explorer** or the path above.

Debug APK output (full path):

`android/app/build/outputs/apk/debug/app-debug.apk`

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run build:android` | `vite build --mode android` + `cap sync android` |
| `npm run android:open` | Opens the `android` project in Android Studio |
| `npm run android:apk` | Build web + sync + `gradlew assembleDebug` |

## Runtime override (optional)

The app reads **`hr_api_base_url`** from **Capacitor Preferences** if set (future in-app setting). Otherwise it uses **`VITE_ANDROID_API_URL`** from the build.

## Cleartext HTTP

The Android template allows **HTTP** to your LAN API (`network_security_config.xml`). Use **HTTPS** only if you terminate TLS in front of the API.

## Notes

- **Face enrollment** needs **camera** permission (requested at runtime by the browser/WebView stack where supported).
- **Hash routing** is enabled for Android (`#/dashboard`, etc.).
- Electron **Windows** packaging excludes the `android/` folder from the desktop installer.
