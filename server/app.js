import './loadEnv.js'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import getPort, { portNumbers } from 'get-port'
import { openDatabaseWithRetry } from './db.js'
import { getDataDir, getDbPath, getApiPortFilePath, getUploadsRoot } from './paths.js'
import { tickAutoBackup } from './utils/autoBackup.js'
import { createSubscriptionGuard } from './middleware/subscription-guard.js'
import { requireRoles } from './middleware/role-guard.js'
import { requirePermission } from './middleware/permission-guard.js'
import { createHealthRouter } from './routes/health.js'
import { createAuthRoutes } from './routes/auth.js'
import { createCompanyRoutes } from './routes/companies.js'
import { createEmployeeRoutes } from './routes/employees.js'
import { createPayrollRoutes } from './routes/payroll.js'
import { createPayslipsRoutes } from './routes/payslips.js'
import { createAttendanceRoutes } from './routes/attendance.js'
import { createLeaveRoutes } from './routes/leave.js'
import { createStatutoryRoutes } from './routes/statutory.js'
import { createSettingsRoutes } from './routes/settings.js'
import { createEmployeeDeductionsRoutes } from './routes/employeeDeductions.js'
import { createHolidaysRoutes } from './routes/holidays.js'
import { createPeriodClosureRoutes } from './routes/periodClosures.js'
import { createBankRoutes } from './routes/banks.js'
import { createAuditRoutes } from './routes/audit.js'
import { createFaceRoutes } from './routes/face.js'
import { createStorageRoutes } from './routes/storage.js'
import { createLeaveTypeRoutes } from './routes/leaveTypes.js'
import { createUsersRoutes } from './routes/users.js'
import { createRolePermissionsRoutes } from './routes/rolePermissions.js'
import { createSalaryAdvanceRoutes } from './routes/salaryAdvance.js'
import { createSubscriptionRoutes } from './routes/subscription.js'
import { createShoppingRoutes } from './routes/shopping.js'
import { createSchoolOperationalExpensesRoutes } from './routes/schoolOperationalExpenses.js'
import { createBackupRoutes } from './routes/backup.js'
import { ensureAuthUserSchema, ensureDefaultSuperUser } from './utils/ensureDefaultSuperUser.js'
import { ensurePayrollRunsSchema } from './utils/ensurePayrollRunsSchema.js'
import { ensureSubscriptionSchema } from './utils/subscriptionQueries.js'

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url))

/**
 * Prefer HR_SERVE_DIST; otherwise search common locations (dev, packaged Electron app.asar, etc.).
 * @returns {string | null}
 */
export function resolveHrStaticDist() {
  const tried = []
  const tryDir = (dir) => {
    if (!dir || typeof dir !== 'string') return null
    const resolved = path.resolve(dir.trim())
    if (tried.includes(resolved)) return null
    tried.push(resolved)
    const indexHtml = path.join(resolved, 'index.html')
    if (fs.existsSync(indexHtml)) return resolved
    return null
  }

  const env = process.env.HR_SERVE_DIST
  if (env != null && String(env).trim() !== '') {
    const ok = tryDir(String(env))
    if (ok) return ok
  }

  // Unpacked dist (electron-builder asarUnpack) â€” real paths; avoids Express sendFile issues with asar archives on Windows.
  const candidates = [
    process.resourcesPath && path.join(process.resourcesPath, 'app.asar.unpacked', 'dist'),
    path.join(SERVER_DIR, '..', 'dist'),
    path.join(process.cwd(), 'dist'),
    process.resourcesPath && path.join(process.resourcesPath, 'app.asar', 'dist'),
    process.resourcesPath && path.join(process.resourcesPath, 'app', 'dist')
  ].filter(Boolean)

  for (const c of candidates) {
    const ok = tryDir(c)
    if (ok) return ok
  }
  return null
}

/**
 * Builds Express app with HR routes (dependency injection: db passed into route factories).
 * @param {import('better-sqlite3').Database} db
 * @param {{ staticDistPath?: string }} [options] â€” when set (e.g. Electron), serve Vite `dist/` so the UI loads over http:// instead of file:// (fixes blank window + asset paths).
 */
