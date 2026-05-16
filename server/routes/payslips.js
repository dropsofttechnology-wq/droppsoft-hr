import { Router } from 'express'
import { requireLocalUser } from '../middleware/auth.js'
import { sendPayslipEmailsForPeriod } from '../services/sendPayslipEmails.js'

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createPayslipsRoutes(db) {
  const r = Router()
  const auth = requireLocalUser(db)

  /** Email PDF payslips to each employee's work email (from employee record). */
  r.post('/send-email', auth, async (req, res) => {
    try {
      const companyId = String(req.body?.company_id || '')
      const period = String(req.body?.period || '')
      if (!companyId || !period) {
        return res.status(400).json({ error: 'company_id and period are required' })
      }
      const result = await sendPayslipEmailsForPeriod(db, { companyId, period })
      res.json(result)
    } catch (e) {
      res.status(400).json({ error: e.message || 'Failed to send payslip emails' })
    }
  })

  return r
}
