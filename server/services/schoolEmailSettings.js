import { resolveSmtpConfig } from './sendPayslipEmails.js'
import { getEmailFromDisplay } from '../config/emailConfig.js'

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} companyId
 */
export function getSchoolEmailSettingsRow(db, companyId) {
  try {
    return db.prepare('SELECT * FROM school_email_settings WHERE company_id = ?').get(companyId) || null
  } catch {
    return null
  }
}

/**
 * SMTP + From header for CBC / school-bulk email.
 * Prefers `school_email_settings`; falls back to payslip / HR_SMTP_* settings.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} companyId
 * @returns {{ smtp: { host: string, port: number, secure: boolean, user: string, pass: string, from: string }, fromName: string, formattedFrom: string }}
 */
export function resolveSchoolTranscriptMailProfile(db, companyId) {
  const row = getSchoolEmailSettingsRow(db, companyId)
  const schoolHost = row && String(row.host || '').trim()
  if (schoolHost) {
    const port = Math.max(1, parseInt(String(row.port ?? 587), 10) || 587)
    const secure = !!(row.secure === 1 || row.secure === true)
    const user = String(row.auth_user || '').trim()
    const pass = String(row.auth_pass || '')
    const senderEmail = String(row.sender_email || '').trim()
    const fromAddr = senderEmail || user
    if (!fromAddr) {
      throw new Error('School email settings: sender email (or auth user) is required.')
    }
    let fromName =
      String(row.sender_name || '').trim() ||
      db.prepare('SELECT name FROM companies WHERE id = ?').get(companyId)?.name ||
      'School'
    fromName = fromName.replace(/"/g, "'")
    const formattedFrom = `"${fromName}" <${fromAddr}>`
    return {
      smtp: { host: schoolHost, port, secure, user, pass, from: fromAddr },
      fromName,
      formattedFrom
    }
  }

  const smtp = resolveSmtpConfig(db, companyId)
  if (!smtp.host) {
    throw new Error(
      'Email is not configured. Add School email settings (CBC) or fill SMTP under Settings → Payslip email, or set HR_SMTP_* environment variables.'
    )
  }
  const { formattedFrom, fromName } = getEmailFromDisplay(db, companyId)
  if (!formattedFrom) {
    throw new Error('SMTP From address is missing.')
  }
  return {
    smtp: {
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      user: smtp.user,
      pass: smtp.pass,
      from: smtp.from
    },
    fromName: fromName || 'School',
    formattedFrom
  }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} companyId
 */
export function mapSchoolEmailSettingsResponse(db, companyId) {
  const row = getSchoolEmailSettingsRow(db, companyId)
  if (!row) {
    return {
      host: '',
      port: 587,
      secure: false,
      auth_user: '',
      auth_pass_set: false,
      sender_name: '',
      sender_email: ''
    }
  }
  return {
    host: row.host || '',
    port: row.port ?? 587,
    secure: !!(row.secure === 1 || row.secure === true),
    auth_user: row.auth_user || '',
    auth_pass_set: !!(row.auth_pass && String(row.auth_pass).length > 0),
    sender_name: row.sender_name || '',
    sender_email: row.sender_email || ''
  }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} companyId
 * @param {{
 *   host?: string
 *   port?: number | string
 *   secure?: boolean
 *   auth_user?: string
 *   auth_pass?: string | null
 *   sender_name?: string
 *   sender_email?: string
 *   clear_password?: boolean
 * }} payload
 */
export function upsertSchoolEmailSettings(db, companyId, payload) {
  const now = new Date().toISOString()
  const existing = getSchoolEmailSettingsRow(db, companyId)
  const host = payload.host != null ? String(payload.host).trim() : existing?.host || ''
  const portRaw = payload.port != null ? payload.port : existing?.port ?? 587
  const port = Math.max(1, parseInt(String(portRaw), 10) || 587)
  const secure =
    payload.secure !== undefined ? !!payload.secure : !!(existing?.secure === 1 || existing?.secure === true)
  const auth_user = payload.auth_user != null ? String(payload.auth_user).trim() : existing?.auth_user || ''
  let auth_pass =
    payload.auth_pass !== undefined && payload.auth_pass !== null
      ? String(payload.auth_pass)
      : existing?.auth_pass || ''
  if (payload.clear_password) {
    auth_pass = ''
  }
  const sender_name = payload.sender_name != null ? String(payload.sender_name).trim() : existing?.sender_name || ''
  const sender_email = payload.sender_email != null ? String(payload.sender_email).trim() : existing?.sender_email || ''

  if (!host) {
    if (existing) {
      db.prepare('DELETE FROM school_email_settings WHERE company_id = ?').run(companyId)
    }
    return mapSchoolEmailSettingsResponse(db, companyId)
  }

  if (existing) {
    db.prepare(
      `UPDATE school_email_settings SET host = ?, port = ?, secure = ?, auth_user = ?, auth_pass = ?,
       sender_name = ?, sender_email = ?, updated_at = ? WHERE company_id = ?`
    ).run(host, port, secure ? 1 : 0, auth_user, auth_pass, sender_name, sender_email, now, companyId)
  } else {
    db.prepare(
      `INSERT INTO school_email_settings (
        company_id, host, port, secure, auth_user, auth_pass, sender_name, sender_email, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(companyId, host, port, secure ? 1 : 0, auth_user, auth_pass, sender_name, sender_email, now)
  }
  return mapSchoolEmailSettingsResponse(db, companyId)
}
