import { randomUUID } from 'crypto'

/**
 * Add to advance_amount for one employee/period; preserve absent_days and shopping_amount.
 * @param {import('better-sqlite3').Database} db
 */
export function mergeAddAdvanceDeduction(db, { companyId, employeeId, period, addAdvance, noteLine }) {
  const add = Math.max(0, Number(addAdvance) || 0)
  if (add <= 0) return
  const now = new Date().toISOString()
  const existing = db
    .prepare('SELECT * FROM employee_deductions WHERE company_id = ? AND employee_id = ? AND period = ?')
    .get(companyId, employeeId, period)

  const prevAdv = existing ? Number(existing.advance_amount) || 0 : 0
  const newAdv = Math.round((prevAdv + add) * 100) / 100
  const absentDays = existing ? Math.max(0, Math.min(30, parseInt(String(existing.absent_days ?? 0), 10) || 0)) : 0
  const shoppingAmount = existing ? Math.max(0, Number(existing.shopping_amount) || 0) : 0
  const prevNotes = existing ? String(existing.notes || '').trim() : ''
  const line = String(noteLine || '').trim()
  const notes = prevNotes && line ? `${prevNotes}\n${line}` : prevNotes || line

  if (existing) {
    db.prepare(
      `UPDATE employee_deductions SET advance_amount = ?, notes = ?, updated_at = ? WHERE id = ?`
    ).run(newAdv, notes, now, existing.id)
  } else {
    const id = randomUUID()
    db.prepare(
      `INSERT INTO employee_deductions (id, company_id, employee_id, period, absent_days, advance_amount, shopping_amount, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, companyId, employeeId, period, absentDays, newAdv, shoppingAmount, notes, now)
  }
}


/**
 * Add to shopping_amount for one employee/period; preserve absent_days and advance_amount.
 * @param {import('better-sqlite3').Database} db
 */
export function mergeAddShoppingDeduction(db, { companyId, employeeId, period, addShopping, noteLine }) {
  const add = Math.max(0, Number(addShopping) || 0)
  if (add <= 0) return
  const now = new Date().toISOString()
  const existing = db
    .prepare('SELECT * FROM employee_deductions WHERE company_id = ? AND employee_id = ? AND period = ?')
    .get(companyId, employeeId, period)

  const prevShop = existing ? Number(existing.shopping_amount) || 0 : 0
  const newShop = Math.round((prevShop + add) * 100) / 100
  const absentDays = existing ? Math.max(0, Math.min(30, parseInt(String(existing.absent_days ?? 0), 10) || 0)) : 0
  const advanceAmount = existing ? Math.max(0, Number(existing.advance_amount) || 0) : 0
  const prevNotes = existing ? String(existing.notes || '').trim() : ''
  const line = String(noteLine || '').trim()
  const notes = prevNotes && line ? `${prevNotes}\n${line}` : prevNotes || line

  if (existing) {
    db.prepare(
      `UPDATE employee_deductions SET shopping_amount = ?, notes = ?, updated_at = ? WHERE id = ?`
    ).run(newShop, notes, now, existing.id)
  } else {
    const id = randomUUID()
    db.prepare(
      `INSERT INTO employee_deductions (id, company_id, employee_id, period, absent_days, advance_amount, shopping_amount, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, companyId, employeeId, period, absentDays, advanceAmount, newShop, notes, now)
  }
}

