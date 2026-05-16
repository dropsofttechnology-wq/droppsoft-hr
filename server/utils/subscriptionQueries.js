import { randomUUID } from 'node:crypto'
import { addMonths, addYears, isAfter, parseISO } from 'date-fns'
import { ensureRolePermissionsSchema } from './rolePermissions.js'
import { ensureLicenseOrdersSchema } from './licenseOrderQueries.js'
import { ensureSchoolOperationalExpensesSchema } from './ensureSchoolOperationalExpensesSchema.js'
import { ensureSchoolFeeLedgerSchema } from './ensureSchoolFeeLedgerSchema.js'
import { ensureStudentDailyAttendanceSchema } from './ensureStudentDailyAttendanceSchema.js'
import { ensureSchoolCbcGradingSchema } from './ensureSchoolCbcGradingSchema.js'

const LAN_DEPLOYMENT_KEY = 'lan_deployment_id'

/**
 * @param {Date | string} startDate
 * @param {'monthly' | 'quarterly' | 'yearly'} plan
 */
export function computePeriodEnd(startDate, plan) {
  const s = typeof startDate === 'string' ? parseISO(startDate) : startDate
  if (plan === 'monthly') return addMonths(s, 1)
  if (plan === 'quarterly') return addMonths(s, 3)
  if (plan === 'yearly') return addYears(s, 1)
  return addMonths(s, 1)
}

/**
 * Inverse window for absolute end-date licenses (issuer sets valid_until).
 * @param {Date | string} endDate
 * @param {'monthly' | 'quarterly' | 'yearly'} plan
 */
export function computePeriodStartBeforeEnd(endDate, plan) {
  const e = typeof endDate === 'string' ? parseISO(endDate) : endDate
  if (plan === 'monthly') return addMonths(e, -1)
  if (plan === 'quarterly') return addMonths(e, -3)
  if (plan === 'yearly') return addYears(e, -1)
  return addMonths(e, -1)
}

/**
 * Stable LAN server deployment id (bind licenses to this installation).
 * @param {import('better-sqlite3').Database} db
 */
export function ensureDeploymentId(db) {
  ensureAppSettingsSchema(db)
  let id = getAppSetting(db, LAN_DEPLOYMENT_KEY)
  if (!id) {
    id = randomUUID()
    setAppSetting(db, LAN_DEPLOYMENT_KEY, id)
  }
  return id
}

/** Add columns when DB was created before new fields existed. */
/** % of salary paid during leave; remainder is deducted from gross at (Gross/30) per calendar day in payroll period. */
function ensureLeaveTypesPayPercentage(db) {
  try {
    const cols = db.prepare(`PRAGMA table_info(leave_types)`).all()
    if (!cols.length) return
    const names = cols.map((c) => c.name)
    if (!names.includes('pay_percentage')) {
      db.exec(`ALTER TABLE leave_types ADD COLUMN pay_percentage REAL DEFAULT 100`)
      db.prepare(`UPDATE leave_types SET pay_percentage = 0 WHERE UPPER(COALESCE(leave_code, '')) = 'UNPAID'`).run()
    }
  } catch {
    // table missing
  }
}

function ensureSalaryAdvanceColumns(db) {
  try {
    const cols = db.prepare(`PRAGMA table_info(salary_advance_requests)`).all()
    const names = cols.map((c) => c.name)
    if (names.length && !names.includes('for_period')) {
      db.exec(`ALTER TABLE salary_advance_requests ADD COLUMN for_period TEXT`)
    }
    if (names.length && !names.includes('application_date')) {
      db.exec(`ALTER TABLE salary_advance_requests ADD COLUMN application_date TEXT`)
    }
    if (names.length && !names.includes('installment_count')) {
      db.exec(`ALTER TABLE salary_advance_requests ADD COLUMN installment_count INTEGER`)
    }
    if (names.length && !names.includes('requested_by')) {
      db.exec(`ALTER TABLE salary_advance_requests ADD COLUMN requested_by TEXT`)
    }
    if (names.length && !names.includes('installment_plan')) {
      db.exec(`ALTER TABLE salary_advance_requests ADD COLUMN installment_plan TEXT`)
    }
    if (names.length && !names.includes('admin_form_notes')) {
      db.exec(`ALTER TABLE salary_advance_requests ADD COLUMN admin_form_notes TEXT`)
    }
  } catch {
    // table missing â€” will be created below
  }
}

