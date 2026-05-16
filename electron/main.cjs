const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')
const { execFile } = require('child_process')
const http = require('http')
const AdmZip = require('adm-zip')

let mainWindow
let apiPort
let connectWindow

function getDataDir() {
  if (process.platform === 'win32') {
    const base = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    return path.join(base, 'DropsoftHR')
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'DropsoftHR')
  }
  return path.join(os.homedir(), '.config', 'DropsoftHR')
}

/**
 * Central HR server URL for thin-client Electron (no local SQLite/API on this PC).
 * Priority: HR_REMOTE_API_URL env → %AppData%\\DropsoftHR\\remote-api.json
 * One-time file setup: run "DROPSOFT SCH erp.exe" --set-server
 */
function normalizeApiOrigin(raw) {
  if (raw == null || !String(raw).trim()) return null
  let s = String(raw).trim().replace(/\/$/, '')
  if (!/^https?:\/\//i.test(s)) {
    s = `http://${s}`
  }
  try {
    const u = new URL(s)
    if (!u.hostname) return null
    return u.origin
  } catch {
    return null
  }
}

function readRemoteApiFromFile() {
  try {
    const p = path.join(getDataDir(), 'remote-api.json')
    if (!fs.existsSync(p)) return null
    const j = JSON.parse(fs.readFileSync(p, 'utf8'))
    const url = j.baseUrl ?? j.baseURL ?? j.url ?? j.remoteApiBase
    return normalizeApiOrigin(url)
  } catch {
    return null
  }
}

function resolveRemoteApiBase() {
  const fromEnv = normalizeApiOrigin(process.env.HR_REMOTE_API_URL)
  if (fromEnv) return fromEnv
  return readRemoteApiFromFile()
}

function getRemoteApiBase() {
  return resolveRemoteApiBase()
}

/** Merge server role: API listens on LAN (other PCs connect to this machine). */
function writeServerEnvLocal() {
  const p = path.join(getDataDir(), '.env.local')
  let raw = ''
  try {
    if (fs.existsSync(p)) raw = fs.readFileSync(p, 'utf8')
  } catch (_) {}
  const map = new Map()
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    map.set(t.slice(0, eq).trim(), t.slice(eq + 1).trim())
  }
  if (!map.has('HR_API_PORT')) map.set('HR_API_PORT', '32100')
  map.set('HR_API_BIND', '0.0.0.0')
  const out = []
  for (const [k, v] of map.entries()) {
    out.push(`${k}=${v}`)
  }
  fs.mkdirSync(getDataDir(), { recursive: true })
  fs.writeFileSync(p, out.join('\n') + '\n', 'utf8')
}

/** When this PC hosts the database/API, listen on all interfaces for LAN clients. */
function ensureLocalServerBinding() {
  if (resolveRemoteApiBase()) return
  writeServerEnvLocal()
}

function ensureWindowsFirewallRule(port) {
  if (process.platform !== 'win32') return
  const p = Number(port)
  if (!Number.isFinite(p) || p <= 0 || p >= 65536) return
  const ruleName = 'DROPSOFT SCH erp API'
  execFile(
    'netsh',
    [
      'advfirewall',
      'firewall',
      'add',
      'rule',
      `name=${ruleName}`,
      'dir=in',
      'action=allow',
      'protocol=TCP',
      `localport=${p}`,
      'profile=private',
      'enable=yes'
    ],
    { windowsHide: true },
    () => {}
  )
}

function getSetupCompletePath() {
  return path.join(getDataDir(), 'setup-complete.json')
}

/**
 * First packaged launch: ask server vs client unless already configured.
 * Skipped if remote-api.json or hr.db or setup-complete.json exists.
 */
function needsRoleSetup() {
  if (!app.isPackaged) return false
  if (process.argv.includes('--skip-role-setup')) return false
  const dir = getDataDir()
  if (fs.existsSync(getSetupCompletePath())) return false
  if (fs.existsSync(path.join(dir, 'remote-api.json'))) return false
  if (fs.existsSync(path.join(dir, 'hr.db'))) return false
  return true
}

let setupWizardFinishedOk = false
let setupRoleWizardWindow = null

