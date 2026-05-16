/**
 * Annual leave pool (typically 21 days/year): which approved requests reduce available balance.
 * - annual_balance: days count against the employee's annual leave entitlement.
 * - salary: time off is handled via pay only (e.g. unpaid deduction); does not reduce the 21-day pool.
 */

export const BALANCE_DEDUCTION = {
  ANNUAL_BALANCE: 'annual_balance',
  SALARY: 'salary'
}

/** Default when submitting a new request (before overrides). */
export function getDefaultBalanceDeduction(leaveCode) {
  const c = String(leaveCode || '')
    .toUpperCase()
    .trim()
  if (c === 'UNPAID') return BALANCE_DEDUCTION.SALARY
  if (c === 'ANNUAL') return BALANCE_DEDUCTION.ANNUAL_BALANCE
  return BALANCE_DEDUCTION.SALARY
}

/** Whether this approved request consumes days from the shared annual leave balance. */
export function countsAgainstAnnualBalance(req) {
  if (!req || String(req.status || '').toLowerCase() !== 'approved') return false
  const t = String(req.leave_type || '')
    .toUpperCase()
    .trim()
  const bd = String(req.balance_deduction || '')
    .toLowerCase()
    .trim()
  if (bd === BALANCE_DEDUCTION.SALARY) return false
  if (bd === BALANCE_DEDUCTION.ANNUAL_BALANCE) {
    return t === 'ANNUAL' || t === 'UNPAID'
  }
  // Legacy rows (no column): only ANNUAL reduced the pool
  if (!req.balance_deduction) return t === 'ANNUAL'
  return false
}

export function normalizeBalanceDeductionInput(raw, leaveCode) {
  const v = String(raw || '')
    .toLowerCase()
    .trim()
  const c = String(leaveCode || '')
    .toUpperCase()
    .trim()
  if (v !== BALANCE_DEDUCTION.ANNUAL_BALANCE && v !== BALANCE_DEDUCTION.SALARY) {
    return getDefaultBalanceDeduction(c)
  }
  if (c !== 'ANNUAL' && c !== 'UNPAID') {
    return BALANCE_DEDUCTION.SALARY
  }
  return v
}
