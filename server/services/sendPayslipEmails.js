import nodemailer from 'nodemailer'
import { buildPayslipPdfBuffer } from './payslipPdfBuffer.js'
import { mapEmployeeRow } from '../utils/rowMappers.js'
import { pdfBrandingFromCompanySettings } from '../../shared/pdfBranding.js'

const inferSmtpDefaultsFromEmail = (email) => {
  const e = String(email || '').trim().toLowerCase()
  if (!e || !e.includes('@')) return null
  const domain = e.split('@')[1] || ''
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return { host: 'smtp.gmail.com', port: 587, secure: false }
  }
  if (
    domain === 'outlook.com' ||
    domain === 'hotmail.com' ||
    domain === 'live.com' ||
    domain === 'office365.com' ||
    domain.endsWith('.onmicrosoft.com')
  ) {
    return { host: 'smtp.office365.com', port: 587, secure: false }
  }
  if (domain === 'yahoo.com' || domain === 'ymail.com') {
    return { host: 'smtp.mail.yahoo.com', port: 465, secure: true }
  }
  if (domain === 'zoho.com') {
    return { host: 'smtp.zoho.com', port: 465, secure: true }
  }
  return null
}

function getSetting(db, companyId, key) {
  const row = db
    .prepare('SELECT setting_value FROM settings WHERE company_id = ? AND setting_key = ? LIMIT 1')
    .get(companyId, key)
  return row?.setting_value != null ? String(row.setting_value) : ''
}

/**
 * Resolve SMTP: env overrides settings (for deployment); settings used by desktop app.
 */
export function resolveSmtpConfig(db, companyId) {
  const companyRow = db
    .prepare('SELECT email FROM companies WHERE id = ? LIMIT 1')
    .get(companyId)
  const companyEmail = companyRow?.email != null ? String(companyRow.email).trim() : ''
  const hostRaw = (process.env.HR_SMTP_HOST || '').trim() || getSetting(db, companyId, 'smtp_host')
  const portRaw = (process.env.HR_SMTP_PORT || '').trim() || getSetting(db, companyId, 'smtp_port') || '587'
  let port = Math.max(1, parseInt(portRaw, 10) || 587)
  const secureStr = (process.env.HR_SMTP_SECURE || '').trim() || getSetting(db, companyId, 'smtp_secure')
  let secure =
    secureStr === 'true' ||
    secureStr === '1' ||
    port === 465
  const user = (process.env.HR_SMTP_USER || '').trim() || getSetting(db, companyId, 'smtp_user')
  const pass = (process.env.HR_SMTP_PASS || '').trim() || getSetting(db, companyId, 'smtp_pass')
  const from =
    (process.env.HR_SMTP_FROM || '').trim() ||
    getSetting(db, companyId, 'smtp_from') ||
    user ||
    companyEmail ||
    ''

  let host = hostRaw
  if (!host) {
    const inferred = inferSmtpDefaultsFromEmail(user || from || companyEmail)
    if (inferred) {
      host = inferred.host
      if (!process.env.HR_SMTP_PORT && !getSetting(db, companyId, 'smtp_port')) {
        port = inferred.port
      }
      if (!process.env.HR_SMTP_SECURE && !getSetting(db, companyId, 'smtp_secure')) {
        secure = inferred.secure
      }
    }
  }

  return { host, port, secure, user, pass, from }
}

const emailOk = (e) => {
  const s = String(e || '').trim()
  return s.length > 3 && s.includes('@') && !s.includes(' ')
}

const idNumberPassword = (idNumberRaw) => {
  // Keep alphanumerics to reduce copy/paste confusion from formatting symbols.
  return String(idNumberRaw || '')
    .trim()
    .replace(/[^0-9A-Za-z]/g, '')
}

/**
 * @returns {Promise<{ sent: number, skipped: number, failed: number, errors: Array<{ employee_id: string, message: string }> }>}
 */
