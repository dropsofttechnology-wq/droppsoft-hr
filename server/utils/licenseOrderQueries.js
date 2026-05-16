import { randomUUID } from 'node:crypto'
import { buildLicenseQuote } from './licensePackages.js'

/**
 * @param {import('better-sqlite3').Database} db
 */
export function ensureLicenseOrdersSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS license_orders (
      id TEXT PRIMARY KEY,
      reference_code TEXT NOT NULL UNIQUE,
      company_name TEXT NOT NULL,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      package_id TEXT NOT NULL,
      billing_cycle TEXT NOT NULL,
      employee_count INTEGER NOT NULL,
      selected_features_json TEXT NOT NULL DEFAULT '[]',
      include_onboarding INTEGER NOT NULL DEFAULT 0,
      quote_json TEXT NOT NULL,
      total_due_kes INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_payment',
      deployment_id TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
}

function makeReferenceCode() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `DHR-${stamp}-${suffix}`
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {Record<string, unknown>} body
 * @param {string} [userId]
 */
export function createLicenseOrder(db, body, userId) {
  const companyName = String(body.companyName || body.company_name || '').trim()
  if (!companyName) throw new Error('Company name is required')

  const quote = buildLicenseQuote({
    packageId: body.packageId || body.package_id,
    billingCycle: body.billingCycle || body.billing_cycle,
    employeeCount: body.employeeCount ?? body.employee_count,
    selectedFeatures: body.selectedFeatures || body.selected_features,
    includeOnboarding: body.includeOnboarding ?? body.include_onboarding,
    discountPercent: body.discountPercent ?? body.discount_percent
  })

  const now = new Date().toISOString()
  const id = randomUUID()
  const referenceCode = makeReferenceCode()
  const selectedFeatures = Array.isArray(body.selectedFeatures)
    ? body.selectedFeatures
    : Array.isArray(body.selected_features)
      ? body.selected_features
      : []

  db.prepare(
    `INSERT INTO license_orders (
      id, reference_code, company_name, contact_name, contact_email, contact_phone,
      package_id, billing_cycle, employee_count, selected_features_json, include_onboarding,
      quote_json, total_due_kes, status, deployment_id, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?, ?, ?)`
  ).run(
    id,
    referenceCode,
    companyName,
    String(body.contactName || body.contact_name || '').trim() || null,
    String(body.contactEmail || body.contact_email || '').trim() || null,
    String(body.contactPhone || body.contact_phone || '').trim() || null,
    quote.packageId,
    quote.billingCycle,
    quote.employeeCount,
    JSON.stringify(quote.addOnFeatures.length ? selectedFeatures : quote.addOnFeatures),
    body.includeOnboarding || body.include_onboarding ? 1 : 0,
    JSON.stringify(quote),
    quote.totalDueKes,
    body.deploymentId || body.deployment_id || null,
    userId || null,
    now,
    now
  )

  return getLicenseOrderById(db, id)
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} id
 */
export function getLicenseOrderById(db, id) {
  const row = db.prepare('SELECT * FROM license_orders WHERE id = ?').get(id)
  if (!row) return null
  return mapLicenseOrderRow(row)
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function listLicenseOrders(db) {
  const rows = db
    .prepare('SELECT * FROM license_orders ORDER BY datetime(created_at) DESC LIMIT 200')
    .all()
  return rows.map(mapLicenseOrderRow)
}

function mapLicenseOrderRow(row) {
  let quote = null
  let selectedFeatures = []
  try {
    quote = JSON.parse(row.quote_json)
  } catch (_) {}
  try {
    selectedFeatures = JSON.parse(row.selected_features_json || '[]')
  } catch (_) {}
  return {
    id: row.id,
    referenceCode: row.reference_code,
    companyName: row.company_name,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    packageId: row.package_id,
    billingCycle: row.billing_cycle,
    employeeCount: row.employee_count,
    selectedFeatures,
    includeOnboarding: row.include_onboarding === 1,
    quote,
    totalDueKes: row.total_due_kes,
    status: row.status,
    deploymentId: row.deployment_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}
