import { Router } from 'express'
import { randomUUID } from 'crypto'
import { requireLocalUser } from '../middleware/auth.js'
import { runInTransaction } from '../utils/transactions.js'
import { getUserRole } from '../utils/userRole.js'
import { roleHasPermission } from '../utils/rolePermissions.js'
import { mapLeaveRequestRow } from '../utils/rowMappers.js'
import { getDefaultBalanceDeduction, normalizeBalanceDeduction } from '../utils/leaveBalanceDeduction.js'
import { assertAnnualPoolAllowsBooking } from '../utils/annualLeavePoolCheck.js'

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createLeaveRoutes(db) {
  const r = Router()
  const auth = requireLocalUser(db)

  function employeeIdForUser(userId) {
    const row = db.prepare('SELECT id FROM employees WHERE user_id = ? LIMIT 1').get(userId)
    return row?.id || null
  }

  r.get('/requests', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      let q = `SELECT lr.*, su.name AS approver_name
               FROM leave_requests lr
               LEFT JOIN sys_users su ON lr.approved_by = su.id
               WHERE 1=1`
      const params = []
      const { company_id, status, employee_id } = req.query
      if (company_id) {
        q += ' AND lr.company_id = ?'
        params.push(String(company_id))
      }
      if (status) {
        q += ' AND lr.status = ?'
        params.push(String(status))
      }
      if (employee_id) {
        q += ' AND lr.employee_id = ?'
        params.push(String(employee_id))
      }
      // Optional overlap window: leave intersects [from, to] (yyyy-MM-dd)
      const { from, to } = req.query
      if (from) {
        q += ' AND lr.end_date >= ?'
        params.push(String(from))
      }
      if (to) {
        q += ' AND lr.start_date <= ?'
        params.push(String(to))
      }
      if (role === 'employee') {
        const eid = employeeIdForUser(req.userId)
        if (!eid) return res.json([])
        q += ' AND lr.employee_id = ?'
        params.push(eid)
      }
      q += ' ORDER BY lr.created_at DESC'
      const rows = db.prepare(q).all(...params)
      res.json(rows.map(mapLeaveRequestRow))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/requests/:id', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      const row = db
        .prepare(
          `SELECT lr.*, su.name AS approver_name
           FROM leave_requests lr
           LEFT JOIN sys_users su ON lr.approved_by = su.id
           WHERE lr.id = ?`
        )
        .get(req.params.id)
      if (!row) return res.status(404).json({ error: 'Leave request not found' })
      if (role === 'employee') {
        const eid = employeeIdForUser(req.userId)
        if (!eid || row.employee_id !== eid) return res.status(403).json({ error: 'Forbidden' })
      }
      res.json(mapLeaveRequestRow(row))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/requests', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      const now = new Date().toISOString()
      const payload = req.body || {}
      const companyId = String(payload.company_id || '')
      let employeeId = String(payload.employee_id || '')
      const leaveType = String(payload.leave_type || '').toUpperCase()
      const leaveReasonDefault = leaveType ? `${leaveType} leave` : 'For personal reason'
      const start = String(payload.start_date || '')
      const end = String(payload.end_date || '')
      if (!companyId || !leaveType || !start || !end) {
        return res.status(400).json({ error: 'company_id, employee_id, leave_type, start_date, end_date required' })
      }
      if (role === 'employee') {
        const eid = employeeIdForUser(req.userId)
        if (!eid) return res.status(403).json({ error: 'No employee profile linked to this account' })
        employeeId = eid
      }
      if (!employeeId) {
        return res.status(400).json({ error: 'employee_id is required' })
      }

      const emp = db.prepare('SELECT id, company_id FROM employees WHERE id = ?').get(employeeId)
      if (!emp || emp.company_id !== companyId) {
        return res.status(400).json({ error: 'Employee not found for this company' })
      }

      const startDate = new Date(start)
      const endDate = new Date(end)
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
        return res.status(400).json({ error: 'Invalid date range' })
      }

      if (role === 'employee') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        if (startDate < today) {
          return res.status(400).json({ error: 'Start date cannot be in the past' })
        }
      }
      const daysRequested = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1
      const balanceDeduction = normalizeBalanceDeduction(payload.balance_deduction, leaveType)
      const id = randomUUID()

      const result = runInTransaction(db, () => {
        const overlap = db
          .prepare(
            `SELECT id FROM leave_requests
             WHERE employee_id = ?
               AND status IN ('pending', 'approved')
               AND start_date <= ?
               AND end_date >= ?
             LIMIT 1`
          )
          .get(employeeId, end, start)
        if (overlap) {
          throw new Error('Leave request overlaps with existing pending or approved leave')
        }

        db.prepare(
          `INSERT INTO leave_requests (
            id, company_id, employee_id, leave_type, start_date, end_date, days_requested,
            reason, balance_deduction, status, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
        ).run(
          id,
          companyId,
          employeeId,
          leaveType,
          start,
          end,
          daysRequested,
          payload.reason || leaveReasonDefault,
          balanceDeduction,
          req.userId,
          now,
          now
        )

        db.prepare(
          `INSERT INTO audit_log (
            id, user_id, company_id, action, entity_type, entity_id, new_value, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          randomUUID(),
          req.userId,
          companyId,
          'leave_request_create',
          'leave_requests',
          id,
          JSON.stringify({ employee_id: employeeId, leave_type: leaveType, start_date: start, end_date: end }),
          now
        )

        return db
          .prepare(
            `SELECT lr.*, su.name AS approver_name
             FROM leave_requests lr
             LEFT JOIN sys_users su ON lr.approved_by = su.id
             WHERE lr.id = ?`
          )
          .get(id)
      })

      res.status(201).json(mapLeaveRequestRow(result))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.patch('/requests/:id', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      if (!roleHasPermission(db, role, 'leave_request_approval')) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      const requestId = req.params.id
      const payload = req.body || {}
      const now = new Date().toISOString()

      const payloadKeys = Object.keys(payload).filter((k) => payload[k] !== undefined)
      const notesOnly =
        payloadKeys.length === 1 && payloadKeys[0] === 'admin_form_notes' && payload.admin_form_notes !== undefined

      if (notesOnly) {
        const row = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(requestId)
        if (!row) return res.status(404).json({ error: 'Leave request not found' })
        if (row.status === 'inactive') {
          return res.status(400).json({ error: 'Deactivated leave cannot be edited' })
        }
        const text = payload.admin_form_notes == null ? '' : String(payload.admin_form_notes)
        db.prepare(`UPDATE leave_requests SET admin_form_notes = ?, updated_at = ? WHERE id = ?`).run(text, now, requestId)
        db.prepare(
          `INSERT INTO audit_log (
            id, user_id, company_id, action, entity_type, entity_id, new_value, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          randomUUID(),
          req.userId,
          row.company_id,
          'leave_request_form_notes',
          'leave_requests',
          requestId,
          JSON.stringify({ admin_form_notes: text }),
          now
        )
        const updated = db
          .prepare(
            `SELECT lr.*, su.name AS approver_name
             FROM leave_requests lr
             LEFT JOIN sys_users su ON lr.approved_by = su.id
             WHERE lr.id = ?`
          )
          .get(requestId)
        return res.json(mapLeaveRequestRow(updated))
      }

      const result = runInTransaction(db, () => {
        const row = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(requestId)
        if (!row) throw new Error('Leave request not found')
        if (row.status === 'inactive') {
          throw new Error('Deactivated leave cannot be edited')
        }

        let employeeId = row.employee_id
        if (payload.employee_id != null && String(payload.employee_id).trim() !== '') {
          const eid = String(payload.employee_id).trim()
          const emp = db.prepare('SELECT id, company_id FROM employees WHERE id = ?').get(eid)
          if (!emp || emp.company_id !== row.company_id) {
            throw new Error('Employee not found for this company')
          }
          employeeId = eid
        }

        const leaveType =
          payload.leave_type != null && String(payload.leave_type).trim() !== ''
            ? String(payload.leave_type).trim().toUpperCase()
            : row.leave_type
        const start =
          payload.start_date != null && String(payload.start_date).trim() !== ''
            ? String(payload.start_date).trim().slice(0, 10)
            : row.start_date
        const end =
          payload.end_date != null && String(payload.end_date).trim() !== ''
            ? String(payload.end_date).trim().slice(0, 10)
            : row.end_date
        const reason =
          payload.reason != null
            ? String(payload.reason)
            : row.reason || (leaveType ? `${leaveType} leave` : 'For personal reason')

        const startDate = new Date(start)
        const endDate = new Date(end)
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
          throw new Error('Invalid date range')
        }

        const overlap = db
          .prepare(
            `SELECT id FROM leave_requests
             WHERE employee_id = ?
               AND status IN ('pending', 'approved')
               AND start_date <= ?
               AND end_date >= ?
               AND id != ?
             LIMIT 1`
          )
          .get(employeeId, end, start, requestId)
        if (overlap) {
          throw new Error('Leave request overlaps with existing pending or approved leave')
        }

        const daysRequested = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1

        let balanceDeduction = normalizeBalanceDeduction(row.balance_deduction, leaveType)
        if (payload.balance_deduction != null && String(payload.balance_deduction).trim() !== '') {
          balanceDeduction = normalizeBalanceDeduction(payload.balance_deduction, leaveType)
        } else if (leaveType !== row.leave_type) {
          balanceDeduction = getDefaultBalanceDeduction(leaveType)
        }

        let adminFormNotes = row.admin_form_notes ?? ''
        if (payload.admin_form_notes !== undefined) {
          adminFormNotes = payload.admin_form_notes == null ? '' : String(payload.admin_form_notes)
        }

        db.prepare(
          `UPDATE leave_requests
           SET employee_id = ?, leave_type = ?, start_date = ?, end_date = ?, days_requested = ?, reason = ?, balance_deduction = ?, admin_form_notes = ?, updated_at = ?
           WHERE id = ?`
        ).run(employeeId, leaveType, start, end, daysRequested, reason, balanceDeduction, adminFormNotes, now, requestId)

        db.prepare(
          `INSERT INTO audit_log (
            id, user_id, company_id, action, entity_type, entity_id, old_value, new_value, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          randomUUID(),
          req.userId,
          row.company_id,
          'leave_request_update',
          'leave_requests',
          requestId,
          JSON.stringify({
            employee_id: row.employee_id,
            leave_type: row.leave_type,
            start_date: row.start_date,
            end_date: row.end_date
          }),
          JSON.stringify({ employee_id: employeeId, leave_type: leaveType, start_date: start, end_date: end }),
          now
        )

        return db
          .prepare(
            `SELECT lr.*, su.name AS approver_name
             FROM leave_requests lr
             LEFT JOIN sys_users su ON lr.approved_by = su.id
             WHERE lr.id = ?`
          )
          .get(requestId)
      })

      res.json(mapLeaveRequestRow(result))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.post('/requests/:id/approve', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      if (!roleHasPermission(db, role, 'leave_request_management')) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      const requestId = req.params.id
      const now = new Date().toISOString()
      const decision = String(req.body?.decision || 'approved').toLowerCase()
      if (!['approved', 'rejected'].includes(decision)) {
        return res.status(400).json({ error: 'decision must be approved or rejected' })
      }

      const result = runInTransaction(db, () => {
        const row = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(requestId)
        if (!row) throw new Error('Leave request not found')
        if (row.status !== 'pending') throw new Error(`Leave request is already ${row.status}`)
        if (row.created_by && String(row.created_by) === String(req.userId)) {
          throw new Error('Maker-checker rule: you cannot approve/reject a leave request that you created')
        }

        if (decision === 'approved') {
          assertAnnualPoolAllowsBooking(db, {
            companyId: row.company_id,
            employeeId: row.employee_id,
            leaveType: row.leave_type,
            balanceDeduction: row.balance_deduction,
            daysRequested: row.days_requested,
            excludeRequestId: null
          })
        }

        db.prepare(
          `UPDATE leave_requests
           SET status = ?, approved_by = ?, approved_at = ?, updated_at = ?
           WHERE id = ?`
        ).run(decision, req.userId, now, now, requestId)

        db.prepare(
          `INSERT INTO audit_log (
            id, user_id, company_id, action, entity_type, entity_id, old_value, new_value, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          randomUUID(),
          req.userId,
          row.company_id,
          decision === 'approved' ? 'leave_request_approve' : 'leave_request_reject',
          'leave_requests',
          requestId,
          JSON.stringify({ status: row.status }),
          JSON.stringify({ status: decision, approved_by: req.userId }),
          now
        )

        return db
          .prepare(
            `SELECT lr.*, su.name AS approver_name
             FROM leave_requests lr
             LEFT JOIN sys_users su ON lr.approved_by = su.id
             WHERE lr.id = ?`
          )
          .get(requestId)
      })

      res.json(mapLeaveRequestRow(result))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.post('/requests/:id/deactivate', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      if (!roleHasPermission(db, role, 'leave_request_deactivate')) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      const requestId = req.params.id
      const now = new Date().toISOString()
      const result = runInTransaction(db, () => {
        const row = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(requestId)
        if (!row) throw new Error('Leave request not found')
        if (row.status !== 'approved') {
          throw new Error('Only approved leave can be deactivated')
        }
        db.prepare(`UPDATE leave_requests SET status = 'inactive', updated_at = ? WHERE id = ?`).run(now, requestId)
        db.prepare(
          `INSERT INTO audit_log (
            id, user_id, company_id, action, entity_type, entity_id, old_value, new_value, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          randomUUID(),
          req.userId,
          row.company_id,
          'leave_request_deactivate',
          'leave_requests',
          requestId,
          JSON.stringify({ status: row.status }),
          JSON.stringify({ status: 'inactive' }),
          now
        )
        return db
          .prepare(
            `SELECT lr.*, su.name AS approver_name
             FROM leave_requests lr
             LEFT JOIN sys_users su ON lr.approved_by = su.id
             WHERE lr.id = ?`
          )
          .get(requestId)
      })
      res.json(mapLeaveRequestRow(result))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.delete('/requests/:id', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      if (!roleHasPermission(db, role, 'leave_request_management')) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      const row = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(req.params.id)
      if (!row) return res.status(404).json({ error: 'Leave request not found' })
      db.prepare('DELETE FROM leave_requests WHERE id = ?').run(req.params.id)
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  return r
}