export function createApp(db, options = {}) {
  const app = express()
  app.use(cors({ origin: true }))
  app.use(express.json({ limit: '10mb' }))

  app.use('/api', createHealthRouter(db))
  app.use('/api/auth', createAuthRoutes(db))
  app.use('/api/subscription', createSubscriptionRoutes(db))
  app.use('/api/backup', createBackupRoutes(db))

  const subscriptionGuard = createSubscriptionGuard(db)
  app.use((req, res, next) => {
    if (req.path === '/api/health' || req.path.startsWith('/api/auth')) return next()
    return subscriptionGuard(req, res, next)
  })

  const staffAndEmployee = requireRoles(db, [
    'admin',
    'super_admin',
    'manager',
    'cashier',
    'approver',
    'employee'
  ])

  app.use('/api/companies', requirePermission(db, 'manage_companies'), createCompanyRoutes(db))
  app.use('/api/employees', createEmployeeRoutes(db))
  app.use('/api/payroll', requirePermission(db, 'payroll_access'), createPayrollRoutes(db))
  app.use('/api/payslips', requirePermission(db, 'payslips_access'), createPayslipsRoutes(db))
  app.use('/api/attendance', requirePermission(db, 'attendance_management'), createAttendanceRoutes(db))
  app.use('/api/leave', staffAndEmployee, createLeaveRoutes(db))
  app.use('/api/statutory', requirePermission(db, 'statutory_compliance'), createStatutoryRoutes(db))
  app.use('/api/settings', requirePermission(db, 'app_settings'), createSettingsRoutes(db))
  app.use('/api/employee-deductions', requirePermission(db, 'employee_deductions'), createEmployeeDeductionsRoutes(db))
  app.use('/api/holidays', requirePermission(db, 'holidays_config'), createHolidaysRoutes(db))
  app.use('/api/period-closures', requirePermission(db, 'period_closure'), createPeriodClosureRoutes(db))
  app.use('/api/banks', requirePermission(db, 'banks_master'), createBankRoutes(db))
  app.use('/api/audit', createAuditRoutes(db))
  app.use('/api/face', requirePermission(db, 'face_terminal'), createFaceRoutes(db))
  app.use('/api/storage', createStorageRoutes(db))
  app.use('/api/leave-types', requirePermission(db, 'leave_types_config'), createLeaveTypeRoutes(db))
  app.use('/api/salary-advance', staffAndEmployee, createSalaryAdvanceRoutes(db))
  app.use('/api/shopping', staffAndEmployee, createShoppingRoutes(db))
  app.use('/api/school', createSchoolOperationalExpensesRoutes(db))
  app.use('/api/users', requirePermission(db, 'manage_users'), createUsersRoutes(db))
  const superAdminOnly = requireRoles(db, ['super_admin'])
  app.use('/api/role-permissions', superAdminOnly, createRolePermissionsRoutes(db))

  const staticDistPath = options.staticDistPath || resolveHrStaticDist()
  const distPath = staticDistPath && fs.existsSync(staticDistPath) ? path.resolve(staticDistPath) : null

  if (distPath) {
    const indexPath = path.join(distPath, 'index.html')
    const sendSpaIndex = (res, next) => {
      try {
        const html = fs.readFileSync(indexPath, 'utf8')
        // Avoid stale index.html after upgrades (old HTML â†’ missing hashed chunks â†’ blank UI).
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate')
        res.type('html').send(html)
      } catch (err) {
        next(err)
      }
    }
    // Root path: readFile works reliably for unpacked + asar paths; sendFile often fails for paths inside .asar on Windows.
    app.get('/', (_req, res, next) => sendSpaIndex(res, next))
    app.use(express.static(distPath, { index: false, fallthrough: true }))
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next()
      if (req.path.startsWith('/api')) return next()
      // If a built asset is missing, do NOT send index.html â€” the browser would execute HTML as JS â†’ blank window.
      if (
        req.path.startsWith('/assets/') ||
        /\.(js|mjs|css|map|json|ico|png|jpe?g|gif|svg|webp|woff2?|ttf|eot)$/i.test(req.path)
      ) {
        res.status(404).type('text/plain').send('Not found')
        return
      }
      sendSpaIndex(res, next)
    })
  } else {
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next()
      if (req.path.startsWith('/api')) return next()
      res
        .status(503)
        .type('html')
        .send(
          `<!DOCTYPE html><html><head><meta charset="utf-8"><title>HR UI missing</title></head><body style="font-family:system-ui;padding:2rem;max-width:40rem">
<h1>Web UI not installed</h1>
<p>The server is running, but <strong>dist/index.html</strong> was not found. The desktop app needs a built UI bundle.</p>
<ul>
<li><strong>Developers:</strong> run <code>npm run build</code> in the project folder, then restart.</li>
<li><strong>Users:</strong> reinstall from the latest <strong>Dropsoft HR</strong> installer, or run the portable <code>.exe</code> from the official <code>release</code> folder.</li>
</ul>
<p>API check: <a href="/api/health">/api/health</a></p>
</body></html>`
        )
    })
  }

  return app
}

/**
 * Starts HTTP server on 127.0.0.1 with a free port in range; writes api-port.txt next to hr.db.
 * @returns {Promise<{ port: number, server: import('http').Server, app: import('express').Express, db: import('better-sqlite3').Database }>}
 */
export async function startServer() {
  const dataDir = getDataDir()
  fs.mkdirSync(dataDir, { recursive: true })

  const dbPath = getDbPath()
  const db = openDatabaseWithRetry(dbPath)
  ensureSubscriptionSchema(db)
  ensurePayrollRunsSchema(db)
  ensureAuthUserSchema(db)
  ensureDefaultSuperUser(db)
  const staticDistPath = resolveHrStaticDist()
  const app = createApp(db, staticDistPath ? { staticDistPath } : {})

  /** 127.0.0.1 = localhost only; 0.0.0.0 = accept connections from other PCs on the LAN (use firewall rules). */
  const bindHost = (process.env.HR_API_BIND || '127.0.0.1').trim() || '127.0.0.1'

  const rawPort = process.env.HR_API_PORT
  let port
  if (rawPort != null && String(rawPort).trim() !== '') {
    const p = parseInt(String(rawPort), 10)
    if (!Number.isNaN(p) && p > 0 && p < 65536) {
      port = p
    }
  }
  if (port === undefined) {
    port = await getPort({ port: portNumbers(32100, 32900), host: bindHost })
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(port, bindHost, () => {
      try {
        fs.writeFileSync(getApiPortFilePath(), String(port), 'utf8')
      } catch (e) {
        reject(e)
        return
      }
      const dataDirSched = getDataDir()
      setInterval(() => {
        tickAutoBackup({
          db,
          dbPath: getDbPath(),
          uploadsRoot: getUploadsRoot(),
          dataDir: dataDirSched
        }).catch((err) => console.error('[auto-backup]', err))
      }, 60 * 1000)
      resolve({ port, server, app, db })
    })
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(
          `[HR API] Port ${port} is already in use. Change HR_API_PORT in .env.local or stop the other process.`
        )
      }
      reject(err)
    })
  })
}

