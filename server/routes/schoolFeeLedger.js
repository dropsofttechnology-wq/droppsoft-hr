import { Router } from 'express'
import { randomUUID } from 'crypto'
import { requirePermission } from '../middleware/permission-guard.js'
import {
  mapAcademicYearRow,
  mapAcademicTermRow,
  mapStudentRow,
  mapFeeChargeRow,
  mapFeePaymentRow
} from '../utils/rowMappers.js'

const FEE_LEDGER_PERM = 'fee_ledger'

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

function assertRowCompany(req, res, db, existing, notFoundLabel) {
  if (!existing) return null
  const companyId = requireCompanyId(req, res)
  if (!companyId) return null
  if (!companyExists(db, companyId)) {
    res.status(404).json({ error: 'Company not found' })
    return null
  }
  if (String(existing.company_id) !== String(companyId)) {
    res.status(404).json({ error: notFoundLabel })
    return null
  }
  return companyId
}

function assertOwnYear(db, companyId, yearId) {
  const row = db.prepare('SELECT id FROM academic_years WHERE id = ? AND company_id = ?').get(yearId, companyId)
  return !!row
}

function assertOwnStudent(db, companyId, studentId) {
  const row = db.prepare('SELECT id FROM students WHERE id = ? AND company_id = ?').get(studentId, companyId)
  return !!row
}

