import { calculateOvertime } from './timesheet'
import {
  eachDayOfInterval,
  endOfMonth,
  isSunday,
  parseISO,
  startOfDay,
  startOfMonth,
  subMonths
} from 'date-fns'

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

/**
 * Calendar day belongs to `period` payroll run (yyyy-MM) for pay-date–split logic.
 * Window: [previous month pay_date…end] ∪ [current month 1…pay_date − 1].
 * Any day in the current month on or after `payDate` is counted in the **next** run’s deduction.
 * @param {Date} d
 * @param {string} period
 * @param {number} payDate
 */
function dayIsInPayrollRunWindow(d, period, payDate = 25) {
  if (!period) return false
  const pd = Math.min(31, Math.max(1, Number(payDate) || 25))
  const curStart = startOfMonth(parseISO(`${period}-01`))
  const prevStart = startOfMonth(subMonths(curStart, 1))
  const curY = curStart.getFullYear()
  const curM = curStart.getMonth()
  const prevY = prevStart.getFullYear()
  const prevM = prevStart.getMonth()
  const d0 = d instanceof Date ? startOfDay(d) : startOfDay(parseISO(String(d).slice(0, 10)))
  if (Number.isNaN(d0.getTime())) return false
  const dn = d0.getDate()
  const y = d0.getFullYear()
  const m = d0.getMonth()
  if (y === curY && m === curM) return dn < pd
  if (y === prevY && m === prevM) return dn >= pd
  return false
}

/** Whole KES — same as `net_pay` in calculatePayrollLine (for reports / bank totals). */
export const roundNetPay = (n) => {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(round2(x))
}

/**
 * Map leave_code → pay % (0–100). 100 = fully paid; 0 = unpaid (deduct full daily amount from gross).
 * @param {Array<{ leave_code?: string, pay_percentage?: number }>} leaveTypes
 * @returns {Map<string, number>}
 */
export function buildLeaveTypePayMap(leaveTypes = []) {
  const m = new Map()
  for (const lt of leaveTypes) {
    const code = String(lt.leave_code || '').toUpperCase().trim()
    if (!code) continue
    let pct = lt.pay_percentage
    if (pct == null || Number.isNaN(Number(pct))) {
      pct = code === 'UNPAID' ? 0 : 100
    }
    m.set(code, Math.max(0, Math.min(100, Number(pct))))
  }
  return m
}

/**
 * Unpaid leave day equivalents for this payroll period (100 − pay%) × calendar days.
 * Uses company pay date: only days in this run’s window are counted (see `dayIsInPayrollRunWindow`).
 * Daily rate applied elsewhere: (Basic + HSE) ÷ 30.
 *
 * @param {{ employeeId: string, period: string, approvedLeaves: Array, leaveTypePayMap: Map<string, number>, payDate?: number }} p
 * @returns {number} Day equivalents (can be fractional when pay% is e.g. 50)
 */
export function computeUnpaidLeaveDayEquivalents({
  employeeId,
  period,
  approvedLeaves,
  leaveTypePayMap,
  payDate = 25
}) {
  const empId = String(employeeId || '').trim()
  if (!empId || !period) return 0
  const pd = Math.min(31, Math.max(1, Number(payDate) || 25))
  const curStart = startOfMonth(parseISO(`${period}-01`))
  const curEnd = endOfMonth(curStart)
  const prevStart = startOfMonth(subMonths(curStart, 1))

  let total = 0
  for (const req of approvedLeaves || []) {
    if (String(req.employee_id || '').trim() !== empId) continue
    const code = String(req.leave_type || '').toUpperCase().trim()
    const payPct = leaveTypePayMap.has(code)
      ? leaveTypePayMap.get(code)
      : code === 'UNPAID'
        ? 0
        : 100
    if (payPct >= 100) continue
    const ls = startOfDay(parseISO(String(req.start_date).slice(0, 10)))
    const le = startOfDay(parseISO(String(req.end_date).slice(0, 10)))
    if (Number.isNaN(ls.getTime()) || Number.isNaN(le.getTime()) || le < ls) continue
    const overlapStart = ls < prevStart ? prevStart : ls
    const overlapEnd = le > curEnd ? curEnd : le
    if (overlapEnd < overlapStart) continue
    const fraction = (100 - payPct) / 100
    const days = eachDayOfInterval({ start: overlapStart, end: overlapEnd })
    for (const d of days) {
      if (dayIsInPayrollRunWindow(d, period, pd)) total += fraction
    }
  }
  return total
}

