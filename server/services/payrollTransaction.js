import { randomUUID } from 'crypto'
import { runInTransaction } from '../utils/transactions.js'

const n = (v, d = 0) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : d
}

/**
 * Atomic payroll posting (better-sqlite3). Persists full payroll line for PDF / reports.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} payload
 */
export function postPayrollRun(db, payload) {
  return runInTransaction(db, ({ now }) => {
    const p = payload || {}

    const {
      user_id,
      company_id,
      employee_id,
      period
    } = p

    if (!company_id || !employee_id || !period) {
      throw new Error('company_id, employee_id and period are required')
    }

    const gross = n(p.gross_pay)
    const net = n(p.net_pay)
    if (gross < 0 || net < 0) {
      throw new Error('gross_pay and net_pay must be non-negative')
    }
    const overtimePay = n(p.overtime_pay)
    const holidayPay = n(p.holiday_pay)
    if (overtimePay < 0 || holidayPay < 0) {
      throw new Error('overtime_pay and holiday_pay must be non-negative additions')
    }

    const id = randomUUID()
    db.prepare(
      `INSERT INTO payroll_runs (
        id, company_id, employee_id, period,
        basic_salary, allowances, gross_pay,
        shif_employee, shif_employer, nssf_employee, nssf_employer,
        ahl_employee, ahl_employer, taxable_pay, paye, other_deductions, net_pay,
        overtime_hours, overtime_pay, holiday_pay, absence_deduction,
        housing_allowance, standard_allowance, total_earn, shopping_amount, advance_amount, pension_employee,
        calculated_at, created_at
      ) VALUES (
        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
      )`
    ).run(
      id,
      company_id,
      employee_id,
      period,
      n(p.basic_salary),
      n(p.allowances),
      gross,
      n(p.shif_employee),
      n(p.shif_employer),
      n(p.nssf_employee),
      n(p.nssf_employer),
      n(p.ahl_employee),
      n(p.ahl_employer),
      n(p.taxable_pay),
      n(p.paye),
      n(p.other_deductions),
      net,
      n(p.overtime_hours),
      overtimePay,
      holidayPay,
      n(p.absence_deduction),
      n(p.housing_allowance),
      n(p.standard_allowance),
      n(p.total_earn),
      n(p.shopping_amount),
      n(p.advance_amount),
      n(p.pension_employee),
      now,
      now
    )

    db.prepare(
      `INSERT INTO audit_log (
        id, user_id, company_id, action, entity_type, entity_id, new_value, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      user_id || 'system',
      company_id,
      'payroll_post',
      'payroll_runs',
      id,
      JSON.stringify({ company_id, employee_id, period, gross_pay: gross, net_pay: net }),
      now
    )

    return { ok: true, payroll_run_id: id }
  })
}