async function applyRoleSetup(payload) {
  const role = payload && payload.role
  if (role !== 'server' && role !== 'client') {
    return { error: 'Choose Server or Client.' }
  }
  const dir = getDataDir()
  fs.mkdirSync(dir, { recursive: true })

  if (role === 'server') {
    const remotePath = path.join(dir, 'remote-api.json')
    if (fs.existsSync(remotePath)) {
      try {
        fs.unlinkSync(remotePath)
      } catch (_) {}
    }
    writeServerEnvLocal()
    fs.writeFileSync(
      getSetupCompletePath(),
      JSON.stringify({ role: 'server', version: 1, at: new Date().toISOString() }, null, 2),
      'utf8'
    )
    return { ok: true }
  }

  const origin = normalizeApiOrigin(payload.serverUrl)
  if (!origin) {
    return { error: 'Enter a valid server URL, e.g. http://192.168.1.10:32100' }
  }
  const skipHealthCheck = payload && payload.skipHealthCheck === true
  if (!skipHealthCheck) {
    const healthy = await checkRemoteHealth(origin)
    if (!healthy) {
      return {
        error:
          'Cannot reach the server at ' +
          origin +
          '.\n\nCheck the IP and port, that the server PC is running DROPSOFT SCH erp, and Windows Firewall allows that port.'
      }
    }
  }
  fs.writeFileSync(
    path.join(dir, 'remote-api.json'),
    JSON.stringify({ baseUrl: origin }, null, 2),
    'utf8'
  )
  fs.writeFileSync(
    getSetupCompletePath(),
    JSON.stringify({ role: 'client', version: 1, at: new Date().toISOString() }, null, 2),
    'utf8'
  )
  return { ok: true }
}

function getInstallPendingPath() {
  return path.join(getDataDir(), 'install-pending.cfg')
}

function parseInstallPendingCfg(raw) {
  const kv = {}
  for (const line of String(raw || '').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    kv[t.slice(0, eq).trim().toLowerCase()] = t.slice(eq + 1).trim()
  }
  return kv
}

/** NSIS installer writes install-pending.cfg; apply and relaunch (retries if server not reachable yet). */
async function tryConsumeInstallPending() {
  if (!app.isPackaged) return false
  const pendingPath = getInstallPendingPath()
  if (!fs.existsSync(pendingPath)) return false
  let raw = ''
  try {
    raw = fs.readFileSync(pendingPath, 'utf8')
  } catch (_) {
    return false
  }
  const kv = parseInstallPendingCfg(raw)
  const role = (kv.role || '').toLowerCase()
  if (role !== 'server' && role !== 'client') {
    try {
      fs.unlinkSync(pendingPath)
    } catch (_) {}
    return false
  }

  let result
  if (role === 'server') {
    result = await applyRoleSetup({ role: 'server' })
  } else {
    result = await applyRoleSetup({
      role: 'client',
      serverUrl: kv.serverurl || kv.server_url || '',
      // Installer should persist intended server URL even if the server is still booting.
      skipHealthCheck: true
    })
  }

  if (result.error) {
    try {
      dialog.showMessageBoxSync({
        type: 'warning',
        title: 'DROPSOFT SCH erp — setup',
        message: 'Could not finish setup from the installer.',
        detail: String(result.error),
        buttons: ['OK']
      })
    } catch (_) {}
    return false
  }

  try {
    fs.unlinkSync(pendingPath)
  } catch (_) {}

  setupWizardFinishedOk = true
  setImmediate(() => {
    app.relaunch()
    app.exit(0)
  })
  return true
}