export const computePAYE = (taxablePay, personalRelief = 2400) => {
  const pay = Math.max(0, Number(taxablePay) || 0)

  // Kenyan PAYE simplified brackets (as per current spec in this project)
  // 0 - 24,000 @ 10%
  // 24,001 - 32,333 @ 25%
  // 32,334+ @ 30%
  const b1 = 24000
  const b2 = 32333

  let tax = 0
  if (pay <= b1) {
    tax = pay * 0.10
  } else if (pay <= b2) {
    tax = b1 * 0.10 + (pay - b1) * 0.25
  } else {
    tax = b1 * 0.10 + (b2 - b1) * 0.25 + (pay - b2) * 0.30
  }

  const relief = Number(personalRelief) || 0
  return round2(Math.max(0, tax - relief))
}

/** NSSF: nearest whole KES (two decimals shown as .00 in UI/reports). */
export const roundNSSFAmount = (n) => {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(round2(x))
}

export const computeNSSF = (grossPay, tier1Limit = 7000, tier2UpperLimit = 36000) => {
  const gross = Math.max(0, Number(grossPay) || 0)
  const t1 = Math.max(0, Number(tier1Limit) || 7000)
  const t2 = Math.max(t1, Number(tier2UpperLimit) || 36000)

  const tier1Base = Math.min(gross, t1)
  const tier1 = tier1Base * 0.06 // max 420 when tier1Limit=7000

  const tier2Base = Math.max(0, Math.min(gross, t2) - t1)
  const tier2 = tier2Base * 0.06

  const employee = roundNSSFAmount(tier1 + tier2)
  const employer = employee

  return {
    nssf_employee: employee,
    nssf_employer: employer,
    tier1: Math.round(round2(tier1)),
    tier2: Math.round(round2(tier2))
  }
}

export const computeSHIF = (grossPay, ratePct = 2.75, minimum = 300) => {
  const gross = Math.max(0, Number(grossPay) || 0)
  const rate = Math.max(0, Number(ratePct) || 0) / 100
  const min = Math.max(0, Number(minimum) || 0)

  const employee = round2(Math.max(gross * rate, min))
  const employer = round2(Math.max(gross * rate, min))

  return { shif_employee: employee, shif_employer: employer }
}

export const computeAHL = (grossPay, ratePct = 1.5) => {
  const gross = Math.max(0, Number(grossPay) || 0)
  const rate = Math.max(0, Number(ratePct) || 0) / 100

  const employee = round2(gross * rate)
  const employer = round2(gross * rate)

  return { ahl_employee: employee, ahl_employer: employer }
}

export const computeAllowances = ({ basicSalary, standardAllowance, housingAllowance, housingAllowanceType }) => {
  const basic = Math.max(0, Number(basicSalary) || 0)
  const standard = Math.max(0, Number(standardAllowance) || 0)
  const housingRaw = Math.max(0, Number(housingAllowance) || 0)

  let housing = 0
  
  if (housingAllowanceType === 'percentage') {
    // Percentage of basic salary
    housing = (basic * housingRaw) / 100
  } else if (housingAllowanceType === 'percentage_gross') {
    // Percentage of gross salary
    // Gross = Basic + Standard + Housing
    // Housing = Gross * Percentage / 100
    // Gross = Basic + Standard + (Gross * Percentage / 100)
    // Gross - (Gross * Percentage / 100) = Basic + Standard
    // Gross * (1 - Percentage/100) = Basic + Standard
    // Gross = (Basic + Standard) / (1 - Percentage/100)
    const percentageDecimal = housingRaw / 100
    if (percentageDecimal >= 1) {
      // Prevent division by zero or negative
      housing = 0
    } else {
      const gross = (basic + standard) / (1 - percentageDecimal)
      housing = round2(gross * percentageDecimal)
    }
  } else {
    // Fixed amount
    housing = housingRaw
  }

  return {
    standard_allowance: round2(standard),
    housing_allowance: round2(housing),
    allowances_total: round2(standard + housing)
  }
}

