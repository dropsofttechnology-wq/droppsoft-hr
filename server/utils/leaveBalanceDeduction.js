export const BALANCE_DEDUCTION = {
  ANNUAL_BALANCE: 'annual_balance',
  SALARY: 'salary'
}

export function getDefaultBalanceDeduction(leaveCode) {
  const c = String(leaveCode || '')
    .toUpperCase()
    .trim()
  if (c === 'UNPAID') return BALANCE_DEDUCTION.SALARY
  if (c === 'ANNUAL') return BALANCE_DEDUCTION.ANNUAL_BALANCE
  return BALANCE_DEDUCTION.SALARY
}

export function normalizeBalanceDeduction(raw, leaveCode) {
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
  if (!req.balance_deduction) return t === 'ANNUAL'
  return false
}