function openRoleSetupWindow() {
  return new Promise((resolve) => {
    const icon = getWindowIconPath()
    const win = new BrowserWindow({
      width: 720,
      height: 640,
      minWidth: 400,
      minHeight: 480,
      resizable: true,
      autoHideMenuBar: true,
      title: 'DROPSOFT SCH erp — Setup',
      icon: fs.existsSync(icon) ? icon : undefined,
      webPreferences: {
        preload: path.join(__dirname, 'setup-role-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    win.loadFile(path.join(__dirname, 'setup-role.html'))
    win.on('closed', () => resolve())
  })
}

async function checkRemoteHealth(baseOrigin) {
  try {
    const res = await fetch(`${baseOrigin.replace(/\/$/, '')}/api/health`, {
      signal: AbortSignal.timeout(15000)
    })
    return res.ok
  } catch {
    return false
  }
}

function getDbPath() {
  return path.join(getDataDir(), 'hr.db')
}

function getPortFilePath() {
  return path.join(getDataDir(), 'api-port.txt')
}

/** Apply a restore zip uploaded via Settings (before opening hr.db). */
function applyPendingRestoreIfAny() {
  const dataDir = getDataDir()
  const flagPath = path.join(dataDir, 'restore-pending.json')
  const zipPath = path.join(dataDir, 'pending-restore.zip')
  if (!fs.existsSync(flagPath) || !fs.existsSync(zipPath)) return
  try {
    const zip = new AdmZip(zipPath)
    const tempDir = path.join(dataDir, '_restore_tmp')
    fs.mkdirSync(tempDir, { recursive: true })
    zip.extractAllTo(tempDir, true)
    const extractedDb = path.join(tempDir, 'hr.db')
    if (!fs.existsSync(extractedDb)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
      try {
        fs.unlinkSync(flagPath)
      } catch (_) {}
      try {
        fs.unlinkSync(zipPath)
      } catch (_) {}
      return
    }
    const liveDb = getDbPath()
    fs.mkdirSync(path.dirname(liveDb), { recursive: true })
    if (fs.existsSync(liveDb)) {
      fs.copyFileSync(liveDb, `${liveDb}.bak.${Date.now()}`)
    }
    fs.copyFileSync(extractedDb, liveDb)
    const uploadsExtracted = path.join(tempDir, 'uploads')
    const uploadsLive = path.join(dataDir, 'uploads')
    if (fs.existsSync(uploadsExtracted)) {
      fs.mkdirSync(uploadsLive, { recursive: true })
      fs.cpSync(uploadsExtracted, uploadsLive, { recursive: true })
    }
    fs.rmSync(tempDir, { recursive: true, force: true })
    fs.unlinkSync(zipPath)
    fs.unlinkSync(flagPath)
    console.log('[DROPSOFT SCH erp] Restored database from uploaded backup.')
  } catch (e) {
    console.error('[DROPSOFT SCH erp] Pending restore failed:', e)
    try {
      fs.unlinkSync(flagPath)
    } catch (_) {}
  }
}

async function ensureDatabaseExists() {
  const dbPath = getDbPath()
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  if (fs.existsSync(dbPath)) return
  const initMod = path.join(__dirname, '..', 'scripts', 'init-hr-sqlite.js')
  const { runSqliteBootstrap } = await import(pathToFileURL(initMod).href)
  try {
    runSqliteBootstrap(dbPath)
  } catch (e) {
    const detail = e && e.message ? e.message : String(e)
    throw new Error(`Failed to initialize local SQLite database: ${detail}`)
  }
}

function checkHealth(port) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        host: '127.0.0.1',
        port,
        path: '/api/health',
        timeout: 1500
      },
      (res) => {
        res.resume()
        resolve(res.statusCode === 200)
      }
    )
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    req.on('error', () => resolve(false))
  })
}

