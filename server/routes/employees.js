import { Router } from 'express'
import { randomUUID } from 'crypto'
import { requireLocalUser } from '../middleware/auth.js'
import { mapEmployeeRow } from '../utils/rowMappers.js'
import { runInTransaction } from '../utils/transactions.js'
import { getUserRole } from '../utils/userRole.js'
import { roleHasPermission } from '../utils/rolePermissions.js'

/**
 * Super admin may set or clear; other roles keep existing. Creates use null for existing.
 */
function annualLeaveEntitlementForSave(body, existingRow, role) {
  if (role !== 'super_admin') {
    const e = existingRow?.annual_leave_entitlement_days
    return e != null && e !== '' && Number.isFinite(Number(e)) ? Number(e) : null
  }
  if (body.annual_leave_entitlement_days === undefined) {
    const e = existingRow?.annual_leave_entitlement_days
    return e != null && e !== '' && Number.isFinite(Number(e)) ? Number(e) : null
  }
  const v = body.annual_leave_entitlement_days
  if (v === null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > 366) {
    throw new Error('annual_leave_entitlement_days must be between 0 and 366')
  }
  return n
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createEmployeeRoutes(db) {
  const r = Router()
  const auth = requireLocalUser(db)

  r.get('/by-user/:userId', auth, (req, res) => {
    try {
      const row = db.prepare('SELECT * FROM employees WHERE user_id = ? LIMIT 1').get(req.params.userId)
      res.json(mapEmployeeRow(row))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      const { company_id, status, search } = req.query
      let q = 'SELECT * FROM employees WHERE 1=1'
      const params = []
      if (company_id) {
        q += ' AND company_id = ?'
        params.push(String(company_id))
      }
      if (role === 'employee') {
        q += ' AND user_id = ?'
        params.push(req.userId)
      }
      if (status && status !== 'all') {
        q += ' AND status = ?'
        params.push(String(status))
      }
      if (search) {
        q += ' AND name LIKE ?'
        params.push(`%${String(search)}%`)
      }
      q +=
        " ORDER BY (CASE WHEN TRIM(COALESCE(employee_id,'')) GLOB '[0-9]*' AND LENGTH(TRIM(COALESCE(employee_id,''))) > 0 THEN CAST(TRIM(employee_id) AS INTEGER) ELSE -1 END), employee_id COLLATE NOCASE, staff_no COLLATE NOCASE"
      const rows = db.prepare(q).all(...params)
      res.json(rows.map((row) => mapEmployeeRow(row)))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/:id', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      const row = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id)
      if (!row) return res.status(404).json({ error: 'Employee not found' })
      if (role === 'employee' && row.user_id !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      res.json(mapEmployeeRow(row))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      if (!roleHasPermission(db, role, 'manage_employees')) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      const body = req.body || {}
      if (!body.company_id || !body.name) {
        return res.status(400).json({ error: 'company_id and name are required' })
      }
      let alEnt
      try {
        alEnt = annualLeaveEntitlementForSave(body, null, role)
      } catch (e) {
        return res.status(400).json({ error: e.message || 'Invalid annual leave entitlement' })
      }
      const now = new Date().toISOString()
      const id = randomUUID()
      const created = runInTransaction(db, () => {
        db.prepare(
          `INSERT INTO employees (
            id, user_id, company_id, employee_id, staff_no, name, id_number, kra_pin,
            nssf_number, shif_number, department, position, basic_salary, phone, email,
            bank_account, bank_name, bank_branch, contract_start_date, contract_end_date,
            status, role, gender, annual_leave_entitlement_days, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          id,
          body.user_id || '',
          body.company_id,
          body.employee_id || '',
          body.staff_no || '',
          body.name,
          body.id_number || '',
          body.kra_pin || '',
          body.nssf_number || '',
          body.shif_number || '',
          body.department || '',
          body.position || '',
          Number(body.basic_salary || 0),
          body.phone || '',
          body.email || '',
          body.bank_account || '',
          body.bank_name || '',
          body.bank_branch || '',
          body.contract_start_date || '',
          body.contract_end_date || '',
          body.status || 'active',
          body.role || 'employee',
          body.gender || '',
          alEnt,
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
          body.company_id,
          'employee_create',
          'employees',
          id,
          JSON.stringify({ name: body.name, employee_id: body.employee_id || '' }),
          now
        )
        return db.prepare('SELECT * FROM employees WHERE id = ?').get(id)
      })
      res.status(201).json(mapEmployeeRow(created))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.put('/:id', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      if (!roleHasPermission(db, role, 'manage_employees')) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      const body = req.body || {}
      const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id)
      if (!existing) return res.status(404).json({ error: 'Employee not found' })
      let alEnt
      try {
        alEnt = annualLeaveEntitlementForSave(body, existing, role)
      } catch (e) {
        return res.status(400).json({ error: e.message || 'Invalid annual leave entitlement' })
      }
      const now = new Date().toISOString()
      const updated = runInTransaction(db, () => {
        db.prepare(
          `UPDATE employees SET
            user_id = ?, company_id = ?, employee_id = ?, staff_no = ?, name = ?, id_number = ?, kra_pin = ?,
            nssf_number = ?, shif_number = ?, department = ?, position = ?, basic_salary = ?, phone = ?, email = ?,
            bank_account = ?, bank_name = ?, bank_branch = ?, contract_start_date = ?, contract_end_date = ?,
            status = ?, role = ?, gender = ?, annual_leave_entitlement_days = ?, updated_at = ?
          WHERE id = ?`
        ).run(
          body.user_id ?? existing.user_id,
          body.company_id ?? existing.company_id,
          body.employee_id ?? existing.employee_id,
          body.staff_no ?? existing.staff_no,
          body.name ?? existing.name,
          body.id_number ?? existing.id_number,
          body.kra_pin ?? existing.kra_pin,
          body.nssf_number ?? existing.nssf_number,
          body.shif_number ?? existing.shif_number,
          body.department ?? existing.department,
          body.position ?? existing.position,
          Number(body.basic_salary ?? existing.basic_salary ?? 0),
          body.phone ?? existing.phone,
          body.email ?? existing.email,
          body.bank_account ?? existing.bank_account,
          body.bank_name ?? existing.bank_name,
          body.bank_branch ?? existing.bank_branch,
          body.contract_start_date ?? existing.contract_start_date,
          body.contract_end_date ?? existing.contract_end_date,
          body.status ?? existing.status,
          body.role ?? existing.role,
          body.gender ?? existing.gender,
          alEnt,
          now,
          req.params.id
        )
        db.prepare(
          `INSERT INTO audit_log (
            id, user_id, company_id, action, entity_type, entity_id, old_value, new_value, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          randomUUID(),
          req.userId,
          existing.company_id,
          'employee_update',
          'employees',
          req.params.id,
          JSON.stringify({ name: existing.name, status: existing.status }),
          JSON.stringify({ name: body.name ?? existing.name, status: body.status ?? existing.status }),
          now
        )
        return db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id)
      })
      res.json(mapEmployeeRow(updated))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.delete('/:id', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      if (!roleHasPermission(db, role, 'manage_employees')) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id)
      if (!existing) return res.status(404).json({ error: 'Employee not found' })
      const now = new Date().toISOString()
      runInTransaction(db, () => {
        db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id)
        db.prepare(
          `INSERT INTO audit_log (
            id, user_id, company_id, action, entity_type, entity_id, old_value, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          randomUUID(),
          req.userId,
          existing.company_id,
          'employee_delete',
          'employees',
          req.params.id,
          JSON.stringify({ name: existing.name, employee_id: existing.employee_id }),
          now
        )
      })
      res.json({ deleted: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  return r
}
