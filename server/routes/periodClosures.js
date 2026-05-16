import { Router } from 'express'
import { randomUUID } from 'crypto'
import { requireLocalUser } from '../middleware/auth.js'
import { runInTransaction } from '../utils/transactions.js'

function mapClosureRow(row) {
  if (!row) return null
  return { ...row, $id: row.id }
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createPeriodClosureRoutes(db) {
  const r = Router()
  const auth = requireLocalUser(db)

  r.get('/', auth, (req, res) => {
    try {
      const companyId = String(req.query.company_id || '')
      const period = String(req.query.period || '')
      if (!companyId || !period) {
        return res.status(400).json({ error: 'company_id and period are required' })
      }
      const row = db
        .prepare('SELECT * FROM period_closures WHERE company_id = ? AND period = ?')
        .get(companyId, period)
      res.json(mapClosureRow(row))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/', auth, (req, res) => {
    try {
      const companyId = String(req.body?.company_id || '')
      const period = String(req.body?.period || '')
      if (!companyId || !period) {
        return res.status(400).json({ error: 'company_id and period are required' })
      }

      const existing = db
        .prepare('SELECT * FROM period_closures WHERE company_id = ? AND period = ?')
        .get(companyId, period)
      if (existing) {
        return res.status(200).json(mapClosureRow(existing))
      }

      const now = new Date().toISOString()
      const id = randomUUID()
      const notes = String(req.body?.notes || `Period closed by user ${req.body?.closed_by || req.userId || 'N/A'}`)

      runInTransaction(db, () => {
        db.prepare(
          `INSERT INTO period_closures (id, company_id, period, closed_by, closed_at, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          id,
          companyId,
          period,
          String(req.body?.closed_by || req.userId || ''),
          now,
          notes,
          now,
          now
        )
        db.prepare(
          `INSERT INTO audit_log (id, user_id, company_id, action, entity_type, entity_id, new_value, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          randomUUID(),
          req.userId,
          companyId,
          'period_close',
          'period_closures',
          id,
          JSON.stringify({ company_id: companyId, period }),
          now
        )
      })

      const row = db.prepare('SELECT * FROM period_closures WHERE id = ?').get(id)
      res.status(201).json(mapClosureRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  return r
}