async function waitForHealth(port, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await checkHealth(port)
    if (ok) return true
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

/** ICO outside asar — Windows often fails to use icons loaded only from app.asar */
function getWindowIconPath() {
  const rel = path.join('public', 'icon.ico')
  if (app.isPackaged) {
    const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', rel)
    if (fs.existsSync(unpacked)) return unpacked
  }
  return path.join(__dirname, '..', rel)
}

function openConnectServerHelperWindow() {
  return new Promise((resolve) => {
    const icon = getWindowIconPath()
    connectWindow = new BrowserWindow({
      width: 520,
      height: 440,
      autoHideMenuBar: true,
      resizable: true,
      icon: fs.existsSync(icon) ? icon : undefined,
      webPreferences: {
        preload: path.join(__dirname, 'connect-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    connectWindow.loadFile(path.join(__dirname, 'connect-server.html'))
    connectWindow.on('closed', () => {
      connectWindow = null
      resolve()
    })
  })
}

/** Ctrl/Cmd + / - / 0 zoom (no menu bar in production). */
function attachZoomShortcuts(webContents) {
  webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (!(input.control || input.meta)) return
    const z = webContents.getZoomFactor()
    if (input.code === 'Equal' || input.code === 'NumpadAdd') {
      webContents.setZoomFactor(Math.min(2.5, Math.round((z + 0.1) * 100) / 100))
      event.preventDefault()
    } else if (input.code === 'Minus' || input.code === 'NumpadSubtract') {
      webContents.setZoomFactor(Math.max(0.5, Math.round((z - 0.1) * 100) / 100))
      event.preventDefault()
    } else if (input.code === 'Digit0') {
      webContents.setZoomFactor(1)
      event.preventDefault()
    }
  })
}

async function loadServer() {
  try {
    const bridgeHref = pathToFileURL(path.join(__dirname, '..', 'server', 'services', 'electronPdfBridge.js')).href
    const { registerElectronPdfImpl } = await import(bridgeHref)
    const { printTranscriptHtmlToPdfBuffer } = require(path.join(__dirname, 'services', 'pdfPrinter.cjs'))
    registerElectronPdfImpl(printTranscriptHtmlToPdfBuffer)
  } catch (e) {
    console.warn('[dropsoft] CBC transcript PDF (Electron) bridge not registered:', e.message)
  }
  const { startServer } = await import(pathToFileURL(path.join(__dirname, '..', 'server', 'app.js')).href)
  const { port } = await startServer()
  apiPort = port
  return port
}

const { printTranscriptHtmlToPdfBuffer } = require(path.join(__dirname, 'services', 'pdfPrinter.cjs'))
ipcMain.handle('print-transcript-to-pdf', async (_event, html) => {
  return printTranscriptHtmlToPdfBuffer(html)
})

ipcMain.handle('get-api-port', () => {
  const remote = getRemoteApiBase()
  if (remote) {
    try {
      const u = new URL(remote)
      if (u.port) return parseInt(u.port, 10)
      return u.protocol === 'https:' ? 443 : 80
    } catch {
      return null
    }
  }
  return apiPort
})
ipcMain.handle('get-api-base-url', () => getRemoteApiBase() || (apiPort ? `http://127.0.0.1:${apiPort}` : ''))

ipcMain.handle('setup-role-get-datadir', () => getDataDir())

ipcMain.handle('setup-role-finish', async (_e, payload) => {
  try {
    const r = await applyRoleSetup(payload)
    if (r.error) return r
    setupWizardFinishedOk = true
    try {
      if (setupRoleWizardWindow && !setupRoleWizardWindow.isDestroyed()) {
        setupRoleWizardWindow.close()
      }
    } catch (_) {}
    setImmediate(() => {
      app.relaunch()
      app.exit(0)
    })
    return { ok: true }
  } catch (e) {
    return { error: e && e.message ? e.message : String(e) }
  }
})

ipcMain.handle('save-remote-api-json', async (_event, urlString) => {
  const origin = normalizeApiOrigin(urlString)
  if (!origin) {
    return { ok: false, error: 'Invalid URL. Example: http://192.168.1.10:32100' }
  }
  const healthy = await checkRemoteHealth(origin)
  if (!healthy) {
    return {
      ok: false,
      error:
        `Cannot reach ${origin}.\n\nCheck the server IP and port, that DROPSOFT SCH erp is running on the server PC, and Windows Firewall allows that port.`
    }
  }
  try {
    fs.mkdirSync(getDataDir(), { recursive: true })
    fs.writeFileSync(
      path.join(getDataDir(), 'remote-api.json'),
      JSON.stringify({ baseUrl: origin }, null, 2),
      'utf8'
    )
    return { ok: true, baseUrl: origin }
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) }
  }
})

ipcMain.handle('test-remote-api', async (_event, urlString) => {
  const origin = normalizeApiOrigin(urlString)
  if (!origin) {
    return { ok: false, error: 'Invalid URL. Example: http://192.168.1.10:32100' }
  }
  const healthy = await checkRemoteHealth(origin)
  if (!healthy) {
    return {
      ok: false,
      error:
        `Cannot reach ${origin}.\n\nCheck the server IP and port, that DROPSOFT SCH erp is running on the server PC, and Windows Firewall allows that port.`
    }
  }
  return { ok: true, baseUrl: origin }
})

ipcMain.handle('get-remote-api-config-path', () => path.join(getDataDir(), 'remote-api.json'))

function setServeDistEnv() {
  const candidates = []
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'dist'))
  }
  candidates.push(path.join(__dirname, '..', 'dist'))
  try {
    if (app.isPackaged && typeof app.getAppPath === 'function') {
      candidates.push(path.join(app.getAppPath(), 'dist'))
    }
  } catch (_) {
    /* ignore */
  }
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'app.asar', 'dist'))
    candidates.push(path.join(process.resourcesPath, 'app', 'dist'))
  }
  try {
    candidates.push(path.join(process.cwd(), 'dist'))
  } catch (_) {
    /* ignore */
  }
  for (const distDir of candidates) {
    const indexHtml = path.join(distDir, 'index.html')
    if (fs.existsSync(indexHtml)) {
      process.env.HR_SERVE_DIST = path.resolve(distDir)
      return
    }
  }
  console.warn('[DROPSOFT SCH erp] dist/index.html not found — UI may not load over http (candidates tried:', candidates.join('; '), ')')
}

