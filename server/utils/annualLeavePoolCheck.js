import {
  BALANCE_DEDUCTION,
  countsAgainstAnnualBalance,
  normalizeBalanceDeduction
} from './leaveBalanceDeduction.js'

export function getAnnualLeaveRollover(db, companyId) {
  const r = db
    .prepare(
      'SELECT setting_value FROM settings WHERE company_id = ? AND setting_key = ? LIMIT 1'
    )
    .get(companyId, 'annual_leave_rollover')
  if (!r) return true
  const v = r.setting_value
  return v === 'true' || v === true
}

/**
 * Same rules as client calculateLeaveBalance for ANNUAL: max bookable = cy + ny or cy only.
 * Unused days expire at year-end because usage is counted per calendar year only (no carry-over bucket).
 */
export function getMaxBookableAnnualDays(db, companyId, employeeId, excludeRequestId = null) {
  const emp = db
    .prepare('SELECT contract_start_date, annual_leave_entitlement_days FROM employees WHERE id = ?')
    .get(employeeId)
  // SQLite stores entitlement as `days_allowed` (Appwrite / API use `entitlement_days` on documents only).
  const lt = db
    .prepare(
      `SELECT days_allowed FROM leave_types
       WHERE company_id = ? AND UPPER(COALESCE(leave_code, '')) = 'ANNUAL'
       ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END LIMIT 1`
    )
    .get(companyId)

  let entitlement = 21
  if (lt && lt.days_allowed != null) {
    entitlement = Number(lt.days_allowed)
  }
  const empOverride = emp?.annual_leave_entitlement_days
  if (empOverride != null && empOverride !== '' && Number.isFinite(Number(empOverride))) {
    entitlement = Math.max(0, Number(empOverride))
  }

  const today = new Date()
  const currentYear = today.getFullYear()
  const nextYear = currentYear + 1

  const inCalendarYear = (startDate, y) => {
    const s = String(startDate || '').slice(0, 10)
    return s >= `${y}-01-01` && s <= `${y}-12-31`
  }

  let rows = db
    .prepare(
      `SELECT id, leave_type, balance_deduction, status, days_requested, start_date
       FROM leave_requests
       WHERE employee_id = ? AND company_id = ? AND status = 'approved'`
    )
    .all(employeeId, companyId)

  if (excludeRequestId) {
    rows = rows.filter((r) => r.id !== excludeRequestId)
  }

  let usedCurrent = 0
  let usedNext = 0
  for (const r of rows) {
    if (!countsAgainstAnnualBalance(r)) continue
    const d = Number(r.days_requested) || 0
    if (inCalendarYear(r.start_date, currentYear)) usedCurrent += d
    if (inCalendarYear(r.start_date, nextYear)) usedNext += d
  }

  const rollover = getAnnualLeaveRollover(db, companyId)

  // Match client calculateLeaveBalance when contract_start_date is missing (ignores usedNext for the cap).
  if (!emp?.contract_start_date) {
    return rollover ? entitlement : 0
  }

  // Annual entitlement is a full yearly pool; leave usage is already segmented by year.
  const accrued = entitlement
  const cyAvail = Math.max(0, accrued - usedCurrent)
  const nyAvail = Math.max(0, entitlement - usedNext)
  return rollover ? cyAvail + nyAvail : cyAvail
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function assertAnnualPoolAllowsBooking(
  db,
  { companyId, employeeId, leaveType, balanceDeduction, daysRequested, excludeRequestId }
) {
  const lt = String(leaveType || '').toUpperCase()
  const bd = normalizeBalanceDeduction(balanceDeduction, lt)
  const usesPool =
    (lt === 'ANNUAL' && bd === BALANCE_DEDUCTION.ANNUAL_BALANCE) ||
    (lt === 'UNPAID' && bd === BALANCE_DEDUCTION.ANNUAL_BALANCE)
  if (!usesPool) return

  const dr = Number(daysRequested) || 0
  const max = getMaxBookableAnnualDays(db, companyId, employeeId, excludeRequestId || null)
  if (dr > max + 1e-9) {
    const rollover = getAnnualLeaveRollover(db, companyId)
    throw new Error(
      `Annual leave balance insufficient: ${dr.toFixed(1)} day(s) requested but only ${max.toFixed(1)} available${
        rollover ? '' : ' (this calendar year only; rollover is off)'
      }.`
    )
  }
}