export async function sendPayslipEmailsForPeriod(db, { companyId, period }) {
  const smtp = resolveSmtpConfig(db, companyId)
  if (!smtp.host) {
    throw new Error('SMTP is not configured. Set host (and usually port, from, user, password) under Settings → Payslip email, or set HR_SMTP_* environment variables.')
  }
  if (!smtp.from) {
    throw new Error('SMTP "from" address is required (Settings → Payslip email, or HR_SMTP_FROM).')
  }

  const company = db.prepare('SELECT id, name, tax_pin, logo_url FROM companies WHERE id = ?').get(companyId)
  if (!company) {
    throw new Error('Company not found')
  }

  const payrollSettings = {
    standard_allowance: parseFloat(getSetting(db, companyId, 'standard_allowance')) || 0,
    housing_allowance: parseFloat(getSetting(db, companyId, 'housing_allowance')) || 0,
    housing_allowance_type: getSetting(db, companyId, 'housing_allowance_type') || 'fixed'
  }

  const pdfBranding = pdfBrandingFromCompanySettings({
    pdf_letterhead_logo_enabled: getSetting(db, companyId, 'pdf_letterhead_logo_enabled'),
    pdf_watermark_opacity: getSetting(db, companyId, 'pdf_watermark_opacity'),
    pdf_payslip_watermark_opacity: getSetting(db, companyId, 'pdf_payslip_watermark_opacity')
  })

  let payslipLogoBuffer = null
  const logoUrl = company.logo_url != null ? String(company.logo_url).trim() : ''
  if (logoUrl) {
    try {
      const res = await fetch(logoUrl)
      if (res.ok) {
        payslipLogoBuffer = Buffer.from(await res.arrayBuffer())
      }
    } catch (_) {
      /* emailed payslips still work without watermark */
    }
  }

  const runs = db
    .prepare(
      'SELECT * FROM payroll_runs WHERE company_id = ? AND period = ? ORDER BY employee_id'
    )
    .all(companyId, period)

  if (!runs.length) {
    throw new Error(`No payroll runs for period ${period}. Save payroll first.`)
  }

  const emps = db.prepare('SELECT * FROM employees WHERE company_id = ?').all(companyId)
  const empById = new Map(emps.map((r) => [r.id, mapEmployeeRow(r)]))

  const deductions = db
    .prepare(
      'SELECT * FROM employee_deductions WHERE company_id = ? AND period = ?'
    )
    .all(companyId, period)
  const dedByEmp = new Map(deductions.map((d) => [d.employee_id, d]))

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass || '' } : undefined
  })

  let sent = 0
  let skipped = 0
  let failed = 0
  const errors = []

  for (const run of runs) {
    const emp = empById.get(run.employee_id)
    if (!emp) {
      skipped += 1
      continue
    }
    if (!emailOk(emp.email)) {
      skipped += 1
      continue
    }
    const pdfPassword = idNumberPassword(emp.id_number)
    if (!pdfPassword) {
      skipped += 1
      errors.push({
        employee_id: run.employee_id,
        message: 'Skipped: employee ID number is missing (required for payslip PDF password).'
      })
      continue
    }

    try {
      const deduction = dedByEmp.get(run.employee_id) || {}
      const pdfBuffer = await buildPayslipPdfBuffer({
        companyName: company.name,
        companyTaxPin: company.tax_pin || '',
        period,
        run,
        emp,
        deduction,
        payrollSettings,
        logoBuffer: payslipLogoBuffer,
        pdfPassword,
        pdfBranding
      })

      const subjPeriod = String(period).replace('-', ' ')
      await transporter.sendMail({
        from: smtp.from,
        to: emp.email.trim(),
        subject: `Payslip — ${company.name || 'Company'} — ${subjPeriod}`,
        text:
          `Hello ${emp.name || ''},\n\n` +
          `Please find your payslip for ${subjPeriod} attached.\n` +
          `This PDF is password-protected.\n` +
          `Password: your ID number on record.\n\n` +
          `${company.name || ''}`,
        attachments: [
          {
            filename: `Payslip_${(emp.staff_no || emp.employee_id || emp.$id).replace(/[^a-zA-Z0-9_-]/g, '_')}_${period}.pdf`,
            content: pdfBuffer
          }
        ]
      })
      sent += 1
    } catch (err) {
      failed += 1
      errors.push({
        employee_id: run.employee_id,
        message: err?.message || String(err)
      })
    }
  }

  return { sent, skipped, failed, errors }
}
