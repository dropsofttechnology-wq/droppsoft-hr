import { Router } from 'express'
import { randomUUID } from 'crypto'
import { requireLocalUser } from '../middleware/auth.js'
import { mapLeaveTypeRow } from '../utils/rowMappers.js'
import { getUserRole } from '../utils/userRole.js'
import { roleHasPermission } from '../utils/rolePermissions.js'

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createLeaveTypeRoutes(db) {
  const r = Router()
  const auth = requireLocalUser(db)

  r.get('/', auth, (req, res) => {
    try {
      const companyId = String(req.query.company_id || '')
      if (!companyId) {
        return res.status(400).json({ error: 'company_id is required' })
      }
      const activeOnly = String(req.query.active_only || '1') !== '0'
      let q = 'SELECT * FROM leave_types WHERE company_id = ?'
      const params = [companyId]
      if (activeOnly) {
        q += " AND status = 'active'"
      }
      q += ' ORDER BY COALESCE(display_order, 0), leave_code, name'
      const rows = db.prepare(q).all(...params)
      res.json(rows.map(mapLeaveTypeRow))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/:id', auth, (req, res) => {
    try {
      const row = db.prepare('SELECT * FROM leave_types WHERE id = ?').get(req.params.id)
      if (!row) return res.status(404).json({ error: 'Not found' })
      res.json(mapLeaveTypeRow(row))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/', auth, (req, res) => {
    try {
      if (getUserRole(db, req.userId) === 'employee') {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      const companyId = String(req.body?.company_id || '')
      const leaveCode = String(req.body?.leave_code || '').trim().toUpperCase()
      const leaveName = String(req.body?.leave_name || '').trim()
      if (!companyId || !leaveCode || !leaveName) {
        return res.status(400).json({ error: 'company_id, leave_code, and leave_name are required' })
      }
      const now = new Date().toISOString()
      const id = randomUUID()
      const entitlement = Number.parseFloat(String(req.body?.entitlement_days ?? 0)) || 0
      const displayOrder = Number.parseInt(String(req.body?.display_order ?? 0), 10) || 0
      const isStat = req.body?.is_statutory ? 1 : 0
      const payPct = Math.max(
        0,
        Math.min(100, Number.parseFloat(String(req.body?.pay_percentage ?? 100)) || 100)
      )
      db.prepare(
        `INSERT INTO leave_types (
          id, company_id, name, days_allowed, description, status, leave_code, display_order, is_statutory, pay_percentage, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        companyId,
        leaveName,
        entitlement,
        String(req.body?.description || ''),
        String(req.body?.status || 'active'),
        leaveCode,
        displayOrder,
        isStat,
        payPct,
        now,
        now
      )
      const row = db.prepare('SELECT * FROM leave_types WHERE id = ?').get(id)
      res.status(201).json(mapLeaveTypeRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.put('/:id', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      if (!roleHasPermission(db, role, 'leave_types_config')) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      const now = new Date().toISOString()
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM leave_types WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Not found' })

      const leaveName =
        req.body?.leave_name != null ? String(req.body.leave_name).trim() : existing.name
      const leaveCode =
        req.body?.leave_code != null
          ? String(req.body.leave_code).trim().toUpperCase()
          : existing.leave_code || ''
      const entitlement =
        req.body?.entitlement_days != null
          ? Number.parseFloat(String(req.body.entitlement_days)) || 0
          : existing.days_allowed ?? 0
      const displayOrder =
        req.body?.display_order != null
          ? Number.parseInt(String(req.body.display_order), 10) || 0
          : existing.display_order ?? 0
      const isStat = req.body?.is_statutory != null ? (req.body.is_statutory ? 1 : 0) : existing.is_statutory ?? 0
      const description =
        req.body?.description != null ? String(req.body.description) : existing.description || ''
      const status = req.body?.status != null ? String(req.body.status) : existing.status
      const payPct =
        req.body?.pay_percentage != null
          ? Math.max(0, Math.min(100, Number.parseFloat(String(req.body.pay_percentage)) || 100))
          : existing.pay_percentage != null
            ? Number(existing.pay_percentage)
            : 100

      db.prepare(
        `UPDATE leave_types SET name = ?, days_allowed = ?, description = ?, status = ?, leave_code = ?, display_order = ?, is_statutory = ?, pay_percentage = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        leaveName,
        entitlement,
        description,
        status,
        leaveCode,
        displayOrder,
        isStat,
        payPct,
        now,
        id
      )
      const row = db.prepare('SELECT * FROM leave_types WHERE id = ?').get(id)
      res.json(mapLeaveTypeRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.delete('/:id', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      if (!roleHasPermission(db, role, 'leave_types_config')) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      const r0 = db.prepare('DELETE FROM leave_types WHERE id = ?').run(req.params.id)
      if (r0.changes === 0) return res.status(404).json({ error: 'Not found' })
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  return r
}
