/**
 * Single-row payroll metrics aligned with Payroll.jsx / Company Payroll List PDF (18 columns).
 * Shared by client payslip PDFs and server emailed payslip PDFs.
 *
 * Lives under /shared so Electron packaging includes it (src/** is excluded from asar).
 * Rounding mirrors `payrollCalc.js` without importing it (Node scripts avoid Vite-only import graph).
 */

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

const roundNetPay = (n) => {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(round2(x))
}

/** NSSF: nearest whole KES (displayed with .00 in PDFs). */
const roundNSSFAmount = (n) => {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(round2(x))
}

const money = (n) => {
  const num = Number(n || 0)
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const moneyNet = (n) => {
  const v = roundNetPay(n)
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const moneyWhole = (n) => {
  const v = roundNSSFAmount(n)
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Same headers as Payroll.jsx thead (exact strings). */
export const PAYROLL_LIST_TABLE_HEADERS = [
  'STAFF NO.',
  'NAME',
  'BASIC PAY',
  'HSE ALLOW',
  'SUN/HOLIDAY',
  'ABSENCE',
  'OTHER EARNINGS',
  'TOTAL EARN.',
  'P.A.Y.E',
  'N.S.S.F',
  'S.H.I.F',
  'SHOPPING',
  'ADVANC',
  'HOUSING',
  'OTHER DED',
  'PENSION',
  'TOTAL DED.',
  'NET PAY'
]

/** Prefer a saved numeric on the payroll run (including 0); only use fallback when missing or invalid. */
export const pickPayrollRunNumber = (run, key, fallback) => {
  const v = run[key]
  if (v != null && v !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return fallback()
}

export const calcHousingAllowance = (basicSalary, settings) => {
  const basic = Number(basicSalary || 0)
  const raw = Number(settings?.housing_allowance || 0)
  const t = settings?.housing_allowance_type || 'fixed'
  const standard = Number(settings?.standard_allowance || 0)

  if (t === 'percentage') {
    return (basic * raw) / 100
  }
  if (t === 'percentage_gross') {
    const percentageDecimal = raw / 100
    if (percentageDecimal >= 1) {
      return 0
    }
    const gross = (basic + standard) / (1 - percentageDecimal)
    return gross * percentageDecimal
  }
  return raw
}

/**
 * @param {object} run — payroll run row (same shape as Payroll preview / DB)
 * @param {object} emp — employee
 * @param {object} [settings] — standard_allowance, housing_allowance, housing_allowance_type
 * @param {object} [deduction] — optional employee_deductions row (shopping/advance fallback)
 */
export function getPayrollListRowMetrics(run, emp, settings = {}, deduction = {}) {
  const staffNo =
    emp?.employee_id || emp?.staff_no || run?.staff_no || run?.employee_number || ''
  /** Payroll line rows often carry `name`; keep slips/PDF aligned when emp lookup is delayed. */
  const name = emp?.name || run?.name || ''

  const basic = Number(run.basic_salary || 0)
  const hse = pickPayrollRunNumber(run, 'housing_allowance', () =>
    calcHousingAllowance(basic, settings)
  )
  const sday = Math.max(0, Number(run.holiday_pay || 0))
  const absenceDeduction = Number(run.absence_deduction || 0)
  const absence = -absenceDeduction
  const standardPart = pickPayrollRunNumber(run, 'standard_allowance', () =>
    Number(settings?.standard_allowance || 0)
  )
  const overtimeAdd = Math.max(0, Number(run.overtime_pay || 0))
  const otherEarn = standardPart + overtimeAdd

  const totalEarn = pickPayrollRunNumber(run, 'total_earn', () =>
    basic + hse + sday + otherEarn + absence
  )

  const paye = Number(run.paye || 0)
  const nssf = roundNSSFAmount(run.nssf_employee || 0)
  const shif = Number(run.shif_employee || 0)
  const housingLevy = Number(run.ahl_employee || 0)
  const shopping = Number(
    run.shopping_amount ?? deduction?.shopping_amount ?? 0
  )
  const advance = Number(run.advance_amount ?? deduction?.advance_amount ?? 0)
  const otherDed = Number(run.other_deductions || 0)
  const pension = pickPayrollRunNumber(run, 'pension_employee', () =>
    pickPayrollRunNumber(run, 'pension', () => 0)
  )

  const totalDed =
    paye + nssf + shif + shopping + advance + housingLevy + otherDed + pension
  /**
   * NET PAY always follows the same columns as TOTAL DED. on the payroll grid.
   * `run.paye` is net PAYE (relief already applied in payrollCalc); do not subtract relief again elsewhere.
   */
  const net = roundNetPay(totalEarn - totalDed)

  return {
    staffNo,
    name,
    basic,
    hse,
    sday,
    absence,
    otherEarn,
    totalEarn,
    paye,
    nssf,
    shif,
    shopping,
    advance,
    housingLevy,
    otherDed,
    pension,
    totalDed,
    net
  }
}

/** 18 formatted strings for PDF / CSV cells (money columns formatted). */
export function formatPayrollListRowForPdf(m) {
  return [
    m.staffNo,
    m.name,
    money(m.basic),
    money(m.hse),
    money(m.sday),
    money(m.absence),
    money(m.otherEarn),
    money(m.totalEarn),
    money(m.paye),
    moneyWhole(m.nssf),
    money(m.shif),
    money(m.shopping),
    money(m.advance),
    money(m.housingLevy),
    money(m.otherDed),
    money(m.pension),
    money(m.totalDed),
    moneyNet(m.net)
  ]
}
