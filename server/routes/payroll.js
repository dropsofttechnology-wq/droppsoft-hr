import { Router } from 'express'
import { requireLocalUser } from '../middleware/auth.js'
import { postPayrollRun } from '../services/payrollTransaction.js'

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createPayrollRoutes(db) {
  const r = Router()
  const auth = requireLocalUser(db)

  r.get('/runs', auth, (req, res) => {
    try {
      const { company_id, period } = req.query
      let q = 'SELECT * FROM payroll_runs WHERE 1=1'
      const params = []
      if (company_id) {
        q += ' AND company_id = ?'
        params.push(company_id)
      }
      if (period) {
        q += ' AND period = ?'
        params.push(period)
      }
      q += ' ORDER BY period DESC, employee_id'
      const rows = db.prepare(q).all(...params)
      res.json(rows)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.delete('/runs', auth, (req, res) => {
    try {
      const { company_id, period } = req.query
      if (!company_id || !period) {
        return res.status(400).json({ error: 'company_id and period are required' })
      }
      const rows = db
        .prepare('SELECT id FROM payroll_runs WHERE company_id = ? AND period = ?')
        .all(company_id, period)
      const del = db.prepare('DELETE FROM payroll_runs WHERE id = ?')
      for (const row of rows) {
        del.run(row.id)
      }
      res.json({ deleted: rows.length })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/runs', auth, (req, res) => {
    try {
      const payload = {
        ...(req.body || {}),
        user_id: req.userId
      }
      const result = postPayrollRun(db, payload)
      res.status(201).json(result)
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  return r
}