function ensureShoppingColumns(db) {
  try {
    const cols = db.prepare(`PRAGMA table_info(shopping_requests)`).all()
    const names = cols.map((c) => c.name)
    if (names.length && !names.includes('requested_by')) {
      db.exec(`ALTER TABLE shopping_requests ADD COLUMN requested_by TEXT`)
    }
    if (names.length && !names.includes('for_period')) {
      db.exec(`ALTER TABLE shopping_requests ADD COLUMN for_period TEXT`)
    }
    if (names.length && !names.includes('application_date')) {
      db.exec(`ALTER TABLE shopping_requests ADD COLUMN application_date TEXT`)
    }
    if (names.length && !names.includes('installment_count')) {
      db.exec(`ALTER TABLE shopping_requests ADD COLUMN installment_count INTEGER`)
    }
    if (names.length && !names.includes('installment_plan')) {
      db.exec(`ALTER TABLE shopping_requests ADD COLUMN installment_plan TEXT`)
    }
    if (names.length && !names.includes('item_lines_json')) {
      db.exec(`ALTER TABLE shopping_requests ADD COLUMN item_lines_json TEXT`)
    }
    if (names.length && !names.includes('admin_form_notes')) {
      db.exec(`ALTER TABLE shopping_requests ADD COLUMN admin_form_notes TEXT`)
    }
  } catch {
    // table missing - will be created below
  }
}

function ensureLeaveRequestsBalanceDeduction(db) {
  try {
    const cols = db.prepare(`PRAGMA table_info(leave_requests)`).all()
    const names = cols.map((c) => c.name)
    if (names.length && !names.includes('balance_deduction')) {
      db.exec(`ALTER TABLE leave_requests ADD COLUMN balance_deduction TEXT`)
    }
    if (names.length && !names.includes('created_by')) {
      db.exec(`ALTER TABLE leave_requests ADD COLUMN created_by TEXT`)
    }
    if (names.length && !names.includes('admin_form_notes')) {
      db.exec(`ALTER TABLE leave_requests ADD COLUMN admin_form_notes TEXT`)
    }
  } catch {
    // table missing
  }
}

/** Per-employee override for annual leave pool (days per year). Super admin only via API. */
function ensureEmployeesAnnualLeaveEntitlement(db) {
  try {
    const cols = db.prepare(`PRAGMA table_info(employees)`).all()
    const names = cols.map((c) => c.name)
    if (names.length && !names.includes('annual_leave_entitlement_days')) {
      db.exec(`ALTER TABLE employees ADD COLUMN annual_leave_entitlement_days REAL`)
    }
  } catch {
    // table missing
  }
}

/**
 * Ensure table + default trial row (1 month from first run).
 * @param {import('better-sqlite3').Database} db
 */
