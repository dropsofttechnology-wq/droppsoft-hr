import { Router } from 'express'
import { randomUUID } from 'crypto'
import { requireLocalUser } from '../middleware/auth.js'
import { runInTransaction } from '../utils/transactions.js'
import { addMonths, format, parseISO } from 'date-fns'
import { getUserRole } from '../utils/userRole.js'
import { roleHasPermission } from '../utils/rolePermissions.js'
import { mapSalaryAdvanceRow } from '../utils/rowMappers.js'
import {
  installmentPlanMatchesTotal,
  parseInstallmentPlan,
  splitMoneyIntoInstallments
} from '../utils/moneySplit.js'
import { mergeAddAdvanceDeduction } from '../utils/mergeEmployeeDeductionAdvance.js'

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createSalaryAdvanceRoutes(db) {
  const r = Router()
  const auth = requireLocalUser(db)

  function employeeIdForUser(userId) {
    const row = db.prepare('SELECT id FROM employees WHERE user_id = ? LIMIT 1').get(userId)
    return row?.id || null
  }

  function isPeriodClosed(companyId, period) {
    const row = db.prepare('SELECT id FROM period_closures WHERE company_id = ? AND period = ?').get(companyId, period)
    return !!row
  }

  function addMonthsToPeriod(periodYYYYMM, delta) {
    const d = parseISO(`${periodYYYYMM}-01`)
    return format(addMonths(d, delta), 'yyyy-MM')
  }

  function parseInstallmentsFromRepayment(text) {
    const s = String(text || '')
    const m = s.match(/(\d+)\s*(month|months|instal|install|installment|installments)?/i)
    if (m) return Math.min(60, Math.max(1, parseInt(m[1], 10)))
    return null
  }

  function resolveInstallmentCount(row, payload) {
    const customPlan = resolveInstallmentPlan(row, payload)
    if (customPlan.length) return customPlan.length
    if (payload.installment_count != null && payload.installment_count !== '') {
      const n = parseInt(String(payload.installment_count), 10)
      if (Number.isFinite(n)) return Math.min(60, Math.max(1, n))
    }
    if (row.installment_count != null && Number(row.installment_count) >= 1) {
      return Math.min(60, Math.max(1, parseInt(String(row.installment_count), 10)))
    }
    const p = parseInstallmentsFromRepayment(row.repayment_period)
    return p || 1
  }

  function resolveInstallmentPlan(row, payload) {
    const raw =
      payload.installment_plan != null && String(payload.installment_plan).trim() !== ''
        ? String(payload.installment_plan)
        : String(row.installment_plan || '')
    return parseInstallmentPlan(raw)
  }

  function buildInstallmentSchedule(row) {
    const payload = {}
    const n = resolveInstallmentCount(row, payload)
    const startPeriod = resolveStartPeriod(row, payload)
    const amount = Number(row.amount) || 0
    const customPlan = resolveInstallmentPlan(row, payload)
    const slices = customPlan.length ? customPlan : splitMoneyIntoInstallments(amount, n)
    if (customPlan.length && !installmentPlanMatchesTotal(customPlan, amount)) {
      throw new Error('Custom installment amounts must add up exactly to the advance amount')
    }
    return slices.map((slice, i) => ({
      idx: i,
      period: addMonthsToPeriod(startPeriod, i),
      amount: Math.round(Number(slice || 0) * 100) / 100
    }))
  }

  /** First payroll month that receives a deduction slice (e.g. advance taken 15 Mar → March payroll). */
  function resolveStartPeriod(row, payload) {
    const fromPayload = payload.for_period != null && String(payload.for_period).trim() !== ''
    if (fromPayload) {
      const fp = String(payload.for_period).trim().slice(0, 7)
      if (/^\d{4}-\d{2}$/.test(fp)) return fp
    }
    if (row.for_period) {
      const fp = String(row.for_period).slice(0, 7)
      if (/^\d{4}-\d{2}$/.test(fp)) return fp
    }
    const app =
      (payload.application_date != null && String(payload.application_date).trim() !== ''
        ? String(payload.application_date).trim()
        : null) || row.application_date
    if (app && String(app).length >= 7) {
      const d = String(app).slice(0, 10)
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d.slice(0, 7)
    }
    return format(new Date(), 'yyyy-MM')
  }

  function postApprovedAdvanceToPayroll(row) {
    const companyId = row.company_id
    const employeeId = row.employee_id
    const amount = Number(row.amount) || 0
    if (amount <= 0) return

    const payload = {}
    const n = resolveInstallmentCount(row, payload)
    const startPeriod = resolveStartPeriod(row, payload)
    const currentPeriod = format(new Date(), 'yyyy-MM')
    if (startPeriod > currentPeriod) {
      throw new Error('First deduction month cannot be in the future')
    }

    const customPlan = resolveInstallmentPlan(row, payload)
    const slices = customPlan.length ? customPlan : splitMoneyIntoInstallments(amount, n)
    if (customPlan.length && !installmentPlanMatchesTotal(customPlan, amount)) {
      throw new Error('Custom installment amounts must add up exactly to the advance amount')
    }
    const periodsToCheck = slices.map((_, i) => addMonthsToPeriod(startPeriod, i))
    for (const p of periodsToCheck) {
      if (isPeriodClosed(companyId, p)) {
        throw new Error(
          `Payroll period ${p} is closed. Open it in Period closure or choose a different first month / fewer installments.`
        )
      }
    }

    const ref = `Salary advance ${row.id.slice(0, 8)}…`
    slices.forEach((slice, i) => {
      const period = addMonthsToPeriod(startPeriod, i)
      const noteLine = `${ref}: instalment ${i + 1}/${n} (${period})`
      mergeAddAdvanceDeduction(db, {
        companyId,
        employeeId,
        period,
        addAdvance: slice,
        noteLine
      })
    })
  }

  /** Undo payroll deductions posted for this approved advance (same schedule as post). */
  function reverseApprovedAdvanceFromPayroll(row) {
    const companyId = row.company_id
    const employeeId = row.employee_id
    const amount = Number(row.amount) || 0
    if (amount <= 0) return
    const payload = {}
    const n = resolveInstallmentCount(row, payload)
    const startPeriod = resolveStartPeriod(row, payload)
    const customPlan = resolveInstallmentPlan(row, payload)
    const slices = customPlan.length ? customPlan : splitMoneyIntoInstallments(amount, n)
    const idFrag = String(row.id).slice(0, 8)
    const now = new Date().toISOString()

    slices.forEach((slice, i) => {
      const period = addMonthsToPeriod(startPeriod, i)
      if (isPeriodClosed(companyId, period)) return
      const existing = db
        .prepare('SELECT * FROM employee_deductions WHERE company_id = ? AND employee_id = ? AND period = ?')
        .get(companyId, employeeId, period)
      if (!existing) return
      const prevAdv = Number(existing.advance_amount) || 0
      const sub = Math.round(Number(slice) * 100) / 100
      const newAdv = Math.max(0, Math.round((prevAdv - sub) * 100) / 100)
      const notes = String(existing.notes || '')
        .split('\n')
        .filter((line) => !line.includes(idFrag))
        .join('\n')
        .trim()
      db.prepare(
        'UPDATE employee_deductions SET advance_amount = ?, notes = ?, updated_at = ? WHERE id = ?'
      ).run(newAdv, notes, now, existing.id)
    })
  }

  function repostApprovedAdvanceOpenPeriodsOnly(previousRow, nextRow) {
    const companyId = nextRow.company_id
    const employeeId = nextRow.employee_id
    const oldSchedule = buildInstallmentSchedule(previousRow)
    const oldClosed = oldSchedule.filter((item) => isPeriodClosed(companyId, item.period))
    const oldOpen = oldSchedule.filter((item) => !isPeriodClosed(companyId, item.period))
    const paidClosedTotal = oldClosed.reduce((sum, item) => sum + item.amount, 0)
    const nextAmount = Math.round((Number(nextRow.amount) || 0) * 100) / 100
    const remaining = Math.round((nextAmount - paidClosedTotal) * 100) / 100
    if (remaining < 0) {
      throw new Error(
        `New advance amount is lower than already posted closed installments (${paidClosedTotal.toFixed(2)}).`
      )
    }

    oldOpen.forEach((item) => {
      const existing = db
        .prepare('SELECT * FROM employee_deductions WHERE company_id = ? AND employee_id = ? AND period = ?')
        .get(companyId, employeeId, item.period)
      if (!existing) return
      const prevAdv = Number(existing.advance_amount) || 0
      const newAdv = Math.max(0, Math.round((prevAdv - item.amount) * 100) / 100)
      const notes = String(existing.notes || '')
        .split('\n')
        .filter((line) => !line.includes(String(previousRow.id).slice(0, 8)))
        .join('\n')
        .trim()
      db.prepare('UPDATE employee_deductions SET advance_amount = ?, notes = ?, updated_at = ? WHERE id = ?').run(
        newAdv,
        notes,
        new Date().toISOString(),
        existing.id
      )
    })

    if (remaining <= 0) return

    const scheduleHint = buildInstallmentSchedule(nextRow)
    const nextPlan = resolveInstallmentPlan(nextRow, {})
    const nextCount = resolveInstallmentCount(nextRow, {})
    const preferredOpenStart = oldOpen.length ? oldOpen[0].period : resolveStartPeriod(nextRow, {})
    const nowPeriod = format(new Date(), 'yyyy-MM')
    const startPeriod = preferredOpenStart < nowPeriod ? preferredOpenStart : preferredOpenStart
    if (startPeriod > nowPeriod) {
      throw new Error('First deduction month for remaining balance cannot be in the future')
    }

    let openSlices = []
    if (nextPlan.length) {
      const schedulePeriods = scheduleHint.map((x) => x.period)
      const allClosedInHint = scheduleHint.filter((x) => isPeriodClosed(companyId, x.period))
      if (allClosedInHint.length > 0 && nextPlan.length === scheduleHint.length) {
        const closedMismatch = allClosedInHint.some((x) => {
          const oldAtPeriod = oldSchedule.find((o) => o.period === x.period)
          return !oldAtPeriod || Math.round(oldAtPeriod.amount * 100) !== Math.round(x.amount * 100)
        })
        if (closedMismatch) {
          throw new Error('Closed payroll installments cannot be edited. Adjust only the remaining open installments.')
        }
        openSlices = scheduleHint.filter((x) => !isPeriodClosed(companyId, x.period)).map((x) => x.amount)
      } else {
        openSlices = nextPlan
      }
      if (!installmentPlanMatchesTotal(openSlices, remaining)) {
        throw new Error(
          'For approved advances with closed periods, custom installment amounts must equal only the remaining balance.'
        )
      }
      void schedulePeriods
    } else {
      const openCount = Math.max(1, Math.min(60, Number(nextCount) || oldOpen.length || 1))
      openSlices = splitMoneyIntoInstallments(remaining, openCount)
    }

    const periodsToCheck = openSlices.map((_, i) => addMonthsToPeriod(startPeriod, i))
    for (const p of periodsToCheck) {
      if (isPeriodClosed(companyId, p)) {
        throw new Error(
          `Payroll period ${p} is closed. For edits after closure, post remaining installments only in open periods.`
        )
      }
    }

    const ref = `Salary advance ${nextRow.id.slice(0, 8)}…`
    openSlices.forEach((slice, i) => {
      const period = addMonthsToPeriod(startPeriod, i)
      mergeAddAdvanceDeduction(db, {
        companyId,
        employeeId,
        period,
        addAdvance: slice,
        noteLine: `${ref}: instalment ${i + 1}/${openSlices.length} (${period})`
      })
    })
  }

  function payrollFieldsChanged(row, body) {
    const nextAmount = body.amount != null && body.amount !== '' ? Number(body.amount) : Number(row.amount)
    const fp =
      body.for_period != null && String(body.for_period).trim() !== ''
        ? String(body.for_period).trim().slice(0, 7)
        : String(row.for_period || '').slice(0, 7)
    const ad =
      body.application_date != null && String(body.application_date).trim() !== ''
        ? String(body.application_date).trim().slice(0, 10)
        : String(row.application_date || '').slice(0, 10)
    let ic = row.installment_count
    if (body.installment_count != null && body.installment_count !== '') {
      ic = parseInt(String(body.installment_count), 10)
    }
    const planText = body.installment_plan != null ? String(body.installment_plan).trim() : String(row.installment_plan || '')
    const parsedPlan = parseInstallmentPlan(planText)
    return (
      Number(row.amount) !== nextAmount ||
      String(row.for_period || '').slice(0, 7) !== fp ||
      String(row.application_date || '').slice(0, 10) !== ad ||
      Number(row.installment_count) !== Number(ic) ||
      String(row.installment_plan || '').trim() !== planText ||
      (parsedPlan.length > 0 && !installmentPlanMatchesTotal(parsedPlan, nextAmount))
    )
  }

  r.get('/requests', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      const { company_id, status, employee_id } = req.query
      const companyId = String(company_id || '')
      if (!companyId) return res.status(400).json({ error: 'company_id is required' })

      let q = `SELECT sar.*, su.name AS approver_name
               FROM salary_advance_requests sar
               LEFT JOIN sys_users su ON sar.approved_by = su.id
               WHERE sar.company_id = ?`
      const params = [companyId]
      if (status) {
        q += ' AND sar.status = ?'
        params.push(String(status))
      }
      if (employee_id) {
        q += ' AND sar.employee_id = ?'
        params.push(String(employee_id))
      }
      if (role === 'employee') {
        const eid = employeeIdForUser(req.userId)
        if (!eid) return res.json([])
        q += ' AND sar.employee_id = ?'
        params.push(eid)
      }
      q += ' ORDER BY sar.created_at DESC'
      const rows = db.prepare(q).all(...params)
      res.json(rows.map(mapSalaryAdvanceRow))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/requests/:id', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      const row = db
        .prepare(
          `SELECT sar.*, su.name AS approver_name
           FROM salary_advance_requests sar
           LEFT JOIN sys_users su ON sar.approved_by = su.id
           WHERE sar.id = ?`
        )
        .get(req.params.id)
      if (!row) return res.status(404).json({ error: 'Not found' })
      if (role === 'employee') {
        const eid = employeeIdForUser(req.userId)
        if (!eid || row.employee_id !== eid) return res.status(403).json({ error: 'Forbidden' })
      }
      res.json(mapSalaryAdvanceRow(row))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/requests', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      const payload = req.body || {}
      const companyId = String(payload.company_id || '')
      let employeeId = String(payload.employee_id || '')
      const amount = Number.parseFloat(String(payload.amount ?? ''))
      if (!companyId || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'company_id and a positive amount are required' })
      }
      if (role === 'employee') {
        const eid = employeeIdForUser(req.userId)
        if (!eid) return res.status(403).json({ error: 'No employee profile linked to this account' })
        employeeId = eid
      }
      if (!employeeId) return res.status(400).json({ error: 'employee_id is required' })

      const currentPeriod = format(new Date(), 'yyyy-MM')
      let forPeriod = ''
      if (payload.for_period != null && String(payload.for_period).trim() !== '') {
        if (!roleHasPermission(db, role, 'salary_advance_management')) {
          return res.status(403).json({ error: 'Only managers and admins can set payroll month for an advance' })
        }
        const fp = String(payload.for_period).trim().slice(0, 7)
        if (!/^\d{4}-\d{2}$/.test(fp)) {
          return res.status(400).json({ error: 'for_period must be yyyy-MM' })
        }
        if (fp > currentPeriod) {
          return res.status(400).json({ error: 'Payroll month cannot be in the future' })
        }
        forPeriod = fp
      }

      let applicationDate = ''
      if (payload.application_date != null && String(payload.application_date).trim() !== '') {
        const ad = String(payload.application_date).trim().slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ad)) {
          return res.status(400).json({ error: 'application_date must be yyyy-MM-dd' })
        }
        applicationDate = ad
      }

      let installmentCount = null
      if (payload.installment_count != null && payload.installment_count !== '') {
        if (!roleHasPermission(db, role, 'salary_advance_management')) {
          return res.status(403).json({ error: 'Only managers and admins can set installment count' })
        }
        const n = parseInt(String(payload.installment_count), 10)
        if (!Number.isFinite(n) || n < 1 || n > 60) {
          return res.status(400).json({ error: 'installment_count must be between 1 and 60' })
        }
        installmentCount = n
      }

      let installmentPlan = null
      if (payload.installment_plan != null && String(payload.installment_plan).trim() !== '') {
        const parsed = parseInstallmentPlan(payload.installment_plan)
        if (!parsed.length || parsed.length > 60) {
          return res.status(400).json({ error: 'installment_plan must include 1 to 60 positive amounts' })
        }
        if (!installmentPlanMatchesTotal(parsed, amount)) {
          return res
            .status(400)
            .json({ error: 'Custom installment amounts must add up exactly to the advance amount' })
        }
        installmentPlan = parsed.join(',')
        installmentCount = parsed.length
      }

      const emp = db.prepare('SELECT id, company_id FROM employees WHERE id = ?').get(employeeId)
      if (!emp || emp.company_id !== companyId) {
        return res.status(400).json({ error: 'Employee not found for this company' })
      }

      const now = new Date().toISOString()
      const id = randomUUID()
      db.prepare(
        `INSERT INTO salary_advance_requests (
          id, company_id, employee_id, amount, reason, repayment_period, for_period, application_date, installment_count, status,
          installment_plan, requested_at, requested_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`
      ).run(
        id,
        companyId,
        employeeId,
        amount,
        String(payload.reason || 'For personal reason'),
        String(payload.repayment_period || ''),
        forPeriod || null,
        applicationDate || null,
        installmentCount ?? null,
        installmentPlan,
        now,
        req.userId,
        now,
        now
      )
      const row = db
        .prepare(
          `SELECT sar.*, su.name AS approver_name
           FROM salary_advance_requests sar
           LEFT JOIN sys_users su ON sar.approved_by = su.id
           WHERE sar.id = ?`
        )
        .get(id)
      res.status(201).json(mapSalaryAdvanceRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.post('/requests/:id/approve', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      if (!roleHasPermission(db, role, 'salary_advance_approval')) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      const requestId = req.params.id
      const body = req.body || {}
      const decision = String(body.decision || 'approved').toLowerCase()
      if (!['approved', 'rejected'].includes(decision)) {
        return res.status(400).json({ error: 'decision must be approved or rejected' })
      }
      const now = new Date().toISOString()

      const result = runInTransaction(db, () => {
        let row = db.prepare('SELECT * FROM salary_advance_requests WHERE id = ?').get(requestId)
        if (!row) throw new Error('Request not found')
        if (row.status !== 'pending') throw new Error(`Request is already ${row.status}`)
        if (row.requested_by && String(row.requested_by) === String(req.userId)) {
          throw new Error('Maker-checker rule: the requester cannot approve/reject their own salary advance request.')
        }
        if (!row.requested_by) {
          const emp = db.prepare('SELECT user_id FROM employees WHERE id = ?').get(row.employee_id)
          if (emp?.user_id && String(emp.user_id) === String(req.userId)) {
            throw new Error('Maker-checker rule: the requester cannot approve/reject their own salary advance request.')
          }
        }

        if (decision === 'approved') {
          let forPeriod = row.for_period
          let applicationDate = row.application_date
          let installmentCount = row.installment_count
          let installmentPlan = row.installment_plan

          if (body.for_period != null && String(body.for_period).trim() !== '') {
            const fp = String(body.for_period).trim().slice(0, 7)
            if (!/^\d{4}-\d{2}$/.test(fp)) throw new Error('for_period must be yyyy-MM')
            forPeriod = fp
          }
          if (body.application_date != null && String(body.application_date).trim() !== '') {
            const ad = String(body.application_date).trim().slice(0, 10)
            if (!/^\d{4}-\d{2}-\d{2}$/.test(ad)) throw new Error('application_date must be yyyy-MM-dd')
            applicationDate = ad
          }
          if (body.installment_count != null && body.installment_count !== '') {
            const n = parseInt(String(body.installment_count), 10)
            if (!Number.isFinite(n) || n < 1 || n > 60) throw new Error('installment_count must be between 1 and 60')
            installmentCount = n
            installmentPlan = null
          }
          if (body.installment_plan != null) {
            const rawPlan = String(body.installment_plan || '').trim()
            if (!rawPlan) {
              installmentPlan = null
            } else {
              const parsed = parseInstallmentPlan(rawPlan)
              if (!parsed.length || parsed.length > 60) {
                throw new Error('installment_plan must include 1 to 60 positive amounts')
              }
              if (!installmentPlanMatchesTotal(parsed, row.amount)) {
                throw new Error('Custom installment amounts must add up exactly to the advance amount')
              }
              installmentPlan = parsed.join(',')
              installmentCount = parsed.length
            }
          }

          db.prepare(
            `UPDATE salary_advance_requests
             SET for_period = ?, application_date = ?, installment_count = ?, installment_plan = ?, updated_at = ?
             WHERE id = ?`
          ).run(
            forPeriod || null,
            applicationDate || null,
            installmentCount ?? null,
            installmentPlan || null,
            now,
            requestId
          )

          row = db.prepare('SELECT * FROM salary_advance_requests WHERE id = ?').get(requestId)
          postApprovedAdvanceToPayroll(row)
        }

        db.prepare(
          `UPDATE salary_advance_requests
           SET status = ?, approved_by = ?, approved_at = ?, updated_at = ?
           WHERE id = ?`
        ).run(decision, req.userId, now, now, requestId)

        return db
          .prepare(
            `SELECT sar.*, su.name AS approver_name
             FROM salary_advance_requests sar
             LEFT JOIN sys_users su ON sar.approved_by = su.id
             WHERE sar.id = ?`
          )
          .get(requestId)
      })

      res.json(mapSalaryAdvanceRow(result))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.post('/requests/:id/deactivate', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      if (!roleHasPermission(db, role, 'salary_advance_deactivate')) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      const requestId = req.params.id
      const now = new Date().toISOString()
      const result = runInTransaction(db, () => {
        const row = db.prepare('SELECT * FROM salary_advance_requests WHERE id = ?').get(requestId)
        if (!row) throw new Error('Not found')
        if (row.status !== 'approved') {
          throw new Error('Only approved advances can be deactivated')
        }
        reverseApprovedAdvanceFromPayroll(row)
        db.prepare(
          `UPDATE salary_advance_requests SET status = 'voided', updated_at = ? WHERE id = ?`
        ).run(now, requestId)
        db.prepare(
          `INSERT INTO audit_log (
            id, user_id, company_id, action, entity_type, entity_id, old_value, new_value, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          randomUUID(),
          req.userId,
          row.company_id,
          'salary_advance_deactivate',
          'salary_advance_requests',
          requestId,
          JSON.stringify({ status: row.status }),
          JSON.stringify({ status: 'voided' }),
          now
        )
        return db
          .prepare(
            `SELECT sar.*, su.name AS approver_name
             FROM salary_advance_requests sar
             LEFT JOIN sys_users su ON sar.approved_by = su.id
             WHERE sar.id = ?`
          )
          .get(requestId)
      })
      res.json(mapSalaryAdvanceRow(result))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.patch('/requests/:id', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      if (!roleHasPermission(db, role, 'salary_advance_management')) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      const requestId = req.params.id
      const body = req.body || {}
      const now = new Date().toISOString()

      const row = db.prepare('SELECT * FROM salary_advance_requests WHERE id = ?').get(requestId)
      if (!row) return res.status(404).json({ error: 'Not found' })
      if (row.status === 'voided') {
        return res.status(400).json({ error: 'Voided advances cannot be edited' })
      }

      const result = runInTransaction(db, () => {
        const shouldRepostApproved = row.status === 'approved' && payrollFieldsChanged(row, body)
        if (shouldRepostApproved) reverseApprovedAdvanceFromPayroll(row)

        let amount = Number(row.amount)
        if (body.amount != null && body.amount !== '') {
          const a = Number.parseFloat(String(body.amount))
          if (!Number.isFinite(a) || a <= 0) throw new Error('Amount must be a positive number')
          amount = a
        }

        let forPeriod = row.for_period
        if (body.for_period != null && String(body.for_period).trim() !== '') {
          const fp = String(body.for_period).trim().slice(0, 7)
          if (!/^\d{4}-\d{2}$/.test(fp)) throw new Error('for_period must be yyyy-MM')
          const currentPeriod = format(new Date(), 'yyyy-MM')
          if (fp > currentPeriod) throw new Error('Payroll month cannot be in the future')
          forPeriod = fp
        }

        let applicationDate = row.application_date
        if (body.application_date != null && String(body.application_date).trim() !== '') {
          const ad = String(body.application_date).trim().slice(0, 10)
          if (!/^\d{4}-\d{2}-\d{2}$/.test(ad)) throw new Error('application_date must be yyyy-MM-dd')
          applicationDate = ad
        }

        let installmentCount = row.installment_count
        if (body.installment_count != null && body.installment_count !== '') {
          const n = parseInt(String(body.installment_count), 10)
          if (!Number.isFinite(n) || n < 1 || n > 60) throw new Error('installment_count must be between 1 and 60')
          installmentCount = n
        }
        let installmentPlan = row.installment_plan
        if (body.installment_plan != null) {
          const rawPlan = String(body.installment_plan || '').trim()
          if (!rawPlan) {
            installmentPlan = null
          } else {
            const parsed = parseInstallmentPlan(rawPlan)
            if (!parsed.length || parsed.length > 60) throw new Error('installment_plan must include 1 to 60 positive amounts')
            if (!installmentPlanMatchesTotal(parsed, amount)) {
              throw new Error('Custom installment amounts must add up exactly to the advance amount')
            }
            installmentPlan = parsed.join(',')
            installmentCount = parsed.length
          }
        } else if (installmentPlan) {
          const parsedExisting = parseInstallmentPlan(installmentPlan)
          if (parsedExisting.length && !installmentPlanMatchesTotal(parsedExisting, amount)) {
            throw new Error(
              'Amount changed: update custom installment amounts so they add up exactly to the new advance amount'
            )
          }
        }

        const reason = body.reason != null ? String(body.reason) : row.reason || ''
        const repaymentPeriod =
          body.repayment_period != null ? String(body.repayment_period) : row.repayment_period || ''

        let adminFormNotes = row.admin_form_notes ?? ''
        if (body.admin_form_notes !== undefined) {
          adminFormNotes = body.admin_form_notes == null ? '' : String(body.admin_form_notes)
        }

        db.prepare(
          `UPDATE salary_advance_requests
           SET amount = ?, reason = ?, repayment_period = ?, for_period = ?, application_date = ?, installment_count = ?, installment_plan = ?, admin_form_notes = ?, updated_at = ?
           WHERE id = ?`
        ).run(
          amount,
          reason,
          repaymentPeriod,
          forPeriod || null,
          applicationDate || null,
          installmentCount ?? null,
          installmentPlan || null,
          adminFormNotes,
          now,
          requestId
        )

        let updated = db.prepare('SELECT * FROM salary_advance_requests WHERE id = ?').get(requestId)
        if (updated.status === 'approved' && shouldRepostApproved) {
          repostApprovedAdvanceOpenPeriodsOnly(row, updated)
        }

        return db
          .prepare(
            `SELECT sar.*, su.name AS approver_name
             FROM salary_advance_requests sar
             LEFT JOIN sys_users su ON sar.approved_by = su.id
             WHERE sar.id = ?`
          )
          .get(requestId)
      })

      res.json(mapSalaryAdvanceRow(result))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.delete('/requests/:id', auth, (req, res) => {
    try {
      const role = getUserRole(db, req.userId)
      if (!roleHasPermission(db, role, 'salary_advance_management')) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      const row = db.prepare('SELECT * FROM salary_advance_requests WHERE id = ?').get(req.params.id)
      if (!row) return res.status(404).json({ error: 'Not found' })
      if (row.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending requests can be deleted' })
      }
      db.prepare('DELETE FROM salary_advance_requests WHERE id = ?').run(req.params.id)
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  return r
}
