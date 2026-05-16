import { Router } from 'express'
import { randomUUID } from 'crypto'
import nodemailer from 'nodemailer'
import { requireLocalUser } from '../middleware/auth.js'
import { resolveSmtpConfig } from '../services/sendPayslipEmails.js'

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createSettingsRoutes(db) {
  const r = Router()
  const auth = requireLocalUser(db)

  r.get('/', auth, (req, res) => {
    try {
      const companyId = String(req.query.company_id || '')
      if (!companyId) {
        return res.status(400).json({ error: 'company_id is required' })
      }
      const rows = db
        .prepare('SELECT setting_key, setting_value FROM settings WHERE company_id = ?')
        .all(companyId)
      res.json(rows)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  /** Replace or insert many key/value pairs for one company */
  r.put('/bulk', auth, (req, res) => {
    try {
      const companyId = String(req.body?.company_id || '')
      const values = req.body?.values
      if (!companyId || !values || typeof values !== 'object') {
        return res.status(400).json({ error: 'company_id and values object are required' })
      }
      const now = new Date().toISOString()
      const sel = db.prepare(
        'SELECT id FROM settings WHERE company_id = ? AND setting_key = ? LIMIT 1'
      )
      const upd = db.prepare(
        'UPDATE settings SET setting_value = ?, updated_at = ? WHERE id = ?'
      )
      const ins = db.prepare(
        `INSERT INTO settings (id, company_id, setting_key, setting_value, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )

      const work = db.transaction(() => {
        for (const [key, val] of Object.entries(values)) {
          const settingKey = String(key)
          const settingValue = String(val)
          const row = sel.get(companyId, settingKey)
          if (row) {
            upd.run(settingValue, now, row.id)
          } else {
            ins.run(randomUUID(), companyId, settingKey, settingValue, now)
          }
        }
      })
      work()
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  /** Validate SMTP config by opening/authenticating a transport connection (no email sent). */
  r.post('/smtp-test', auth, async (req, res) => {
    try {
      const companyId = String(req.body?.company_id || '')
      if (!companyId) {
        return res.status(400).json({ error: 'company_id is required' })
      }

      const smtp = resolveSmtpConfig(db, companyId)
      if (!smtp.host) {
        return res.status(400).json({
          error: 'SMTP host is missing. Fill Settings → Payslip email (SMTP) first.'
        })
      }
      if (!smtp.from) {
        return res.status(400).json({
          error: 'From address is missing. Fill Settings → Payslip email (SMTP) first.'
        })
      }

      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: smtp.user ? { user: smtp.user, pass: smtp.pass || '' } : undefined,
        connectionTimeout: 12000,
        greetingTimeout: 12000,
        socketTimeout: 12000
      })

      await transporter.verify()
      res.json({
        ok: true,
        config: {
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          user: smtp.user || '',
          from: smtp.from || ''
        }
      })
    } catch (e) {
      res.status(400).json({
        error: e?.message || 'SMTP test failed'
      })
    }
  })

  return r
}