export const computeOvertimePay = ({
  attendanceRecords,
  workingHours = 8,
  grossBeforeOvertime,
  overtimeRateType = 'fixed',
  overtimeRate = 0
}) => {
  const wh = Math.max(0.1, Number(workingHours) || 8)
  const gross0 = Math.max(0, Number(grossBeforeOvertime) || 0)

  // Derive hourly rate from gross before overtime (simple 30-day base)
  const hourlyRate = (gross0 / 30) / wh

  // Determine overtime base rate
  let baseRate = 0
  if (overtimeRateType === 'percentage') {
    baseRate = hourlyRate * (Math.max(0, Number(overtimeRate) || 0) / 100)
    // If not configured, default to 100% of hourly rate
    if (baseRate === 0) baseRate = hourlyRate
  } else {
    baseRate = Math.max(0, Number(overtimeRate) || 0)
    // If not configured, default to hourly rate
    if (baseRate === 0) baseRate = hourlyRate
  }

  let overtime1_5x = 0
  let overtime2x = 0
  let totalOvertimeHours = 0

  for (const rec of attendanceRecords || []) {
    const hoursWorked = Number(rec.hours_worked) || 0
    const ot = rec.overtime_hours != null ? Number(rec.overtime_hours) : Math.max(0, hoursWorked - wh)
    const split = calculateOvertime(wh + ot, wh) // reuse to split
    overtime1_5x += split.overtime1_5x
    overtime2x += split.overtime2x
    totalOvertimeHours += split.totalOvertime
  }

  const overtimePay = overtime1_5x * baseRate * 1.5 + overtime2x * baseRate * 2

  return {
    overtime_1_5x_hours: round2(overtime1_5x),
    overtime_2x_hours: round2(overtime2x),
    overtime_hours: round2(totalOvertimeHours),
    overtime_rate_base: round2(baseRate),
    overtime_pay: round2(overtimePay)
  }
}

/**
 * SUN/HOLIDAY: premium for (1) company holidays and (2) Sundays when the day has attendance.
 * "Included in attendance" is represented by an attendance record for that date.
 * Per qualifying day: (Basic + HSE allow) / 30 × (holiday rate % / 100), or the same day-pay for Sunday-only.
 * HSE = housing allowance; standard / other fixed allowances are not in this day rate.
 * If a day is both Sunday and a public holiday, the holiday rate applies once (not double).
 * Uses the same pay-date window as unpaid leave (`dayIsInPayrollRunWindow`).
 * @param {number} monthlyBaseBasicHse - Basic + housing allowance (monthly)
 * @param {Array} attendanceRecords - { date }[]
 * @param {Array} holidaysInPeriod - { holiday_date, rate_type, rate }[] (active only)
 * @param {string} period - yyyy-MM payroll period
 * @param {number} payDate - 1..31 configured pay date
 */
