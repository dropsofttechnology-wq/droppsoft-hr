import { Router } from 'express'
import { randomUUID } from 'crypto'
import { requireAnyPermission, requirePermission } from '../middleware/permission-guard.js'
import {
  mapExpenseCategoryRow,
  mapExpenseSupplierRow,
  mapOperationalExpenseRow
} from '../utils/rowMappers.js'

const EXPENSE_VIEW = ['operational_expenses', 'operational_expenses_approval']

function requireCompanyId(req, res) {
  const q = req.query.company_id != null ? String(req.query.company_id).trim() : ''
  const b = req.body?.company_id != null ? String(req.body.company_id).trim() : ''
  const id = q || b
  if (!id) {
    res.status(400).json({ error: 'company_id is required' })
    return null
  }
  return id
}

function companyExists(db, companyId) {
  return !!db.prepare('SELECT id FROM companies WHERE id = ?').get(companyId)
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createSchoolOperationalExpensesRoutes(db) {
  const r = Router()
  const canView = requireAnyPermission(db, EXPENSE_VIEW)
  const canEdit = requirePermission(db, 'operational_expenses')
  const canApprove = requirePermission(db, 'operational_expenses_approval')

  function parseAttachmentIds(body) {
    const raw = body?.attachment_ids
    if (!raw) return null
    if (!Array.isArray(raw)) return []
    const ids = raw.map((x) => String(x).trim()).filter(Boolean)
    return JSON.stringify(ids.slice(0, 50))
  }

  function assertOwnCategory(db, companyId, categoryId) {
    const row = db
      .prepare('SELECT id FROM expense_categories WHERE id = ? AND company_id = ?')
      .get(categoryId, companyId)
    return !!row
  }

  function assertOwnSupplier(db, companyId, supplierId) {
    if (!supplierId) return true
    const row = db
      .prepare('SELECT id FROM expense_suppliers WHERE id = ? AND company_id = ?')
      .get(supplierId, companyId)
    return !!row
  }

  function assertEmployeeInCompany(db, companyId, employeeId) {
    if (!employeeId) return true
    const row = db
      .prepare('SELECT id FROM employees WHERE id = ? AND company_id = ?')
      .get(employeeId, companyId)
    return !!row
  }

  function blockSelfApproval(req, row) {
    const role = String(req.userRole || '').toLowerCase()
    if (role === 'super_admin') return null
    const creator = String(row.created_by || '')
    if (creator && creator === String(req.userId)) {
      return { status: 403, error: 'You cannot approve an expense you created (maker–checker).' }
    }
    return null
  }

  function tryAudit(req, { companyId, action, entityType, entityId, oldValue, newValue }) {
    try {
      const id = randomUUID()
      const now = new Date().toISOString()
      const ov = oldValue != null ? String(oldValue).slice(0, 5000) : null
      const nv = newValue != null ? String(newValue).slice(0, 5000) : null
      db.prepare(
        `INSERT INTO audit_log (id, user_id, company_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`
      ).run(id, req.userId, companyId, action, entityType, entityId, ov, nv, now)
    } catch (err) {
      console.error('[school operational_expenses audit]', err.message)
    }
  }

  // --- Categories ---
  r.get('/expense-categories', canView, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const rows = db
        .prepare(
          `SELECT * FROM expense_categories WHERE company_id = ? ORDER BY name COLLATE NOCASE`
        )
        .all(companyId)
      res.json(rows.map(mapExpenseCategoryRow))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/expense-categories', canEdit, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const name = String(req.body?.name || '').trim()
      if (!name) return res.status(400).json({ error: 'name is required' })
      const code = String(req.body?.code || '').trim()
      const parentId = String(req.body?.parent_id || '').trim()
      if (parentId && !assertOwnCategory(db, companyId, parentId)) {
        return res.status(400).json({ error: 'Invalid parent_id' })
      }
      const now = new Date().toISOString()
      const id = randomUUID()
      db.prepare(
        `INSERT INTO expense_categories (id, company_id, name, code, parent_id, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
      ).run(id, companyId, name, code || null, parentId || null, now, now)
      const row = db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id)
      res.status(201).json(mapExpenseCategoryRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.patch('/expense-categories/:id', canEdit, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Category not found' })
      const companyId = existing.company_id
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const name =
        req.body?.name != null ? String(req.body.name).trim() : String(existing.name || '').trim()
      if (!name) return res.status(400).json({ error: 'name is required' })
      const code = req.body?.code != null ? String(req.body.code).trim() : existing.code || ''
      let parentId = existing.parent_id
      if (req.body?.parent_id !== undefined) {
        const p = String(req.body.parent_id || '').trim()
        parentId = p || null
        if (parentId === id) return res.status(400).json({ error: 'Category cannot be its own parent' })
        if (parentId && !assertOwnCategory(db, companyId, parentId)) {
          return res.status(400).json({ error: 'Invalid parent_id' })
        }
      }
      const isActive =
        req.body?.is_active != null ? (req.body.is_active ? 1 : 0) : existing.is_active ? 1 : 0
      const now = new Date().toISOString()
      db.prepare(
        `UPDATE expense_categories SET name = ?, code = ?, parent_id = ?, is_active = ?, updated_at = ? WHERE id = ?`
      ).run(name, code || null, parentId, isActive, now, id)
      const row = db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id)
      res.json(mapExpenseCategoryRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.delete('/expense-categories/:id', canEdit, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Category not found' })
      const used = db
        .prepare('SELECT id FROM operational_expenses WHERE category_id = ? LIMIT 1')
        .get(id)
      if (used) {
        return res.status(400).json({ error: 'Category is in use by expenses; deactivate instead.' })
      }
      const child = db.prepare('SELECT id FROM expense_categories WHERE parent_id = ? LIMIT 1').get(id)
      if (child) return res.status(400).json({ error: 'Remove child categories first.' })
      db.prepare('DELETE FROM expense_categories WHERE id = ?').run(id)
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  // --- Suppliers ---
  r.get('/expense-suppliers', canView, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const rows = db
        .prepare(`SELECT * FROM expense_suppliers WHERE company_id = ? ORDER BY name COLLATE NOCASE`)
        .all(companyId)
      res.json(rows.map(mapExpenseSupplierRow))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/expense-suppliers', canEdit, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const name = String(req.body?.name || '').trim()
      if (!name) return res.status(400).json({ error: 'name is required' })
      const now = new Date().toISOString()
      const id = randomUUID()
      db.prepare(
        `INSERT INTO expense_suppliers (id, company_id, name, tax_id, phone, email, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        companyId,
        name,
        String(req.body?.tax_id || '').trim() || null,
        String(req.body?.phone || '').trim() || null,
        String(req.body?.email || '').trim() || null,
        String(req.body?.notes || '').trim() || null,
        now,
        now
      )
      const row = db.prepare('SELECT * FROM expense_suppliers WHERE id = ?').get(id)
      res.status(201).json(mapExpenseSupplierRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.patch('/expense-suppliers/:id', canEdit, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM expense_suppliers WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Supplier not found' })
      const name =
        req.body?.name != null ? String(req.body.name).trim() : String(existing.name || '').trim()
      if (!name) return res.status(400).json({ error: 'name is required' })
      const now = new Date().toISOString()
      db.prepare(
        `UPDATE expense_suppliers SET name = ?, tax_id = ?, phone = ?, email = ?, notes = ?, updated_at = ? WHERE id = ?`
      ).run(
        name,
        req.body?.tax_id != null ? String(req.body.tax_id).trim() || null : existing.tax_id,
        req.body?.phone != null ? String(req.body.phone).trim() || null : existing.phone,
        req.body?.email != null ? String(req.body.email).trim() || null : existing.email,
        req.body?.notes != null ? String(req.body.notes).trim() || null : existing.notes,
        now,
        id
      )
      const row = db.prepare('SELECT * FROM expense_suppliers WHERE id = ?').get(id)
      res.json(mapExpenseSupplierRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.delete('/expense-suppliers/:id', canEdit, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM expense_suppliers WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Supplier not found' })
      const used = db.prepare('SELECT id FROM operational_expenses WHERE supplier_id = ? LIMIT 1').get(id)
      if (used) {
        return res.status(400).json({ error: 'Supplier is referenced by expenses; remove supplier from those first.' })
      }
      db.prepare('DELETE FROM expense_suppliers WHERE id = ?').run(id)
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  // --- Operational expenses ---
  r.get('/operational-expenses', canView, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      let q = 'SELECT * FROM operational_expenses WHERE company_id = ?'
      const params = [companyId]
      const status = req.query.status ? String(req.query.status).trim().toLowerCase() : ''
      if (status && status !== 'all') {
        q += ' AND status = ?'
        params.push(status)
      }
      const from = req.query.from ? String(req.query.from).trim() : ''
      const to = req.query.to ? String(req.query.to).trim() : ''
      if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
        q += ' AND incurred_on >= ?'
        params.push(from)
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        q += ' AND incurred_on <= ?'
        params.push(to)
      }
      q += ' ORDER BY incurred_on DESC, created_at DESC'
      const rows = db.prepare(q).all(...params)
      res.json(rows.map(mapOperationalExpenseRow))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  /** Must be registered before `GET /operational-expenses/:id` so `summary` is not captured as an id. */
  r.get('/operational-expenses/summary', canView, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      let month = String(req.query.month || '').trim().slice(0, 7)
      if (!month) {
        const d = new Date()
        month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      }
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: 'month must be YYYY-MM' })
      }
      const draftRow = db
        .prepare(
          `SELECT COUNT(*) AS c FROM operational_expenses WHERE company_id = ? AND status = 'draft'`
        )
        .get(companyId)
      const approvedRow = db
        .prepare(
          `SELECT COUNT(*) AS c FROM operational_expenses WHERE company_id = ? AND status = 'approved'`
        )
        .get(companyId)
      const paidMonthRow = db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) AS s FROM operational_expenses
           WHERE company_id = ? AND status = 'paid' AND paid_on IS NOT NULL
             AND strftime('%Y-%m', paid_on) = ?`
        )
        .get(companyId, month)
      res.json({
        company_id: companyId,
        month,
        draft_count: Number(draftRow?.c) || 0,
        approved_count: Number(approvedRow?.c) || 0,
        paid_month_total: Math.round(Number(paidMonthRow?.s || 0) * 100) / 100
      })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/operational-expenses/:id', canView, (req, res) => {
    try {
      const row = db.prepare('SELECT * FROM operational_expenses WHERE id = ?').get(req.params.id)
      if (!row) return res.status(404).json({ error: 'Expense not found' })
      res.json(mapOperationalExpenseRow(row))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/operational-expenses', canEdit, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const categoryId = String(req.body?.category_id || '').trim()
      if (!categoryId || !assertOwnCategory(db, companyId, categoryId)) {
        return res.status(400).json({ error: 'Valid category_id is required' })
      }
      const supplierId = String(req.body?.supplier_id || '').trim()
      if (supplierId && !assertOwnSupplier(db, companyId, supplierId)) {
        return res.status(400).json({ error: 'Invalid supplier_id' })
      }
      const linkedEmployeeId = String(req.body?.linked_employee_id || '').trim()
      if (linkedEmployeeId && !assertEmployeeInCompany(db, companyId, linkedEmployeeId)) {
        return res.status(400).json({ error: 'Invalid linked_employee_id' })
      }
      const description = String(req.body?.description || '').trim()
      if (!description) return res.status(400).json({ error: 'description is required' })
      const amount = Number(req.body?.amount)
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'amount must be a positive number' })
      }
      const incurredOn = String(req.body?.incurred_on || '').trim().slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(incurredOn)) {
        return res.status(400).json({ error: 'incurred_on must be YYYY-MM-DD' })
      }
      const now = new Date().toISOString()
      const id = randomUUID()
      const taxRaw = req.body?.tax_amount
      const taxAmount =
        taxRaw != null && taxRaw !== '' && Number.isFinite(Number(taxRaw)) ? Number(taxRaw) : null
      const att = parseAttachmentIds(req.body)
      db.prepare(
        `INSERT INTO operational_expenses (
          id, company_id, category_id, supplier_id, description, amount, currency, tax_amount,
          incurred_on, paid_on, payment_method, reference, status, linked_employee_id,
          attachment_ids_json, void_reason, notes, rejected_reason, created_by, approved_by, approved_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 'draft', ?, ?, NULL, ?, NULL, ?, NULL, NULL, ?, ?)`
      ).run(
        id,
        companyId,
        categoryId,
        supplierId || null,
        description,
        Math.round(amount * 100) / 100,
        String(req.body?.currency || '').trim(),
        taxAmount,
        incurredOn,
        String(req.body?.payment_method || '').trim() || null,
        String(req.body?.reference || '').trim() || null,
        linkedEmployeeId || null,
        att,
        String(req.body?.notes || '').trim() || null,
        req.userId,
        now,
        now
      )
      const row = db.prepare('SELECT * FROM operational_expenses WHERE id = ?').get(id)
      tryAudit(req, {
        companyId,
        action: 'operational_expense_create',
        entityType: 'operational_expenses',
        entityId: id,
        newValue: JSON.stringify({
          status: row.status,
          amount: row.amount,
          description: row.description,
          incurred_on: row.incurred_on
        })
      })
      res.status(201).json(mapOperationalExpenseRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.patch('/operational-expenses/:id', canEdit, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM operational_expenses WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Expense not found' })
      if (String(existing.status) !== 'draft') {
        return res.status(400).json({ error: 'Only draft expenses can be edited' })
      }
      const companyId = existing.company_id
      let categoryId = existing.category_id
      if (req.body?.category_id != null) {
        categoryId = String(req.body.category_id).trim()
        if (!assertOwnCategory(db, companyId, categoryId)) {
          return res.status(400).json({ error: 'Invalid category_id' })
        }
      }
      let supplierId = existing.supplier_id
      if (req.body?.supplier_id !== undefined) {
        supplierId = String(req.body.supplier_id || '').trim() || null
        if (supplierId && !assertOwnSupplier(db, companyId, supplierId)) {
          return res.status(400).json({ error: 'Invalid supplier_id' })
        }
      }
      let linkedEmployeeId = existing.linked_employee_id
      if (req.body?.linked_employee_id !== undefined) {
        linkedEmployeeId = String(req.body.linked_employee_id || '').trim() || null
        if (linkedEmployeeId && !assertEmployeeInCompany(db, companyId, linkedEmployeeId)) {
          return res.status(400).json({ error: 'Invalid linked_employee_id' })
        }
      }
      const description =
        req.body?.description != null
          ? String(req.body.description).trim()
          : String(existing.description || '').trim()
      if (!description) return res.status(400).json({ error: 'description is required' })
      let amount = Number(existing.amount)
      if (req.body?.amount != null) {
        amount = Number(req.body.amount)
        if (!Number.isFinite(amount) || amount <= 0) {
          return res.status(400).json({ error: 'amount must be a positive number' })
        }
      }
      let incurredOn = existing.incurred_on
      if (req.body?.incurred_on != null) {
        incurredOn = String(req.body.incurred_on).trim().slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(incurredOn)) {
          return res.status(400).json({ error: 'incurred_on must be YYYY-MM-DD' })
        }
      }
      const now = new Date().toISOString()
      const taxRaw = req.body?.tax_amount
      let taxAmount = existing.tax_amount
      if (taxRaw !== undefined) {
        taxAmount =
          taxRaw != null && taxRaw !== '' && Number.isFinite(Number(taxRaw)) ? Number(taxRaw) : null
      }
      let attJson = existing.attachment_ids_json
      if (req.body?.attachment_ids !== undefined) {
        attJson = parseAttachmentIds(req.body)
      }
      db.prepare(
        `UPDATE operational_expenses SET
          category_id = ?, supplier_id = ?, description = ?, amount = ?, currency = ?, tax_amount = ?,
          incurred_on = ?, payment_method = ?, reference = ?, linked_employee_id = ?,
          attachment_ids_json = ?, notes = ?, updated_at = ?
        WHERE id = ?`
      ).run(
        categoryId,
        supplierId,
        description,
        Math.round(amount * 100) / 100,
        req.body?.currency != null ? String(req.body.currency).trim() : existing.currency || '',
        taxAmount,
        incurredOn,
        req.body?.payment_method != null
          ? String(req.body.payment_method).trim() || null
          : existing.payment_method,
        req.body?.reference != null ? String(req.body.reference).trim() || null : existing.reference,
        linkedEmployeeId,
        attJson,
        req.body?.notes != null ? String(req.body.notes).trim() || null : existing.notes,
        now,
        id
      )
      const row = db.prepare('SELECT * FROM operational_expenses WHERE id = ?').get(id)
      tryAudit(req, {
        companyId,
        action: 'operational_expense_update',
        entityType: 'operational_expenses',
        entityId: id,
        oldValue: JSON.stringify({
          amount: existing.amount,
          description: existing.description,
          incurred_on: existing.incurred_on
        }),
        newValue: JSON.stringify({
          amount: row.amount,
          description: row.description,
          incurred_on: row.incurred_on
        })
      })
      res.json(mapOperationalExpenseRow(row))
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM operational_expenses WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Expense not found' })
      if (String(existing.status) !== 'draft') {
        return res.status(400).json({ error: 'Only draft expenses can be deleted' })
      }
      tryAudit(req, {
        companyId: existing.company_id,
        action: 'operational_expense_delete',
        entityType: 'operational_expenses',
        entityId: id,
        oldValue: JSON.stringify({
          status: existing.status,
          amount: existing.amount,
          description: existing.description
        })
      })
      db.prepare('DELETE FROM operational_expenses WHERE id = ?').run(id)
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.post('/operational-expenses/:id/approve', canApprove, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM operational_expenses WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Expense not found' })
      if (String(existing.status) !== 'draft') {
        return res.status(400).json({ error: 'Only draft expenses can be approved' })
      }
      const err = blockSelfApproval(req, existing)
      if (err) return res.status(err.status).json({ error: err.error })
      const now = new Date().toISOString()
      db.prepare(
        `UPDATE operational_expenses SET status = 'approved', approved_by = ?, approved_at = ?,
         rejected_reason = NULL, updated_at = ? WHERE id = ?`
      ).run(req.userId, now, now, id)
      const row = db.prepare('SELECT * FROM operational_expenses WHERE id = ?').get(id)
      tryAudit(req, {
        companyId: existing.company_id,
        action: 'operational_expense_approve',
        entityType: 'operational_expenses',
        entityId: id,
        oldValue: JSON.stringify({ status: existing.status }),
        newValue: JSON.stringify({ status: row.status, approved_by: row.approved_by })
      })
      res.json(mapOperationalExpenseRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.post('/operational-expenses/:id/reject', canApprove, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM operational_expenses WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Expense not found' })
      if (String(existing.status) !== 'draft') {
        return res.status(400).json({ error: 'Only draft expenses can be rejected' })
      }
      const reason = String(req.body?.rejected_reason || req.body?.reason || '').trim()
      if (!reason) return res.status(400).json({ error: 'rejected_reason is required' })
      const now = new Date().toISOString()
      db.prepare(
        `UPDATE operational_expenses SET status = 'rejected', rejected_reason = ?, approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?`
      ).run(reason, req.userId, now, now, id)
      const row = db.prepare('SELECT * FROM operational_expenses WHERE id = ?').get(id)
      tryAudit(req, {
        companyId: existing.company_id,
        action: 'operational_expense_reject',
        entityType: 'operational_expenses',
        entityId: id,
        oldValue: JSON.stringify({ status: existing.status }),
        newValue: JSON.stringify({ status: 'rejected', rejected_reason: reason })
      })
      res.json(mapOperationalExpenseRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.post('/operational-expenses/:id/mark-paid', canApprove, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM operational_expenses WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Expense not found' })
      if (String(existing.status) !== 'approved') {
        return res.status(400).json({ error: 'Only approved expenses can be marked paid' })
      }
      const paidOn = String(req.body?.paid_on || '').trim().slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) {
        return res.status(400).json({ error: 'paid_on must be YYYY-MM-DD' })
      }
      const now = new Date().toISOString()
      const pm =
        req.body?.payment_method != null
          ? String(req.body.payment_method).trim() || existing.payment_method
          : existing.payment_method
      db.prepare(
        `UPDATE operational_expenses SET status = 'paid', paid_on = ?, payment_method = ?, updated_at = ? WHERE id = ?`
      ).run(paidOn, pm, now, id)
      const row = db.prepare('SELECT * FROM operational_expenses WHERE id = ?').get(id)
      tryAudit(req, {
        companyId: existing.company_id,
        action: 'operational_expense_mark_paid',
        entityType: 'operational_expenses',
        entityId: id,
        oldValue: JSON.stringify({ status: existing.status, paid_on: existing.paid_on }),
        newValue: JSON.stringify({ status: 'paid', paid_on: paidOn, payment_method: pm })
      })
      res.json(mapOperationalExpenseRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.post('/operational-expenses/:id/void', canApprove, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM operational_expenses WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Expense not found' })
      const st = String(existing.status)
      if (st !== 'approved' && st !== 'paid') {
        return res.status(400).json({ error: 'Only approved or paid expenses can be voided' })
      }
      const voidReason = String(req.body?.void_reason || '').trim()
      if (!voidReason) return res.status(400).json({ error: 'void_reason is required' })
      const now = new Date().toISOString()
      db.prepare(
        `UPDATE operational_expenses SET status = 'void', void_reason = ?, updated_at = ? WHERE id = ?`
      ).run(voidReason, now, id)
      const row = db.prepare('SELECT * FROM operational_expenses WHERE id = ?').get(id)
      tryAudit(req, {
        companyId: existing.company_id,
        action: 'operational_expense_void',
        entityType: 'operational_expenses',
        entityId: id,
        oldValue: JSON.stringify({ status: existing.status, amount: existing.amount }),
        newValue: JSON.stringify({ status: 'void', void_reason: voidReason })
      })
      res.json(mapOperationalExpenseRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  return r
}
