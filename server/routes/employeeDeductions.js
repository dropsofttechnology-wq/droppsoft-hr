import { Router } from 'express'
import { randomUUID } from 'crypto'
import { requireLocalUser } from '../middleware/auth.js'

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createEmployeeDeductionsRoutes(db) {
  const r = Router()
  const auth = requireLocalUser(db)

  r.post('/', auth, (req, res) => {
    try {
      const companyId = String(req.body?.company_id || '')
      const employeeId = String(req.body?.employee_id || '')
      const period = String(req.body?.period || '')
      if (!companyId || !employeeId || !period) {
        return res.status(400).json({ error: 'company_id, employee_id, and period are required' })
      }
      const now = new Date().toISOString()
      const absentDays = Math.max(0, Math.min(30, parseInt(String(req.body?.absent_days ?? 0), 10) || 0))
      const advanceAmount = Math.max(0, Number(req.body?.advance_amount) || 0)
      const shoppingAmount = Math.max(0, Number(req.body?.shopping_amount) || 0)
      const notes = String(req.body?.notes || '')

      const existing = db
        .prepare(
          'SELECT id FROM employee_deductions WHERE company_id = ? AND employee_id = ? AND period = ?'
        )
        .get(companyId, employeeId, period)

      if (existing) {
        db.prepare(
          `UPDATE employee_deductions SET absent_days = ?, advance_amount = ?, shopping_amount = ?, notes = ?, updated_at = ?
           WHERE id = ?`
        ).run(absentDays, advanceAmount, shoppingAmount, notes, now, existing.id)
      } else {
        const id = randomUUID()
        db.prepare(
          `INSERT INTO employee_deductions (id, company_id, employee_id, period, absent_days, advance_amount, shopping_amount, notes, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          id,
          companyId,
          employeeId,
          period,
          absentDays,
          advanceAmount,
          shoppingAmount,
          notes,
          now
        )
      }
      const row = db
        .prepare(
          'SELECT * FROM employee_deductions WHERE company_id = ? AND employee_id = ? AND period = ?'
        )
        .get(companyId, employeeId, period)
      res.status(existing ? 200 : 201).json({ ...row, $id: row.id })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.get('/', auth, (req, res) => {
    try {
      const companyId = String(req.query.company_id || '')
      const period = String(req.query.period || '')
      if (!companyId || !period) {
        return res.status(400).json({ error: 'company_id and period are required' })
      }
      const rows = db
        .prepare(
          'SELECT * FROM employee_deductions WHERE company_id = ? AND period = ? ORDER BY employee_id'
        )
        .all(companyId, period)
      res.json(rows)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  return r
}
