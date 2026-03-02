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

export const calculatePayrollLine = ({ employee, attendanceRecords, period, settings, employeeDeduction = null }) => {
  const basicSalary = Number(employee.basic_salary) || 0

  const allowances = computeAllowances({
    basicSalary,
    standardAllowance: settings.standard_allowance ?? 0,
    housingAllowance: settings.housing_allowance ?? 0,
    housingAllowanceType: settings.housing_allowance_type || 'fixed'
  })

  // Gross Pay = Total Fixed Monthly Remuneration (EARNINGS)
  // Formula: Basic Pay + House Allowance (HSE ALLOW) + Other Monthly Allowances
  // According to Kenyan law: Basic Salary + House Allowance + Other Fixed Monthly Allowances
  // This is the "wages" used for absence deduction calculations
  // CRITICAL: HSE ALLOW is an EARNING, not a deduction
  // CRITICAL: This MUST include allowances, NOT just basic salary
  const grossPay = round2(basicSalary + allowances.allowances_total)
  
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

  const holidayPay = 0
  
  // Calculate gross before deductions (includes overtime and holiday pay)
  const grossBeforeDeductions = round2(grossPay + overtime.overtime_pay + holidayPay)
  
  // Calculate absence deduction: (Gross Pay / 30) * absent days
  // Gross Pay = Total Fixed Monthly Remuneration (Basic + House Allowance + Other Fixed Allowances)
  // This is per Kenyan law where "wages" refers to Total Fixed Monthly Remuneration
  // 
  // CRITICAL: We MUST use grossPay (Basic + Allowances), NOT basicSalary alone
  // Formula: Absence Deduction = (Gross Pay / 30) × Absent Days
  // Where Gross Pay = Basic Salary + House Allowance + Other Fixed Monthly Allowances
  const absentDays = employeeDeduction?.absent_days ? Number(employeeDeduction.absent_days) : 0
  
  // Ensure we're using grossPay, not basicSalary
  // grossPay = basicSalary + allowances.allowances_total (already calculated above)
  const dailyRate = grossPay / 30
  const absenceDeduction = round2(dailyRate * absentDays)
  
  // Debug logging to verify calculation (always log when absent days > 0)
  if (absentDays > 0) {
    const basicOnlyCalculation = round2((basicSalary / 30) * absentDays)
    const correctCalculation = round2((grossPay / 30) * absentDays)
    
    console.log(`[Absence Deduction Calculation] ${employee.name || employee.employee_id || 'Unknown'}:`, {
      'Basic Salary': `KES ${basicSalary.toFixed(2)}`,
      'Standard Allowance': `KES ${allowances.standard_allowance.toFixed(2)}`,
      'Housing Allowance': `KES ${allowances.housing_allowance.toFixed(2)}`,
      'Total Allowances': `KES ${allowances.allowances_total.toFixed(2)}`,
      'Gross Pay (Basic + Allowances)': `KES ${grossPay.toFixed(2)}`,
      'Absent Days': absentDays,
      'Daily Rate (Gross Pay / 30)': `KES ${dailyRate.toFixed(2)}`,
      '✅ CORRECT Calculation (Gross Pay / 30 × Days)': `KES ${correctCalculation.toFixed(2)}`,
      '❌ WRONG Calculation (Basic / 30 × Days)': `KES ${basicOnlyCalculation.toFixed(2)}`,
      'Difference': `KES ${(correctCalculation - basicOnlyCalculation).toFixed(2)}`,
      'Actual Deduction Applied': `KES ${absenceDeduction.toFixed(2)}`
    })
    
    // Verify the calculation matches
    if (Math.abs(absenceDeduction - correctCalculation) > 0.01) {
      console.error(`[ERROR] Absence deduction mismatch! Expected: ${correctCalculation}, Got: ${absenceDeduction}`)
    }
  }
  
  // Validation: If someone accidentally uses basicSalary, this will catch it
  if (absentDays > 0 && grossPay <= basicSalary) {
    console.warn(`[WARNING] Gross Pay (${grossPay}) should be greater than Basic Salary (${basicSalary}) for absence deduction calculation.`)
  }
  
  // Get advance and shopping amounts (POST-TAX deductions - deducted from Net Pay only)
  // CRITICAL: Advance and Shopping are POST-TAX deductions and must NOT reduce taxable income
  const advanceAmount = employeeDeduction?.advance_amount ? Number(employeeDeduction.advance_amount) : 0
  const shoppingAmount = employeeDeduction?.shopping_amount ? Number(employeeDeduction.shopping_amount) : 0
  
  // TOTAL EARN = Basic Pay + HSE ALLOW + Other Monthly Allowances + Overtime + Holiday Pay
  // Formula: TOTAL_EARN = BASIC_PAY + HSE_ALLOW + OTHER_EARNINGS
  // This is the gross before any deductions
  // CRITICAL: HSE ALLOW is part of earnings, NOT a deduction
  const totalEarn = round2(grossBeforeDeductions)
  
  // Gross Pay After Absence (absence is a PRE-TAX deduction)
  // Absence deduction reduces gross before calculating statutory deductions and tax
  const grossAfterAbsence = round2(grossBeforeDeductions - absenceDeduction)

  // Statutory Deductions (calculated from Gross After Absence, NOT including advance/shopping)
  // SHIF and NSSF are calculated from gross after absence deduction only
  // CRITICAL: Advance and Shopping do NOT reduce the base for SHIF/NSSF calculation
  const shif = computeSHIF(grossAfterAbsence, settings.shif_rate ?? 2.75, settings.shif_minimum ?? 300)
  const nssf = computeNSSF(grossAfterAbsence, settings.nssf_tier1_limit ?? 7000, settings.nssf_tier2_limit ?? 36000)
  
  // HOUSING LEVY (AHL) must be calculated as 1.5% of TOTAL EARN (before absence deduction)
  // CRITICAL: This is DIFFERENT from HSE ALLOW which is an earning
  // - HSE ALLOW is added to Basic Pay to calculate TOTAL EARN (it's an earning)
  // - HOUSING LEVY is 1.5% of TOTAL EARN and is a deduction
  // - These are two separate accounting entries that should never be confused
  const ahl = computeAHL(totalEarn, settings.ahl_rate ?? 1.5)

  // Taxable Pay = Gross After Absence - SHIF - NSSF - AHL (Housing Levy)
  // CRITICAL: Advance and Shopping are NOT deducted here - they are POST-TAX deductions
  // Only allowable non-taxable deductions (SHIF, NSSF, AHL) reduce taxable income
  const taxablePay = round2(grossAfterAbsence - shif.shif_employee - nssf.nssf_employee - ahl.ahl_employee)
  const paye = computePAYE(taxablePay, settings.personal_relief ?? 2400)

  const otherDeductions = 0
  
  // Net Pay Calculation
  // Formula: NET_PAY = TAXABLE_PAY - PAYE - ADVANCE - SHOPPING - OTHER_DEDUCTIONS
  // 
  // CRITICAL: Advance and Shopping are POST-TAX deductions
  // They are deducted from Net Pay (after tax), NOT from Gross Taxable Income
  // CRITICAL: Shopping and Advance are treated EXACTLY the same - only the name differs
  // Both are deducted from Net Pay identically, order doesn't matter
  // 
  // Calculation Flow:
  // 1. Gross Earnings = Basic + Allowances + Overtime + Holiday Pay
  // 2. Gross After Absence = Gross Earnings - Absence Deduction (PRE-TAX)
  // 3. Statutory Deductions = SHIF + NSSF + AHL (from Gross After Absence)
  // 4. Taxable Pay = Gross After Absence - Statutory Deductions
  // 5. PAYE = Tax on Taxable Pay - Personal Relief
  // 6. Net Pay = Taxable Pay - PAYE - Advance - Shopping - Other Deductions
  //    (Shopping and Advance are interchangeable in this formula)
  const netPay = round2(taxablePay - paye - advanceAmount - shoppingAmount - otherDeductions)
  
  // Total Deductions for reporting purposes (all deductions including post-tax)
  const totalDeductions = round2(shif.shif_employee + nssf.nssf_employee + ahl.ahl_employee + paye + advanceAmount + shoppingAmount + otherDeductions)

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
  const actual_net = round2(netPay * actualRatio)
  const projected_net = round2(netPay * projectedRatio)

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

    // TOTAL EARN = Basic Pay + HSE ALLOW + Other Monthly Allowances + Overtime + Holiday Pay
    // This is the gross before any deductions
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