/** Launch DROPSOFT SCH erp when the user signs in to Windows (packaged app only). */
function applyLoginStartupSettings() {
  if (!app.isPackaged) return
  if (process.env.ELECTRON_DISABLE_STARTUP === '1') return
  try {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
      args: []
    })
  } catch (e) {
    console.error('[Electron] setLoginItemSettings failed:', e)
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
  process.exit(0)
} else {
  app.on('second-instance', () => {
    if (connectWindow) {
      if (connectWindow.isMinimized()) connectWindow.restore()
      connectWindow.show()
      connectWindow.focus()
      return
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app
    .whenReady()
    .then(async () => {
      if (process.platform === 'win32') {
        app.setAppUserModelId('com.dropsoft.hr')
      }

      if (process.argv.includes('--set-server')) {
        await openConnectServerHelperWindow()
        app.quit()
        return
      }

      applyLoginStartupSettings()

      if (await tryConsumeInstallPending()) {
        return
      }

      if (needsRoleSetup()) {
        await openRoleSetupWindow()
        if (setupWizardFinishedOk) {
          return
        }
        if (needsRoleSetup()) {
          app.quit()
          return
        }
      }

      const remoteApiBase = getRemoteApiBase()
      if (remoteApiBase) {
        const healthy = await checkRemoteHealth(remoteApiBase)
        if (!healthy) {
          const cfg = path.join(getDataDir(), 'remote-api.json')
          try {
            dialog.showMessageBoxSync({
              type: 'warning',
              title: 'DROPSOFT SCH erp — server not reachable',
              message: `Cannot reach DROPSOFT SCH erp server at ${remoteApiBase}.`,
              detail:
                'Check that the server PC is running DROPSOFT SCH erp, and Windows Firewall allows the API port.\n\n' +
                'The connection setup window will now open so you can confirm or change the server URL.\n\n' +
                `Config file: ${cfg}`,
              buttons: ['OK']
            })
          } catch (_) {}
          await openConnectServerHelperWindow()
          app.quit()
          return
        }
      } else {
        applyPendingRestoreIfAny()
        setServeDistEnv()
        ensureLocalServerBinding()
        await ensureDatabaseExists()

        // Always start the API in this process. Reusing api-port.txt + skipping loadServer() connected the
        // window to a *stale* background Node process (old build without UI static routes) → "Cannot GET /".
        await loadServer()
        ensureWindowsFirewallRule(apiPort)

        const healthy = await waitForHealth(apiPort, 60)
        if (!healthy) {
          throw new Error(
            'The HR API did not respond on http://127.0.0.1 — try again, or reinstall. ' +
              'If another DROPSOFT SCH erp window is open, close it first.'
          )
        }
      }

      const windowIcon = getWindowIconPath()
      mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        backgroundColor: '#f8fafc',
        icon: fs.existsSync(windowIcon) ? windowIcon : undefined,
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false
        }
      })
      attachZoomShortcuts(mainWindow.webContents)

      mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame) return
        const msg = `[${errorCode}] ${errorDescription}\n${validatedURL || ''}`
        console.error('[DROPSOFT SCH erp] Window failed to load:', msg)
        try {
          dialog.showErrorBox(
            'DROPSOFT SCH erp — page did not load',
            `${msg}\n\nIf this persists, reinstall the app or run from the project folder with npm run electron after npm run build.`
          )
        } catch (_) {
          /* ignore */
        }
      })
      mainWindow.webContents.on('console-message', (_e, level, message) => {
        if (level >= 2) console.error('[Renderer]', message)
      })

      const dev = process.env.ELECTRON_DEV === '1'
      if (!dev) {
        Menu.setApplicationMenu(null)
      }
      if (dev) {
        await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:3000')
      } else if (getRemoteApiBase()) {
        const base = getRemoteApiBase()
        try {
          await mainWindow.loadURL(base.endsWith('/') ? base : `${base}/`)
        } catch (e) {
          const detail = e && e.message ? String(e.message) : String(e)
          try {
            dialog.showMessageBoxSync({
              type: 'warning',
              title: 'DROPSOFT SCH erp — client connection',
              message: `Could not open server page at ${base}.`,
              detail:
                `${detail}\n\nThe client setup wizard will open so you can set the correct server URL.`,
              buttons: ['OK']
            })
          } catch (_) {}
          if (mainWindow && !mainWindow.isDestroyed()) {
            try {
              mainWindow.close()
            } catch (_) {}
          }
          await openConnectServerHelperWindow()
          app.quit()
          return
        }
      } else if (apiPort) {
        // Always use same-origin http:// so /assets/*.js resolve. loadFile(file://) breaks absolute /assets paths → blank window.
        await mainWindow.loadURL(`http://127.0.0.1:${apiPort}/`)
      } else {
        await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
      }
    })
    .catch((err) => {
      const msg = err && (err.stack || err.message) ? String(err.stack || err.message) : String(err)
      console.error('[DROPSOFT SCH erp] Startup failed:', msg)
      try {
        dialog.showErrorBox('DROPSOFT SCH erp — could not start', msg)
      } catch (_) {
        /* ignore */
      }
      app.quit()
    })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