export function ensureSubscriptionSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_subscription (
      id TEXT PRIMARY KEY,
      plan TEXT NOT NULL DEFAULT 'monthly',
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS salary_advance_requests (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT,
      repayment_period TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_at TEXT,
      requested_by TEXT,
      approved_by TEXT,
      approved_at TEXT,
      created_at TEXT,
      updated_at TEXT,
      for_period TEXT,
      application_date TEXT,
      installment_count INTEGER,
      installment_plan TEXT,
      admin_form_notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sar_company ON salary_advance_requests(company_id);
    CREATE INDEX IF NOT EXISTS idx_sar_employee ON salary_advance_requests(employee_id);
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS shopping_requests (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT,
      repayment_period TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_at TEXT,
      requested_by TEXT,
      approved_by TEXT,
      approved_at TEXT,
      created_at TEXT,
      updated_at TEXT,
      for_period TEXT,
      application_date TEXT,
      installment_count INTEGER,
      installment_plan TEXT,
      item_lines_json TEXT,
      admin_form_notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_shr_company ON shopping_requests(company_id);
    CREATE INDEX IF NOT EXISTS idx_shr_employee ON shopping_requests(employee_id);
  `)
  ensureSalaryAdvanceColumns(db)
  ensureShoppingColumns(db)
  ensureLeaveRequestsBalanceDeduction(db)
  ensureLeaveTypesPayPercentage(db)
  ensureEmployeesAnnualLeaveEntitlement(db)
  ensureRolePermissionsSchema(db)
  ensureLicenseOrdersSchema(db)
  ensureSchoolOperationalExpensesSchema(db)
  ensureSchoolFeeLedgerSchema(db)
  ensureStudentDailyAttendanceSchema(db)
  ensureSchoolCbcGradingSchema(db)
  ensureAppSettingsSchema(db)
  ensureLicenseActivationLogSchema(db)

  const row = db.prepare(`SELECT id FROM app_subscription WHERE id = 'default'`).get()
  if (!row) {
    const now = new Date()
    const start = now.toISOString()
    const end = computePeriodEnd(now, 'monthly').toISOString()
    const stamp = now.toISOString()
    db.prepare(
      `INSERT INTO app_subscription (id, plan, period_start, period_end, updated_at)
       VALUES ('default', 'monthly', ?, ?, ?)`
    ).run(start, end, stamp)
  }

  ensureDeploymentId(db)
}

function ensureLicenseActivationLogSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS license_activation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_id TEXT NOT NULL,
      deployment_id TEXT NOT NULL,
      plan TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      activated_at TEXT NOT NULL,
      activated_by TEXT
    )
  `)
}

function ensureAppSettingsSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT
    )
  `)
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} key
 * @param {string} [defaultValue]
 */
export function getAppSetting(db, key, defaultValue = null) {
  try {
    const row = db.prepare(`SELECT value FROM app_settings WHERE key = ?`).get(key)
    return row && row.value != null && row.value !== '' ? row.value : defaultValue
  } catch {
    return defaultValue
  }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} key
 * @param {string} value
 */
export function setAppSetting(db, key, value) {
  const now = new Date().toISOString()
  const v = String(value ?? '')
  const existing = db.prepare(`SELECT key FROM app_settings WHERE key = ?`).get(key)
  if (existing) {
    db.prepare(`UPDATE app_settings SET value = ?, updated_at = ? WHERE key = ?`).run(v, now, key)
  } else {
    db.prepare(`INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)`).run(key, v, now)
  }
}

/**
 * Compute subscription window from a verified signed license payload (LAN server).
 * @param {import('better-sqlite3').Database} db
 * @param {Record<string, unknown>} payload
 * @returns {{ period_start: string, period_end: string, plan: string }}
 */
export function resolveSubscriptionDatesFromLicensePayload(db, payload) {
  const plan = String(payload.plan).toLowerCase().trim()
  if (payload.valid_until) {
    const vu = parseISO(String(payload.valid_until))
    if (Number.isNaN(vu.getTime())) {
      throw new Error('Invalid valid_until')
    }
    const ps = payload.period_start
      ? parseISO(String(payload.period_start))
      : computePeriodStartBeforeEnd(vu, plan)
    if (Number.isNaN(ps.getTime())) {
      throw new Error('Invalid period_start')
    }
    if (vu.getTime() < ps.getTime()) {
      throw new Error('valid_until must be on or after period_start')
    }
    return { period_start: ps.toISOString(), period_end: vu.toISOString(), plan }
  }

  let start = payload.period_start ? parseISO(String(payload.period_start)) : new Date()
  if (Number.isNaN(start.getTime())) {
    throw new Error('Invalid period_start')
  }

  const stack = payload.stack !== false
  if (stack) {
    const row = db.prepare(`SELECT period_end FROM app_subscription WHERE id = 'default'`).get()
    const currentEnd = row?.period_end ? parseISO(row.period_end) : null
    const now = new Date()
    const renewalAnchor = currentEnd && isAfter(currentEnd, now) ? currentEnd : now
    start = isAfter(start, renewalAnchor) ? start : renewalAnchor
  }

  const end = computePeriodEnd(start, plan)
  return { period_start: start.toISOString(), period_end: end.toISOString(), plan }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ period_start: string, period_end: string, plan: string }} dates
 * @param {{ licenseId: string, deploymentId: string }} meta
 * @param {string} [userId]
 */
export function applySubscriptionFromLicense(db, dates, meta, userId) {
  const now = new Date().toISOString()
  const { period_start, period_end, plan } = dates
  const { licenseId, deploymentId } = meta
  db.prepare(
    `INSERT INTO license_activation_log (license_id, deployment_id, plan, period_start, period_end, activated_at, activated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(licenseId, deploymentId, plan, period_start, period_end, now, userId || null)

  const existing = db.prepare(`SELECT id FROM app_subscription WHERE id = 'default'`).get()
  if (existing) {
    db.prepare(
      `UPDATE app_subscription SET plan = ?, period_start = ?, period_end = ?, updated_at = ?, updated_by = ?
       WHERE id = 'default'`
    ).run(plan, period_start, period_end, now, userId || null)
  } else {
    db.prepare(
      `INSERT INTO app_subscription (id, plan, period_start, period_end, updated_at, updated_by)
       VALUES ('default', ?, ?, ?, ?, ?)`
    ).run(plan, period_start, period_end, now, userId || null)
  }
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function getSubscriptionPayload(db) {
  const deploymentId = ensureDeploymentId(db)
  const row = db.prepare(`SELECT * FROM app_subscription WHERE id = 'default'`).get()
  if (!row) {
    const autoRaw0 = getAppSetting(db, 'auto_logout_minutes', '0')
    const autoLogoutMinutes0 = Math.min(
      7 * 24 * 60,
      Math.max(0, Math.floor(parseInt(String(autoRaw0), 10) || 0))
    )
    return {
      configured: false,
      active: true,
      plan: null,
      periodStart: null,
      periodEnd: null,
      daysRemaining: null,
      autoLogoutMinutes: autoLogoutMinutes0,
      deploymentId
    }
  }
  const end = row.period_end ? parseISO(row.period_end) : null
  const active = end ? isAfter(end, new Date()) : true
  const daysRemaining = end
    ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null
  const autoRaw = getAppSetting(db, 'auto_logout_minutes', '0')
  const autoLogoutMinutes = Math.min(
    7 * 24 * 60,
    Math.max(0, Math.floor(parseInt(String(autoRaw), 10) || 0))
  )
  return {
    configured: true,
    active,
    plan: row.plan,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    daysRemaining,
    autoLogoutMinutes,
    deploymentId
  }
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function isSubscriptionCurrentlyActive(db) {
  return getSubscriptionPayload(db).active
}