const computeHolidayPay = (
  monthlyBaseBasicHse,
  attendanceRecords,
  holidaysInPeriod,
  period,
  payDate = 25,
  workingHours = 8
) => {
  if (!attendanceRecords?.length) return 0
  if (!period) return 0
  const pd = Math.min(31, Math.max(1, Number(payDate) || 25))
  const wh = Math.max(0.1, Number(workingHours) || 8)

  /** Per calendar date: 0–1 of a standard day, from hours_worked (half day = 0.5 for Sunday/holiday top-up). */
  const dayFraction = new Map()
  for (const rec of attendanceRecords) {
    const ds = String(rec.date || '').slice(0, 10)
    if (!ds) continue
    const hwRaw = rec.hours_worked
    const frac =
      hwRaw == null || hwRaw === '' || !Number.isFinite(Number(hwRaw))
        ? 1
        : Math.min(1, Math.max(0, Number(hwRaw) / wh))
    dayFraction.set(ds, Math.max(dayFraction.get(ds) || 0, frac))
  }

  const base = Math.max(0, Number(monthlyBaseBasicHse) || 0)
  const dailyRate = base / 30
  const holidayByDate = new Map(
    (holidaysInPeriod || [])
      .map((h) => [String(h.holiday_date || '').slice(0, 10), h])
      .filter(([d]) => !!d)
  )
  const attendedDates = new Set(
    (attendanceRecords || [])
      .map((r) => String(r.date || '').slice(0, 10))
      .filter(Boolean)
  )
  let total = 0
  for (const date of attendedDates) {
    const ds = String(date).slice(0, 10)
    const d = startOfDay(parseISO(ds))
    if (Number.isNaN(d.getTime()) || !dayIsInPayrollRunWindow(d, period, pd)) continue
    const f = dayFraction.get(ds) ?? 1
    const holiday = holidayByDate.get(ds)
    if (holiday) {
      const ratePct = holiday.rate_type === 'normal' ? 100 : (Number(holiday.rate) || 100)
      total += dailyRate * (ratePct / 100) * f
    } else if (isSunday(d)) {
      total += dailyRate * f
    }
  }
  return round2(total)
}