function assertOwnTerm(db, companyId, termId) {
  const row = db.prepare('SELECT id FROM academic_terms WHERE id = ? AND company_id = ?').get(termId, companyId)
  return !!row
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createSchoolFeeLedgerRoutes(db) {
  const r = Router()
  const can = requirePermission(db, FEE_LEDGER_PERM)

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
      console.error('[school fee_ledger audit]', err.message)
    }
  }

  function roundMoney(n) {
    return Math.round(Number(n || 0) * 100) / 100
  }

  r.get('/fees/reports/academic-years', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const years = db
        .prepare(`SELECT * FROM academic_years WHERE company_id = ? ORDER BY start_date DESC`)
        .all(companyId)
      const termCountStmt = db.prepare(
        `SELECT COUNT(*) AS c FROM academic_terms WHERE company_id = ? AND academic_year_id = ?`
      )
      const chargeStmt = db.prepare(
        `SELECT COUNT(*) AS charge_count,
                COALESCE(SUM(amount), 0) AS charges_total,
                COALESCE(SUM(CASE WHEN status IN ('open','partial') THEN amount ELSE 0 END), 0) AS open_charges_total
         FROM fee_charges WHERE company_id = ? AND academic_year_id = ?`
      )
      const paymentStmt = db.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS s FROM fee_payments
         WHERE company_id = ? AND date(paid_on) >= date(?) AND date(paid_on) <= date(?)`
      )
      const rows = years.map((y) => {
        const tc = termCountStmt.get(companyId, y.id)
        const ch = chargeStmt.get(companyId, y.id)
        let paymentsInPeriod = 0
        if (y.start_date && y.end_date) {
          const pay = paymentStmt.get(companyId, y.start_date, y.end_date)
          paymentsInPeriod = roundMoney(pay?.s)
        }
        return {
          year_id: y.id,
          label: y.label,
          start_date: y.start_date,
          end_date: y.end_date,
          is_active: y.is_active != null ? !!y.is_active : true,
          term_count: Number(tc?.c) || 0,
          charge_count: Number(ch?.charge_count) || 0,
          charges_total: roundMoney(ch?.charges_total),
          open_charges_total: roundMoney(ch?.open_charges_total),
          payments_in_period_total: paymentsInPeriod
        }
      })
      res.json(rows)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/fees/reports/academic-terms', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const yearId = req.query.academic_year_id ? String(req.query.academic_year_id).trim() : ''
      if (yearId && !assertOwnYear(db, companyId, yearId)) {
        return res.status(400).json({ error: 'Invalid academic_year_id' })
      }
      const terms = yearId
        ? db
            .prepare(
              `SELECT * FROM academic_terms WHERE company_id = ? AND academic_year_id = ? ORDER BY start_date`
            )
            .all(companyId, yearId)
        : db.prepare(`SELECT * FROM academic_terms WHERE company_id = ? ORDER BY start_date`).all(companyId)
      const yearLabelStmt = db.prepare('SELECT label FROM academic_years WHERE id = ? AND company_id = ?')
      const chargeStmt = db.prepare(
        `SELECT COUNT(*) AS charge_count,
                COALESCE(SUM(amount), 0) AS charges_total,
                COALESCE(SUM(CASE WHEN status IN ('open','partial') THEN amount ELSE 0 END), 0) AS open_charges_total
         FROM fee_charges WHERE company_id = ? AND term_id = ?`
      )
      const paymentStmt = db.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS s FROM fee_payments
         WHERE company_id = ? AND date(paid_on) >= date(?) AND date(paid_on) <= date(?)`
      )
      const rows = terms.map((t) => {
        const yr = yearLabelStmt.get(t.academic_year_id, companyId)
        const ch = chargeStmt.get(companyId, t.id)
        let paymentsInPeriod = 0
        if (t.start_date && t.end_date) {
          const pay = paymentStmt.get(companyId, t.start_date, t.end_date)
          paymentsInPeriod = roundMoney(pay?.s)
        }
        return {
          term_id: t.id,
          academic_year_id: t.academic_year_id,
          academic_year_label: yr?.label || '',
          name: t.name,
          start_date: t.start_date,
          end_date: t.end_date,
          charge_count: Number(ch?.charge_count) || 0,
          charges_total: roundMoney(ch?.charges_total),
          open_charges_total: roundMoney(ch?.open_charges_total),
          payments_in_period_total: paymentsInPeriod
        }
      })
      res.json(rows)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/fees/summary', can, (req, res) => {
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
      const studentRow = db
        .prepare(`SELECT COUNT(*) AS c FROM students WHERE company_id = ? AND status = 'active'`)
        .get(companyId)
      const openCharges = db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) AS s FROM fee_charges WHERE company_id = ? AND status IN ('open','partial')`
        )
        .get(companyId)
      const paidMonth = db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) AS s FROM fee_payments
           WHERE company_id = ? AND strftime('%Y-%m', paid_on) = ?`
        )
        .get(companyId, month)
      res.json({
        company_id: companyId,
        month,
        active_student_count: Number(studentRow?.c) || 0,
        open_charges_total: Math.round(Number(openCharges?.s || 0) * 100) / 100,
        payments_month_total: Math.round(Number(paidMonth?.s || 0) * 100) / 100
      })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // --- Academic years ---
  r.get('/fees/academic-years', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const rows = db
        .prepare(`SELECT * FROM academic_years WHERE company_id = ? ORDER BY start_date DESC`)
        .all(companyId)
      res.json(rows.map(mapAcademicYearRow))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/fees/academic-years', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const label = String(req.body?.label || '').trim()
      if (!label) return res.status(400).json({ error: 'label is required' })
      const start = String(req.body?.start_date || '').trim().slice(0, 10)
      const end = String(req.body?.end_date || '').trim().slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        return res.status(400).json({ error: 'start_date and end_date must be YYYY-MM-DD' })
      }
      const now = new Date().toISOString()
      const id = randomUUID()
      const isActive = req.body?.is_active != null ? (req.body.is_active ? 1 : 0) : 1
      db.prepare(
        `INSERT INTO academic_years (id, company_id, label, start_date, end_date, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, companyId, label, start, end, isActive, now, now)
      const row = db.prepare('SELECT * FROM academic_years WHERE id = ?').get(id)
      tryAudit(req, {
        companyId,
        action: 'academic_year_create',
        entityType: 'academic_years',
        entityId: id,
        newValue: JSON.stringify(mapAcademicYearRow(row))
      })
      res.status(201).json(mapAcademicYearRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.patch('/fees/academic-years/:id', can, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM academic_years WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Academic year not found' })
      const companyId = assertRowCompany(req, res, db, existing, 'Academic year not found')
      if (!companyId) return
      const label =
        req.body?.label != null ? String(req.body.label).trim() : String(existing.label || '').trim()
      if (!label) return res.status(400).json({ error: 'label is required' })
      let start = existing.start_date
      let end = existing.end_date
      if (req.body?.start_date != null) {
        start = String(req.body.start_date).trim().slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return res.status(400).json({ error: 'start_date must be YYYY-MM-DD' })
      }
      if (req.body?.end_date != null) {
        end = String(req.body.end_date).trim().slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return res.status(400).json({ error: 'end_date must be YYYY-MM-DD' })
      }
      const isActive =
        req.body?.is_active != null ? (req.body.is_active ? 1 : 0) : existing.is_active ? 1 : 0
      const now = new Date().toISOString()
      db.prepare(
        `UPDATE academic_years SET label = ?, start_date = ?, end_date = ?, is_active = ?, updated_at = ? WHERE id = ?`
      ).run(label, start, end, isActive, now, id)
      const row = db.prepare('SELECT * FROM academic_years WHERE id = ?').get(id)
      tryAudit(req, {
        companyId,
        action: 'academic_year_update',
        entityType: 'academic_years',
        entityId: id,
        oldValue: JSON.stringify(mapAcademicYearRow(existing)),
        newValue: JSON.stringify(mapAcademicYearRow(row))
      })
      res.json(mapAcademicYearRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.delete('/fees/academic-years/:id', can, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM academic_years WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Academic year not found' })
      if (!assertRowCompany(req, res, db, existing, 'Academic year not found')) return
      const t = db.prepare('SELECT id FROM academic_terms WHERE academic_year_id = ? LIMIT 1').get(id)
      if (t) return res.status(400).json({ error: 'Delete terms under this year first.' })
      const c = db.prepare('SELECT id FROM fee_charges WHERE academic_year_id = ? LIMIT 1').get(id)
      if (c) return res.status(400).json({ error: 'Year is referenced by fee charges.' })
      tryAudit(req, {
        companyId: String(existing.company_id),
        action: 'academic_year_delete',
        entityType: 'academic_years',
        entityId: id,
        oldValue: JSON.stringify(mapAcademicYearRow(existing))
      })
      db.prepare('DELETE FROM academic_years WHERE id = ?').run(id)
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  // --- Academic terms ---
  r.get('/fees/academic-terms', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const yearId = req.query.academic_year_id ? String(req.query.academic_year_id).trim() : ''
      let rows
      if (yearId) {
        if (!assertOwnYear(db, companyId, yearId)) return res.status(400).json({ error: 'Invalid academic_year_id' })
        rows = db
          .prepare(
            `SELECT * FROM academic_terms WHERE company_id = ? AND academic_year_id = ? ORDER BY start_date`
          )
          .all(companyId, yearId)
      } else {
        rows = db
          .prepare(`SELECT * FROM academic_terms WHERE company_id = ? ORDER BY start_date`)
          .all(companyId)
      }
      res.json(rows.map(mapAcademicTermRow))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/fees/academic-terms', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const academicYearId = String(req.body?.academic_year_id || '').trim()
      if (!academicYearId || !assertOwnYear(db, companyId, academicYearId)) {
        return res.status(400).json({ error: 'Valid academic_year_id is required' })
      }
      const name = String(req.body?.name || '').trim()
      if (!name) return res.status(400).json({ error: 'name is required' })
      const start = String(req.body?.start_date || '').trim().slice(0, 10)
      const end = String(req.body?.end_date || '').trim().slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        return res.status(400).json({ error: 'start_date and end_date must be YYYY-MM-DD' })
      }
      const now = new Date().toISOString()
      const id = randomUUID()
      db.prepare(
        `INSERT INTO academic_terms (id, company_id, academic_year_id, name, start_date, end_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, companyId, academicYearId, name, start, end, now, now)
      const row = db.prepare('SELECT * FROM academic_terms WHERE id = ?').get(id)
      tryAudit(req, {
        companyId,
        action: 'academic_term_create',
        entityType: 'academic_terms',
        entityId: id,
        newValue: JSON.stringify(mapAcademicTermRow(row))
      })
      res.status(201).json(mapAcademicTermRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.patch('/fees/academic-terms/:id', can, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM academic_terms WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Term not found' })
      const companyId = assertRowCompany(req, res, db, existing, 'Term not found')
      if (!companyId) return
      let academicYearId = existing.academic_year_id
      if (req.body?.academic_year_id != null) {
        academicYearId = String(req.body.academic_year_id).trim()
        if (!assertOwnYear(db, companyId, academicYearId)) {
          return res.status(400).json({ error: 'Invalid academic_year_id' })
        }
      }
      const name =
        req.body?.name != null ? String(req.body.name).trim() : String(existing.name || '').trim()
      if (!name) return res.status(400).json({ error: 'name is required' })
      let start = existing.start_date
      let end = existing.end_date
      if (req.body?.start_date != null) {
        start = String(req.body.start_date).trim().slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return res.status(400).json({ error: 'start_date must be YYYY-MM-DD' })
      }
      if (req.body?.end_date != null) {
        end = String(req.body.end_date).trim().slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return res.status(400).json({ error: 'end_date must be YYYY-MM-DD' })
      }
      const now = new Date().toISOString()
      db.prepare(
        `UPDATE academic_terms SET academic_year_id = ?, name = ?, start_date = ?, end_date = ?, updated_at = ? WHERE id = ?`
      ).run(academicYearId, name, start, end, now, id)
      const row = db.prepare('SELECT * FROM academic_terms WHERE id = ?').get(id)
      tryAudit(req, {
        companyId,
        action: 'academic_term_update',
        entityType: 'academic_terms',
        entityId: id,
        oldValue: JSON.stringify(mapAcademicTermRow(existing)),
        newValue: JSON.stringify(mapAcademicTermRow(row))
      })
      res.json(mapAcademicTermRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.delete('/fees/academic-terms/:id', can, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM academic_terms WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Term not found' })
      if (!assertRowCompany(req, res, db, existing, 'Term not found')) return
      const c = db.prepare('SELECT id FROM fee_charges WHERE term_id = ? LIMIT 1').get(id)
      if (c) return res.status(400).json({ error: 'Term is referenced by fee charges.' })
      tryAudit(req, {
        companyId: String(existing.company_id),
        action: 'academic_term_delete',
        entityType: 'academic_terms',
        entityId: id,
        oldValue: JSON.stringify(mapAcademicTermRow(existing))
      })
      db.prepare('DELETE FROM academic_terms WHERE id = ?').run(id)
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  // --- Students ---
  r.get('/fees/students', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const rows = db
        .prepare(`SELECT * FROM students WHERE company_id = ? ORDER BY student_number COLLATE NOCASE`)
        .all(companyId)
      res.json(rows.map(mapStudentRow))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/fees/students', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const studentNumber = String(req.body?.student_number || '').trim()
      const legalName = String(req.body?.legal_name || '').trim()
      if (!studentNumber || !legalName) {
        return res.status(400).json({ error: 'student_number and legal_name are required' })
      }
      const dup = db.prepare('SELECT id FROM students WHERE company_id = ? AND student_number = ?').get(companyId, studentNumber)
      if (dup) return res.status(400).json({ error: 'student_number already exists for this company' })
      const now = new Date().toISOString()
      const id = randomUUID()
      db.prepare(
        `INSERT INTO students (id, company_id, student_number, legal_name, dob, gender, class_label, status, guardian_summary, guardian_email, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        companyId,
        studentNumber,
        legalName,
        String(req.body?.dob || '').trim().slice(0, 10) || null,
        String(req.body?.gender || '').trim() || null,
        String(req.body?.class_label || '').trim() || null,
        String(req.body?.status || 'active').trim() || 'active',
        String(req.body?.guardian_summary || '').trim() || null,
        String(req.body?.guardian_email || '').trim() || null,
        String(req.body?.notes || '').trim() || null,
        now,
        now
      )
      const row = db.prepare('SELECT * FROM students WHERE id = ?').get(id)
      tryAudit(req, {
        companyId,
        action: 'fee_student_create',
        entityType: 'students',
        entityId: id,
        newValue: JSON.stringify(mapStudentRow(row))
      })
      res.status(201).json(mapStudentRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.patch('/fees/students/:id', can, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Student not found' })
      const companyId = assertRowCompany(req, res, db, existing, 'Student not found')
      if (!companyId) return
      let studentNumber = existing.student_number
      if (req.body?.student_number != null) {
        studentNumber = String(req.body.student_number).trim()
        if (!studentNumber) return res.status(400).json({ error: 'student_number is required' })
        const dup = db
          .prepare('SELECT id FROM students WHERE company_id = ? AND student_number = ? AND id != ?')
          .get(companyId, studentNumber, id)
        if (dup) return res.status(400).json({ error: 'student_number already exists for this company' })
      }
      const legalName =
        req.body?.legal_name != null ? String(req.body.legal_name).trim() : String(existing.legal_name || '').trim()
      if (!legalName) return res.status(400).json({ error: 'legal_name is required' })
      const dob = req.body?.dob !== undefined ? String(req.body.dob || '').trim().slice(0, 10) || null : existing.dob
      const gender =
        req.body?.gender !== undefined ? String(req.body.gender || '').trim() || null : existing.gender
      const classLabel =
        req.body?.class_label !== undefined
          ? String(req.body.class_label || '').trim() || null
          : existing.class_label
      const status =
        req.body?.status != null ? String(req.body.status || 'active').trim() : existing.status || 'active'
      const guardianSummary =
        req.body?.guardian_summary !== undefined
          ? String(req.body.guardian_summary || '').trim() || null
          : existing.guardian_summary
      const guardianEmail =
        req.body?.guardian_email !== undefined
          ? String(req.body.guardian_email || '').trim() || null
          : existing.guardian_email
      const notes = req.body?.notes !== undefined ? String(req.body.notes || '').trim() || null : existing.notes
      const now = new Date().toISOString()
      db.prepare(
        `UPDATE students SET student_number = ?, legal_name = ?, dob = ?, gender = ?, class_label = ?, status = ?, guardian_summary = ?, guardian_email = ?, notes = ?, updated_at = ? WHERE id = ?`
      ).run(
        studentNumber,
        legalName,
        dob,
        gender,
        classLabel,
        status,
        guardianSummary,
        guardianEmail,
        notes,
        now,
        id
      )
      const row = db.prepare('SELECT * FROM students WHERE id = ?').get(id)
      tryAudit(req, {
        companyId,
        action: 'fee_student_update',
        entityType: 'students',
        entityId: id,
        oldValue: JSON.stringify(mapStudentRow(existing)),
        newValue: JSON.stringify(mapStudentRow(row))
      })
      res.json(mapStudentRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.delete('/fees/students/:id', can, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Student not found' })
      if (!assertRowCompany(req, res, db, existing, 'Student not found')) return
      const c = db.prepare('SELECT id FROM fee_charges WHERE student_id = ? LIMIT 1').get(id)
      if (c) return res.status(400).json({ error: 'Student has fee charges; remove charges first.' })
      const p = db.prepare('SELECT id FROM fee_payments WHERE student_id = ? LIMIT 1').get(id)
      if (p) return res.status(400).json({ error: 'Student has fee payments; remove payments first.' })
      tryAudit(req, {
        companyId: String(existing.company_id),
        action: 'fee_student_delete',
        entityType: 'students',
        entityId: id,
        oldValue: JSON.stringify(mapStudentRow(existing))
      })
      db.prepare('DELETE FROM students WHERE id = ?').run(id)
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  // --- Fee charges ---
  r.get('/fees/charges', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const studentId = req.query.student_id ? String(req.query.student_id).trim() : ''
      const academicYearId = req.query.academic_year_id ? String(req.query.academic_year_id).trim() : ''
      const termId = req.query.term_id ? String(req.query.term_id).trim() : ''
      if (studentId && !assertOwnStudent(db, companyId, studentId)) {
        return res.status(400).json({ error: 'Invalid student_id' })
      }
      if (academicYearId && !assertOwnYear(db, companyId, academicYearId)) {
        return res.status(400).json({ error: 'Invalid academic_year_id' })
      }
      if (termId && !assertOwnTerm(db, companyId, termId)) {
        return res.status(400).json({ error: 'Invalid term_id' })
      }
      const where = ['company_id = ?']
      const params = [companyId]
      if (studentId) {
        where.push('student_id = ?')
        params.push(studentId)
      }
      if (academicYearId) {
        where.push('academic_year_id = ?')
        params.push(academicYearId)
      }
      if (termId) {
        where.push('term_id = ?')
        params.push(termId)
      }
      const rows = db
        .prepare(`SELECT * FROM fee_charges WHERE ${where.join(' AND ')} ORDER BY due_date DESC`)
        .all(...params)
      res.json(rows.map(mapFeeChargeRow))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/fees/charges', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const studentId = String(req.body?.student_id || '').trim()
      if (!studentId || !assertOwnStudent(db, companyId, studentId)) {
        return res.status(400).json({ error: 'Valid student_id is required' })
      }
      const description = String(req.body?.description || '').trim()
      if (!description) return res.status(400).json({ error: 'description is required' })
      const amount = Number(req.body?.amount)
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amount must be positive' })
      let academicYearId = null
      if (req.body?.academic_year_id != null && String(req.body.academic_year_id).trim()) {
        academicYearId = String(req.body.academic_year_id).trim()
        if (!assertOwnYear(db, companyId, academicYearId)) {
          return res.status(400).json({ error: 'Invalid academic_year_id' })
        }
      }
      let termId = null
      if (req.body?.term_id != null && String(req.body.term_id).trim()) {
        termId = String(req.body.term_id).trim()
        if (!assertOwnTerm(db, companyId, termId)) return res.status(400).json({ error: 'Invalid term_id' })
      }
      const due = String(req.body?.due_date || '').trim().slice(0, 10)
      const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null
      const status = String(req.body?.status || 'open').trim() || 'open'
      const now = new Date().toISOString()
      const id = randomUUID()
      db.prepare(
        `INSERT INTO fee_charges (id, company_id, student_id, academic_year_id, term_id, description, amount, currency, due_date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        companyId,
        studentId,
        academicYearId,
        termId,
        description,
        Math.round(amount * 100) / 100,
        String(req.body?.currency || '').trim(),
        dueDate,
        status,
        now,
        now
      )
      const row = db.prepare('SELECT * FROM fee_charges WHERE id = ?').get(id)
      tryAudit(req, {
        companyId,
        action: 'fee_charge_create',
        entityType: 'fee_charges',
        entityId: id,
        newValue: JSON.stringify(mapFeeChargeRow(row))
      })
      res.status(201).json(mapFeeChargeRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.patch('/fees/charges/:id', can, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM fee_charges WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Charge not found' })
      const companyId = assertRowCompany(req, res, db, existing, 'Charge not found')
      if (!companyId) return
      const description =
        req.body?.description != null
          ? String(req.body.description).trim()
          : String(existing.description || '').trim()
      if (!description) return res.status(400).json({ error: 'description is required' })
      let amount = Number(existing.amount)
      if (req.body?.amount != null) {
        amount = Number(req.body.amount)
        if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amount must be positive' })
      }
      let academicYearId = existing.academic_year_id
      if (req.body?.academic_year_id !== undefined) {
        const raw = String(req.body.academic_year_id || '').trim()
        academicYearId = raw || null
        if (academicYearId && !assertOwnYear(db, companyId, academicYearId)) {
          return res.status(400).json({ error: 'Invalid academic_year_id' })
        }
      }
      let termId = existing.term_id
      if (req.body?.term_id !== undefined) {
        const raw = String(req.body.term_id || '').trim()
        termId = raw || null
        if (termId && !assertOwnTerm(db, companyId, termId)) return res.status(400).json({ error: 'Invalid term_id' })
      }
      let dueDate = existing.due_date
      if (req.body?.due_date !== undefined) {
        const d = String(req.body.due_date || '').trim().slice(0, 10)
        dueDate = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
      }
      const status =
        req.body?.status != null ? String(req.body.status || '').trim() : String(existing.status || 'open')
      const now = new Date().toISOString()
      db.prepare(
        `UPDATE fee_charges SET description = ?, amount = ?, currency = ?, academic_year_id = ?, term_id = ?, due_date = ?, status = ?, updated_at = ? WHERE id = ?`
      ).run(
        description,
        Math.round(amount * 100) / 100,
        req.body?.currency != null ? String(req.body.currency).trim() : existing.currency || '',
        academicYearId,
        termId,
        dueDate,
        status,
        now,
        id
      )
      const row = db.prepare('SELECT * FROM fee_charges WHERE id = ?').get(id)
      tryAudit(req, {
        companyId,
        action: 'fee_charge_update',
        entityType: 'fee_charges',
        entityId: id,
        oldValue: JSON.stringify(mapFeeChargeRow(existing)),
        newValue: JSON.stringify(mapFeeChargeRow(row))
      })
      res.json(mapFeeChargeRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.delete('/fees/charges/:id', can, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM fee_charges WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Charge not found' })
      if (!assertRowCompany(req, res, db, existing, 'Charge not found')) return
      tryAudit(req, {
        companyId: String(existing.company_id),
        action: 'fee_charge_delete',
        entityType: 'fee_charges',
        entityId: id,
        oldValue: JSON.stringify(mapFeeChargeRow(existing))
      })
      db.prepare('DELETE FROM fee_charges WHERE id = ?').run(id)
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  // --- Fee payments ---
  r.get('/fees/payments', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const studentId = req.query.student_id ? String(req.query.student_id).trim() : ''
      const paidFrom = req.query.paid_from ? String(req.query.paid_from).trim().slice(0, 10) : ''
      const paidTo = req.query.paid_to ? String(req.query.paid_to).trim().slice(0, 10) : ''
      if (studentId && !assertOwnStudent(db, companyId, studentId)) {
        return res.status(400).json({ error: 'Invalid student_id' })
      }
      if (paidFrom && !/^\d{4}-\d{2}-\d{2}$/.test(paidFrom)) {
        return res.status(400).json({ error: 'paid_from must be YYYY-MM-DD' })
      }
      if (paidTo && !/^\d{4}-\d{2}-\d{2}$/.test(paidTo)) {
        return res.status(400).json({ error: 'paid_to must be YYYY-MM-DD' })
      }
      const where = ['company_id = ?']
      const params = [companyId]
      if (studentId) {
        where.push('student_id = ?')
        params.push(studentId)
      }
      if (paidFrom) {
        where.push('date(paid_on) >= date(?)')
        params.push(paidFrom)
      }
      if (paidTo) {
        where.push('date(paid_on) <= date(?)')
        params.push(paidTo)
      }
      const rows = db
        .prepare(`SELECT * FROM fee_payments WHERE ${where.join(' AND ')} ORDER BY paid_on DESC`)
        .all(...params)
      res.json(rows.map(mapFeePaymentRow))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/fees/payments', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const studentId = String(req.body?.student_id || '').trim()
      if (!studentId || !assertOwnStudent(db, companyId, studentId)) {
        return res.status(400).json({ error: 'Valid student_id is required' })
      }
      const amount = Number(req.body?.amount)
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amount must be positive' })
      const paidOn = String(req.body?.paid_on || '').trim().slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) {
        return res.status(400).json({ error: 'paid_on must be YYYY-MM-DD' })
      }
      const receiptNumber = String(req.body?.receipt_number || '').trim()
      if (receiptNumber) {
        const dup = db
          .prepare('SELECT id FROM fee_payments WHERE company_id = ? AND receipt_number = ?')
          .get(companyId, receiptNumber)
        if (dup) return res.status(400).json({ error: 'receipt_number already used for this company' })
      }
      const now = new Date().toISOString()
      const id = randomUUID()
      db.prepare(
        `INSERT INTO fee_payments (id, company_id, student_id, amount, currency, paid_on, payment_method, reference, receipt_number, notes, recorded_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        companyId,
        studentId,
        Math.round(amount * 100) / 100,
        String(req.body?.currency || '').trim(),
        paidOn,
        String(req.body?.payment_method || '').trim() || null,
        String(req.body?.reference || '').trim() || null,
        receiptNumber || null,
        String(req.body?.notes || '').trim() || null,
        String(req.body?.recorded_by || req.userId || '').trim() || null,
        now,
        now
      )
      const row = db.prepare('SELECT * FROM fee_payments WHERE id = ?').get(id)
      tryAudit(req, {
        companyId,
        action: 'fee_payment_create',
        entityType: 'fee_payments',
        entityId: id,
        newValue: JSON.stringify(mapFeePaymentRow(row))
      })
      res.status(201).json(mapFeePaymentRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.patch('/fees/payments/:id', can, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM fee_payments WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Payment not found' })
      const companyId = assertRowCompany(req, res, db, existing, 'Payment not found')
      if (!companyId) return
      let studentId = existing.student_id
      if (req.body?.student_id != null) {
        studentId = String(req.body.student_id).trim()
        if (!assertOwnStudent(db, companyId, studentId)) return res.status(400).json({ error: 'Invalid student_id' })
      }
      let amount = Number(existing.amount)
      if (req.body?.amount != null) {
        amount = Number(req.body.amount)
        if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amount must be positive' })
      }
      let paidOn = existing.paid_on
      if (req.body?.paid_on != null) {
        paidOn = String(req.body.paid_on).trim().slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return res.status(400).json({ error: 'paid_on must be YYYY-MM-DD' })
      }
      let receiptNumber = existing.receipt_number
      if (req.body?.receipt_number !== undefined) {
        receiptNumber = String(req.body.receipt_number || '').trim() || null
        if (receiptNumber) {
          const dup = db
            .prepare('SELECT id FROM fee_payments WHERE company_id = ? AND receipt_number = ? AND id != ?')
            .get(companyId, receiptNumber, id)
          if (dup) return res.status(400).json({ error: 'receipt_number already used for this company' })
        }
      }
      const now = new Date().toISOString()
      db.prepare(
        `UPDATE fee_payments SET student_id = ?, amount = ?, currency = ?, paid_on = ?, payment_method = ?, reference = ?, receipt_number = ?, notes = ?, recorded_by = ?, updated_at = ? WHERE id = ?`
      ).run(
        studentId,
        Math.round(amount * 100) / 100,
        req.body?.currency != null ? String(req.body.currency).trim() : existing.currency || '',
        paidOn,
        req.body?.payment_method != null ? String(req.body.payment_method).trim() || null : existing.payment_method,
        req.body?.reference != null ? String(req.body.reference).trim() || null : existing.reference,
        receiptNumber,
        req.body?.notes != null ? String(req.body.notes).trim() || null : existing.notes,
        req.body?.recorded_by != null ? String(req.body.recorded_by).trim() || null : existing.recorded_by,
        now,
        id
      )
      const row = db.prepare('SELECT * FROM fee_payments WHERE id = ?').get(id)
      tryAudit(req, {
        companyId,
        action: 'fee_payment_update',
        entityType: 'fee_payments',
        entityId: id,
        oldValue: JSON.stringify(mapFeePaymentRow(existing)),
        newValue: JSON.stringify(mapFeePaymentRow(row))
      })
      res.json(mapFeePaymentRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.delete('/fees/payments/:id', can, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM fee_payments WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Payment not found' })
      if (!assertRowCompany(req, res, db, existing, 'Payment not found')) return
      tryAudit(req, {
        companyId: String(existing.company_id),
        action: 'fee_payment_delete',
        entityType: 'fee_payments',
        entityId: id,
        oldValue: JSON.stringify(mapFeePaymentRow(existing))
      })
      db.prepare('DELETE FROM fee_payments WHERE id = ?').run(id)
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  return r
}
