/**
 * SMTP configuration for transactional email (payslips, CBC transcripts, etc.).
 * Values resolve from HR_SMTP_* env vars or company settings (see sendPayslipEmails).
 */

import { resolveSmtpConfig } from '../services/sendPayslipEmails.js'

const SMTP_SETTING_KEYS = Object.freeze([
  'smtp_host',
  'smtp_port',
  'smtp_secure',
  'smtp_user',
  'smtp_pass',
  'smtp_from',
  'smtp_from_name'
])

function getSetting(db, companyId, key) {
  const row = db
    .prepare('SELECT setting_value FROM settings WHERE company_id = ? AND setting_key = ? LIMIT 1')
    .get(companyId, key)
  return row?.setting_value != null ? String(row.setting_value) : ''
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} companyId
 */
export function getSmtpConfig(db, companyId) {
  return resolveSmtpConfig(db, companyId)
}

/**
 * Display name for outgoing mail (defaults to company name).
 * @param {import('better-sqlite3').Database} db
 * @param {string} companyId
 */
export function getEmailFromDisplay(db, companyId) {
  const smtp = getSmtpConfig(db, companyId)
  const fromName =
    (process.env.HR_SMTP_FROM_NAME || '').trim() ||
    getSetting(db, companyId, 'smtp_from_name') ||
    db.prepare('SELECT name FROM companies WHERE id = ?').get(companyId)?.name ||
    'School'
  const fromAddress = smtp.from || ''
  if (!fromAddress) return { fromName, fromAddress: '', formattedFrom: '' }
  const safeName = fromName.replace(/"/g, "'")
  const formattedFrom = safeName ? `"${safeName}" <${fromAddress}>` : fromAddress
  return { fromName: safeName, fromAddress, formattedFrom }
}

export { SMTP_SETTING_KEYS }
