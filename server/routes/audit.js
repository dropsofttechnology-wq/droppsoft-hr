import { Router } from 'express'
import { randomUUID } from 'crypto'
import { requireLocalUser } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission-guard.js'

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createAuditRoutes(db) {
  const r = Router()
  const auth = requireLocalUser(db)
  const canViewAudit = requirePermission(db, 'audit_log')

  r.get('/logs', canViewAudit, (req, res) => {
    try {
      const companyId = String(req.query.company_id || '')
      if (!companyId) {
        return res.status(400).json({ error: 'company_id is required' })
      }
      const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100))
      const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0)
      const rows = db
        .prepare(
          `SELECT * FROM audit_log WHERE company_id = ?
           ORDER BY datetime(created_at) DESC
           LIMIT ? OFFSET ?`
        )
        .all(companyId, limit, offset)
      res.json(
        rows.map((row) => ({
          ...row,
          $id: row.id,
          action: row.action,
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          new_value: row.new_value,
          created_at: row.created_at
        }))
      )
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/logs', auth, (req, res) => {
    try {
      const now = new Date().toISOString()
      const id = randomUUID()
      const userId = String(req.body?.user_id || req.userId || 'anonymous')
      const companyId = String(req.body?.company_id || '')
      const action = String(req.body?.action || '').slice(0, 100)
      if (!action) {
        return res.status(400).json({ error: 'action is required' })
      }
      const entityType = String(req.body?.entity_type || '').slice(0, 100)
      const entityId = String(req.body?.entity_id || '').slice(0, 255)
      let newValue = req.body?.new_value != null ? String(req.body.new_value) : ''
      if (newValue.length > 5000) newValue = newValue.slice(0, 5000)

      db.prepare(
        `INSERT INTO audit_log (
          id, user_id, company_id, action, entity_type, entity_id, new_value, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, userId, companyId, action, entityType, entityId, newValue, now)

      res.status(201).json({ ok: true, id })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  return r
}