export const calculatePayrollLine = ({
  employee,
  attendanceRecords,
  period,
  settings,
  employeeDeduction = null,
  holidaysInPeriod = [],
  /** Day equivalents at (Basic+HSE)/30 for approved leave where leave type pay % is below 100 */
  unpaidLeaveDayEquivalents = 0
}) => {
  const basicSalary = Number(employee.basic_salary) || 0

  const allowances = computeAllowances({
    basicSalary,
    standardAllowance: settings.standard_allowance ?? 0,
    housingAllowance: settings.housing_allowance ?? 0,
    housingAllowanceType: settings.housing_allowance_type || 'fixed'
  })

  // Gross Pay = Total Fixed Monthly Remuneration (EARNINGS)
  // Formula: Basic Pay + House Allowance (HSE ALLOW) + Other Monthly Allowances
  const grossPay = round2(basicSalary + allowances.allowances_total)
  // Day rate for SUN/HOLIDAY and absence: (Basic + HSE) / 30 only (excludes e.g. standard allowance)
  const baseBasicHse = round2(basicSalary + allowances.housing_allowance)

  // Safety check: If grossPay equals basicSalary, it means allowances are 0 or missing
  if (grossPay === basicSalary && allowances.allowances_total === 0) {
    console.warn(`[Payroll] Employee ${employee.name || employee.employee_id}: No allowances configured. Gross Pay = Basic Salary only.`)
  }

  const overtime = computeOvertimePay({
    attendanceRecords,
    workingHours: settings.working_hours ?? 8,
    grossBeforeOvertime: grossPay,
    overtimeRateType: settings.overtime_rate_type || 'fixed',
    overtimeRate: settings.overtime_rate ?? 0
  })

  // SUN/HOLIDAY: (Basic + HSE) / 30 per attended Sunday, and per attended holiday per rate %
  const holidayPay = computeHolidayPay(
    baseBasicHse,
    attendanceRecords || [],
    holidaysInPeriod,
    period,
    settings.pay_date,
    settings.working_hours ?? 8
  )
  
  // Calculate gross before deductions (includes overtime and holiday pay)
  const grossBeforeDeductions = round2(grossPay + overtime.overtime_pay + holidayPay)
  
  // Absence (manual + unpaid leave): (Basic + HSE) / 30 × day equivalents
  const absentDays = employeeDeduction?.absent_days ? Number(employeeDeduction.absent_days) : 0
  const unpaidEq = Math.max(0, Number(unpaidLeaveDayEquivalents) || 0)

  const dailyRate = baseBasicHse / 30
  const manualAbsenceDeduction = round2(dailyRate * absentDays)
  const unpaidLeaveDeduction = round2(dailyRate * unpaidEq)
  const absenceDeduction = round2(manualAbsenceDeduction + unpaidLeaveDeduction)

  if (absentDays > 0) {
    const expectedManual = round2((baseBasicHse / 30) * absentDays)
    console.log(`[Absence Deduction] ${employee.name || employee.employee_id || 'Unknown'}:`, {
      'Basic + HSE (monthly)': `KES ${baseBasicHse.toFixed(2)}`,
      'Daily (Basic+HSE / 30)': `KES ${dailyRate.toFixed(2)}`,
      'Absent days': absentDays,
      'Manual absence deduction': `KES ${manualAbsenceDeduction.toFixed(2)}`,
      expected: `KES ${expectedManual.toFixed(2)}`
    })
    if (Math.abs(manualAbsenceDeduction - expectedManual) > 0.01) {
      console.error(`[ERROR] Absence deduction mismatch! Expected: ${expectedManual}, Got: ${manualAbsenceDeduction}`)
    }
  }

  if (unpaidEq > 0) {
    console.log(`[Unpaid leave deduction] ${employee.name || employee.employee_id || 'Unknown'}:`, {
      'Unpaid leave day equivalents': unpaidEq,
      'Daily rate (Basic+HSE / 30)': `KES ${dailyRate.toFixed(2)}`,
      'Unpaid leave deduction': `KES ${unpaidLeaveDeduction.toFixed(2)}`
    })
  }

  // Validation: If someone accidentally uses basicSalary, this will catch it
  if (absentDays > 0 && grossPay <= basicSalary) {
    console.warn(`[WARNING] Gross Pay (${grossPay}) should be greater than Basic Salary (${basicSalary}) for absence deduction calculation.`)
  }
  
  // Get advance and shopping amounts (POST-TAX deductions - deducted from Net Pay only)
  // CRITICAL: Advance and Shopping are POST-TAX deductions and must NOT reduce taxable income
  const advanceAmount = employeeDeduction?.advance_amount ? Number(employeeDeduction.advance_amount) : 0
  const shoppingAmount = employeeDeduction?.shopping_amount ? Number(employeeDeduction.shopping_amount) : 0
  
  // Gross Pay After Absence (absence / unpaid leave is a PRE-TAX deduction)
  const grossAfterAbsence = round2(grossBeforeDeductions - absenceDeduction)

  // TOTAL EARN (reporting): earnings after absence / unpaid leave — same base as statutory (SHIF, NSSF, AHL)
  const totalEarn = round2(grossAfterAbsence)

  // Statutory Deductions (calculated from Gross After Absence, NOT including advance/shopping)
  // SHIF and NSSF are calculated from gross after absence deduction only
  // CRITICAL: Advance and Shopping do NOT reduce the base for SHIF/NSSF calculation
  const shif = computeSHIF(grossAfterAbsence, settings.shif_rate ?? 2.75, settings.shif_minimum ?? 300)
  const nssf = computeNSSF(grossAfterAbsence, settings.nssf_tier1_limit ?? 7000, settings.nssf_tier2_limit ?? 36000)
  
  // HOUSING LEVY (AHL) is calculated from TOTAL EARN minus ABSENCE
  // Base = Gross After Absence (same as SHIF/NSSF base):
  //   (TOTAL EARNINGS - Absence Deduction) × AHL rate
  // CRITICAL: This is DIFFERENT from HSE ALLOW which is an earning
  // - HSE ALLOW is added to Basic Pay to calculate TOTAL EARN (it's an earning)
  // - HOUSING LEVY is a DEDUCTION taken as a % of earnings after absence
  const ahl = computeAHL(grossAfterAbsence, settings.ahl_rate ?? 1.5)

  // Taxable Pay = Gross After Absence - SHIF - NSSF - AHL (Housing Levy)
  // CRITICAL: Advance and Shopping are NOT deducted here - they are POST-TAX deductions
  // Only allowable non-taxable deductions (SHIF, NSSF, AHL) reduce taxable income
  const taxablePay = round2(grossAfterAbsence - shif.shif_employee - nssf.nssf_employee - ahl.ahl_employee)
  const paye = computePAYE(taxablePay, settings.personal_relief ?? 2400)

  const otherDeductions = 0

  // Net pay = gross after absence minus SHIF, NSSF, AHL, PAYE, advance, shopping, other (advance/shopping post-tax)
  const totalDeductions = round2(
    shif.shif_employee +
      nssf.nssf_employee +
      ahl.ahl_employee +
      paye +
      advanceAmount +
      shoppingAmount +
      otherDeductions
  )
  // Net pay: whole KES (no decimals)
  const netPay = Math.round(round2(grossAfterAbsence - totalDeductions))

  // Actual vs Projected earnings (based on pay_date)
  const payDate = Math.min(31, Math.max(1, Number(settings.pay_date) || 25))
  const [year, month] = (period || '').split('-').map(Number)
  const daysInMonth = year && month ? new Date(year, month, 0).getDate() : 30
  const actualDays = Math.max(0, payDate - 1)
  const projectedDays = Math.max(0, daysInMonth - payDate + 1)
  const actualRatio = daysInMonth > 0 ? actualDays / daysInMonth : 0
  const projectedRatio = daysInMonth > 0 ? projectedDays / daysInMonth : 1

  // Actual/Projected earnings based on gross after absence (before advance/shopping)
  // Note: Advance and Shopping are post-tax, so they don't affect actual/projected earnings calculation
  const actual_earnings = round2(grossAfterAbsence * actualRatio)
  const projected_earnings = round2(grossAfterAbsence * projectedRatio)
  const actual_net = Math.round(netPay * actualRatio)
  const projected_net = Math.round(netPay * projectedRatio)

  return {
    period,
    employee_id: employee.$id,
    user_id: employee.user_id || employee.$id,
    name: employee.name,
    department: employee.department || '',
    position: employee.position || '',

    basic_salary: round2(basicSalary),
    allowances: allowances.allowances_total,
    standard_allowance: allowances.standard_allowance,
    housing_allowance: allowances.housing_allowance,

    // Gross Pay (Total Fixed Monthly Remuneration) = Basic + House Allowance + Other Fixed Allowances
    // This is the "wages" used for absence deduction per Kenyan law
    gross_pay_base: round2(grossPay),

    overtime_hours: overtime.overtime_hours,
    overtime_pay: overtime.overtime_pay,
    holiday_pay: holidayPay,
    absence_deduction: absenceDeduction,
    manual_absence_deduction: manualAbsenceDeduction,
    unpaid_leave_deduction: unpaidLeaveDeduction,
    unpaid_leave_day_equivalents: round2(unpaidEq),

    // Total earn (reporting): gross after absence — same numeric base as gross_pay / statutory
    total_earn: round2(totalEarn),

    // Gross pay after absence deduction (before advance/shopping)
    // Used for statutory deductions (SHIF, NSSF) calculation
    // CRITICAL: Advance and Shopping are POST-TAX and do NOT reduce this value
    gross_pay: grossAfterAbsence,

    shif_employee: shif.shif_employee,
    shif_employer: shif.shif_employer,
    nssf_employee: nssf.nssf_employee,
    nssf_employer: nssf.nssf_employer,
    ahl_employee: ahl.ahl_employee,
    ahl_employer: ahl.ahl_employer,

    taxable_pay: taxablePay,
    paye,
    other_deductions: otherDeductions,
    net_pay: netPay,

    // Employee deductions (for display)
    absent_days: absentDays,
    advance_amount: advanceAmount,
    shopping_amount: shoppingAmount,

    // Actual (1st to pay_date-1) vs Projected (pay_date to end)
    actual_earnings,
    projected_earnings,
    actual_net,
    projected_net,
    pay_date: payDate,
    actual_days: actualDays,
    projected_days: projectedDays,
    days_in_month: daysInMonth
  }
}

