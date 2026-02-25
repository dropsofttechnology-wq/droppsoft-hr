import { calculateOvertime } from './timesheet'

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

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

export const computeNSSF = (grossPay, tier1Limit = 7000, tier2UpperLimit = 36000) => {
  const gross = Math.max(0, Number(grossPay) || 0)
  const t1 = Math.max(0, Number(tier1Limit) || 7000)
  const t2 = Math.max(t1, Number(tier2UpperLimit) || 36000)

  const tier1Base = Math.min(gross, t1)
  const tier1 = tier1Base * 0.06 // max 420 when tier1Limit=7000

  const tier2Base = Math.max(0, Math.min(gross, t2) - t1)
  const tier2 = tier2Base * 0.06

  const employee = round2(tier1 + tier2)
  const employer = round2(tier1 + tier2)

  return {
    nssf_employee: employee,
    nssf_employer: employer,
    tier1: round2(tier1),
    tier2: round2(tier2)
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

  const housing =
    housingAllowanceType === 'percentage'
      ? (basic * housingRaw) / 100
      : housingRaw

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

export const calculatePayrollLine = ({ employee, attendanceRecords, period, settings }) => {
  const basicSalary = Number(employee.basic_salary) || 0

  const allowances = computeAllowances({
    basicSalary,
    standardAllowance: settings.standard_allowance ?? 0,
    housingAllowance: settings.housing_allowance ?? 0,
    housingAllowanceType: settings.housing_allowance_type || 'fixed'
  })

  const grossBeforeOvertime = basicSalary + allowances.allowances_total

  const overtime = computeOvertimePay({
    attendanceRecords,
    workingHours: settings.working_hours ?? 8,
    grossBeforeOvertime,
    overtimeRateType: settings.overtime_rate_type || 'fixed',
    overtimeRate: settings.overtime_rate ?? 0
  })

  const holidayPay = 0
  const absenceDeduction = 0

  const grossPay = round2(grossBeforeOvertime + overtime.overtime_pay + holidayPay - absenceDeduction)

  const shif = computeSHIF(grossPay, settings.shif_rate ?? 2.75, settings.shif_minimum ?? 300)
  const nssf = computeNSSF(grossPay, settings.nssf_tier1_limit ?? 7000, settings.nssf_tier2_limit ?? 36000)
  const ahl = computeAHL(grossPay, settings.ahl_rate ?? 1.5)

  const taxablePay = round2(grossPay - shif.shif_employee - nssf.nssf_employee - ahl.ahl_employee)
  const paye = computePAYE(taxablePay, settings.personal_relief ?? 2400)

  const otherDeductions = 0
  const netPay = round2(grossPay - shif.shif_employee - nssf.nssf_employee - ahl.ahl_employee - paye - otherDeductions)

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

    overtime_hours: overtime.overtime_hours,
    overtime_pay: overtime.overtime_pay,
    holiday_pay: holidayPay,
    absence_deduction: absenceDeduction,

    gross_pay: grossPay,

    shif_employee: shif.shif_employee,
    shif_employer: shif.shif_employer,
    nssf_employee: nssf.nssf_employee,
    nssf_employer: nssf.nssf_employer,
    ahl_employee: ahl.ahl_employee,
    ahl_employer: ahl.ahl_employer,

    taxable_pay: taxablePay,
    paye,
    other_deductions: otherDeductions,
    net_pay: netPay
  }
}

