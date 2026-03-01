import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { getEmployees } from './employeeService'
import { getCompanySettings } from '../utils/settingsHelper'
import { getEmployeeDeductionsForPeriod } from './employeeDeductionsService'
import { format, parseISO } from 'date-fns'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const listAllDocuments = async (collectionId, baseQueries = []) => {
  try {
    const limit = 100
    let offset = 0
    let all = []

    while (true) {
      const res = await databases.listDocuments(DATABASE_ID, collectionId, [
        ...baseQueries.filter(Boolean),
        Query.limit(limit),
        Query.offset(offset)
      ])
      all = all.concat(res.documents)
      if (res.documents.length < limit) break
      offset += limit
    }

    return all
  } catch (error) {
    console.error(`Error listing documents from ${collectionId}:`, error)
    throw new Error(`Failed to fetch data from ${collectionId}: ${error.message || error}`)
  }
}

const toCSV = (rows) => rows.map(r => r.map(v => {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}).join(',')).join('\r\n')

const splitName = (fullName = '') => {
  const parts = String(fullName).trim().split(/\s+/)
  if (parts.length === 0) return { surname: '', otherNames: '' }
  if (parts.length === 1) return { surname: parts[0], otherNames: '' }
  const surname = parts[parts.length - 1]
  const otherNames = parts.slice(0, parts.length - 1).join(' ')
  return { surname, otherNames }
}

export const fetchPayrollDataForPeriod = async (companyId, period) => {
  const [employees, runs] = await Promise.all([
    getEmployees(companyId, { status: 'active' }),
    listAllDocuments(COLLECTIONS.PAYROLL_RUNS, [
      Query.equal('company_id', companyId),
      Query.equal('period', period)
    ])
  ])

  const empById = new Map(employees.map(e => [e.$id, e]))
  return { employees, runs, empById }
}

export const fetchCompanyPayrollListDataForPeriod = async (companyId, period) => {
  const [{ employees, runs, empById }, s, deductions] = await Promise.all([
    fetchPayrollDataForPeriod(companyId, period),
    getCompanySettings(companyId, ['standard_allowance', 'housing_allowance', 'housing_allowance_type']).catch(() => ({})),
    getEmployeeDeductionsForPeriod(companyId, period).catch(() => [])
  ])

  const settings = {
    standard_allowance: parseFloat(s.standard_allowance) || 0,
    housing_allowance: parseFloat(s.housing_allowance) || 0,
    housing_allowance_type: s.housing_allowance_type || 'fixed'
  }

  const deductionsByEmployeeId = new Map(deductions.map(d => [d.employee_id, d]))

  return { employees, runs, empById, settings, deductionsByEmployeeId }
}

const money = (n) => {
  const num = Number(n || 0)
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const calcHousingAllowance = (basicSalary, settings) => {
  const basic = Number(basicSalary || 0)
  const raw = Number(settings?.housing_allowance || 0)
  const t = settings?.housing_allowance_type || 'fixed'
  const standard = Number(settings?.standard_allowance || 0)
  
  if (t === 'percentage') {
    // Percentage of basic salary
    return (basic * raw) / 100
  } else if (t === 'percentage_gross') {
    // Percentage of gross salary
    // Gross = Basic + Standard + Housing
    // Housing = Gross * Percentage / 100
    // Solving: Gross = (Basic + Standard) / (1 - Percentage/100)
    const percentageDecimal = raw / 100
    if (percentageDecimal >= 1) {
      return 0
    }
    const gross = (basic + standard) / (1 - percentageDecimal)
    return gross * percentageDecimal
  }
  // Fixed amount
  return raw
}

export const generateCompanyPayrollListPDF = ({
  companyName,
  period,
  runs,
  empById,
  settings,
  deductionsByEmployeeId
}) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

  const reportDate = format(new Date(), 'dd MMMM yyyy')
  const periodTitle = format(parseISO(`${period}-01`), 'MMMM yyyy').toUpperCase()

  // Header Section - matching template format
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(reportDate, 40, 30)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(String(companyName || '').toUpperCase(), doc.internal.pageSize.getWidth() / 2, 50, { align: 'center' })

  doc.setFontSize(12)
  doc.text(`COMPANY PAYROLL LIST FOR ${periodTitle}`, doc.internal.pageSize.getWidth() / 2, 70, { align: 'center' })

  // Build rows (sorted by staff no)
  const rows = []
  let totals = {
    basic: 0,
    hse: 0,
    sday: 0,
    absence: 0,
    otherEarn: 0,
    totalEarn: 0,
    paye: 0,
    nssf: 0,
    nhif: 0,
    shopping: 0,
    advance: 0,
    housingLevy: 0,
    otherDed: 0,
    pension: 0,
    totalDed: 0,
    net: 0
  }

  const sortedRuns = [...(runs || [])].sort((a, b) => {
    const ea = empById.get(a.employee_id)
    const eb = empById.get(b.employee_id)
    const sa = (ea?.employee_id || ea?.staff_no || '').toString()
    const sb = (eb?.employee_id || eb?.staff_no || '').toString()
    return sa.localeCompare(sb)
  })

  // Bank / payment breakdown (based on employee bank_name)
  const bankTotals = new Map()

  for (const run of sortedRuns) {
    const emp = empById.get(run.employee_id)
    if (!emp) continue

    const staffNo = emp.employee_id || emp.staff_no || ''
    const name = emp.name || ''

    const basic = Number(run.basic_salary || 0)
    const hse = calcHousingAllowance(basic, settings)
    const sday = Number(run.holiday_pay || 0)
    const absence = -Number(run.absence_deduction || 0) // show as negative like the sample
    const standard = Number(settings?.standard_allowance || 0)
    const otherEarn = standard + Number(run.overtime_pay || 0)

    // Total earnings exclude advance/shopping (they are shown in deductions section)
    const totalEarn = basic + hse + sday + otherEarn + absence

    const paye = Number(run.paye || 0)
    const nssf = Number(run.nssf_employee || 0)
    const nhif = Number(run.shif_employee || 0) // labelled NHIF in the sample
    const shopping = Number(deductionsByEmployeeId?.get(emp.$id)?.shopping_amount || 0)
    const advance = Number(deductionsByEmployeeId?.get(emp.$id)?.advance_amount || 0)
    const housingLevy = Number(run.ahl_employee || 0) // labelled HOUSING in the sample
    const otherDed = Number(run.other_deductions || 0)
    const pension = 0
    const totalDed = paye + nssf + nhif + shopping + advance + housingLevy + otherDed + pension

    const net = totalEarn - totalDed

    const bankName = (emp.bank_name || '').trim() || 'CASH'
    bankTotals.set(bankName, (bankTotals.get(bankName) || 0) + net)

    rows.push([
      staffNo,
      name,
      money(basic),
      money(hse),
      money(sday),
      money(absence),
      money(otherEarn),
      money(totalEarn),
      money(paye),
      money(nssf),
      money(nhif),
      money(shopping),
      money(advance),
      money(housingLevy),
      money(otherDed),
      money(pension),
      money(totalDed),
      money(net)
    ])

    totals.basic += basic
    totals.hse += hse
    totals.sday += sday
    totals.absence += absence
    totals.otherEarn += otherEarn
    totals.totalEarn += totalEarn
    totals.paye += paye
    totals.nssf += nssf
    totals.nhif += nhif
    totals.shopping += shopping
    totals.advance += advance
    totals.housingLevy += housingLevy
    totals.otherDed += otherDed
    totals.pension += pension
    totals.totalDed += totalDed
    totals.net += net
  }

  autoTable(doc, {
    startY: 85,
    head: [[
      'STAFF NO.',
      'NAME',
      'BASIC PAY',
      'HSE ALLOW',
      'S/DAYSHOL',
      'ABSENCE',
      'OTHER EARNINGS',
      'TOTAL EARN.',
      'P.A.Y.E',
      'N.S.S.F',
      'N.H.I.F',
      'SHOPPING',
      'ADVANC',
      'HOUSING',
      'OTHER DED',
      'PENSION',
      'TOTAL DED.',
      'NET PAY'
    ]],
    body: rows,
    foot: [[
      'GRAND TOTAL:',
      '',
      money(totals.basic),
      money(totals.hse),
      money(totals.sday),
      money(totals.absence),
      money(totals.otherEarn),
      money(totals.totalEarn),
      money(totals.paye),
      money(totals.nssf),
      money(totals.nhif),
      money(totals.shopping),
      money(totals.advance),
      money(totals.housingLevy),
      money(totals.otherDed),
      money(totals.pension),
      money(totals.totalDed),
      money(totals.net)
    ]],
    styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' },
    footStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 140 },
      2: { halign: 'right', cellWidth: 60 },
      3: { halign: 'right', cellWidth: 60 },
      4: { halign: 'right', cellWidth: 55 },
      5: { halign: 'right', cellWidth: 55 },
      6: { halign: 'right', cellWidth: 70 },
      7: { halign: 'right', cellWidth: 65 },
      8: { halign: 'right', cellWidth: 55 },
      9: { halign: 'right', cellWidth: 55 },
      10: { halign: 'right', cellWidth: 55 },
      11: { halign: 'right', cellWidth: 60 },
      12: { halign: 'right', cellWidth: 55 },
      13: { halign: 'right', cellWidth: 55 },
      14: { halign: 'right', cellWidth: 55 },
      15: { halign: 'right', cellWidth: 55 },
      16: { halign: 'right', cellWidth: 65 },
      17: { halign: 'right', cellWidth: 65 }
    },
    didDrawPage: (data) => {
      // footer page count
      const pageCount = doc.getNumberOfPages()
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(`Page ${doc.getCurrentPageInfo().pageNumber} of ${pageCount}`, doc.internal.pageSize.getWidth() - 60, doc.internal.pageSize.getHeight() - 10)
    }
  })

  // Summary breakdown section - matching template format
  let y2 = doc.lastAutoTable.finalY + 20
  const pageH = doc.internal.pageSize.getHeight()
  if (y2 > pageH - 200) {
    doc.addPage()
    y2 = 40
  }

  // Build summary rows matching template format
  // Banks first, then deductions, with amounts in TOTAL EARN. column position (index 7)
  const summaryRows = []
  
  // Add banks with net pay amounts in TOTAL EARN. column
  const sortedBanks = [...bankTotals.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  for (const [bank, amount] of sortedBanks) {
    const row = Array(18).fill('')
    row[0] = bank
    row[7] = money(amount) // Amount in TOTAL EARN. column
    summaryRows.push(row)
  }
  
  // Add empty row separator
  summaryRows.push(Array(18).fill(''))
  
  // Add deductions with amounts in TOTAL EARN. column
  const deductionItems = [
    ['ADVANCE', totals.advance],
    ['SHOPPING', totals.shopping],
    ['PAYE', totals.paye],
    ['NSSF', totals.nssf],
    ['NHIF', totals.nhif],
    ['TOTAL', totals.totalEarn]
  ]
  
  for (const [label, amount] of deductionItems) {
    const row = Array(18).fill('')
    row[0] = label
    row[7] = money(amount) // Amount in TOTAL EARN. column
    summaryRows.push(row)
  }

  // Add summary table using same structure as main table
  autoTable(doc, {
    startY: y2,
    body: summaryRows,
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold' },
      1: { cellWidth: 140 },
      2: { halign: 'right', cellWidth: 60 },
      3: { halign: 'right', cellWidth: 60 },
      4: { halign: 'right', cellWidth: 55 },
      5: { halign: 'right', cellWidth: 55 },
      6: { halign: 'right', cellWidth: 70 },
      7: { halign: 'right', cellWidth: 65, fontStyle: 'bold' },
      8: { halign: 'right', cellWidth: 55 },
      9: { halign: 'right', cellWidth: 55 },
      10: { halign: 'right', cellWidth: 55 },
      11: { halign: 'right', cellWidth: 60 },
      12: { halign: 'right', cellWidth: 55 },
      13: { halign: 'right', cellWidth: 55 },
      14: { halign: 'right', cellWidth: 55 },
      15: { halign: 'right', cellWidth: 55 },
      16: { halign: 'right', cellWidth: 65 },
      17: { halign: 'right', cellWidth: 65 }
    }
  })

  // Add footer with signature lines
  let footerY = doc.lastAutoTable.finalY + 30
  if (footerY > pageH - 80) {
    doc.addPage()
    footerY = 40
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Prepared by: ................................', 40, footerY)
  doc.text('Checked by: ................................', 40, footerY + 15)
  doc.text('Authorised by: ................................', 40, footerY + 30)
  doc.text('Authorised by: ................................', 40, footerY + 45)
  
  // Add date at bottom
  doc.text(reportDate, 40, doc.internal.pageSize.getHeight() - 20)

  const pdfBytes = doc.output('arraybuffer')
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

export const fetchPayrollDataForYear = async (companyId, year) => {
  const prefix = `${year}-` // e.g. "2026-"
  const runs = await listAllDocuments(COLLECTIONS.PAYROLL_RUNS, [
    Query.equal('company_id', companyId),
    Query.startsWith('period', prefix)
  ])
  return runs
}

export const generateP10CSV = ({ runs, empById, period }) => {
  const header = [
    'EmployeeName',
    'KRAPIN',
    'Period',
    'GrossPay',
    'TaxablePay',
    'PAYE',
    'SHIF_Employee',
    'NSSF_Employee',
    'AHL_Employee',
    'NetPay'
  ]

  const rows = [header]
  for (const run of runs) {
    const emp = empById.get(run.employee_id)
    if (!emp) continue

    rows.push([
      emp.name || '',
      emp.kra_pin || '',
      period,
      run.gross_pay ?? 0,
      run.taxable_pay ?? 0,
      run.paye ?? 0,
      run.shif_employee ?? 0,
      run.nssf_employee ?? 0,
      run.ahl_employee ?? 0,
      run.net_pay ?? 0
    ])
  }

  return toCSV(rows)
}

export const generateNSSFCsv = ({ runs, empById }) => {
  const header = [
    'PayrollNumber',
    'Surname',
    'OtherNames',
    'IDNumber',
    'KRAPIN',
    'NSSFNumber',
    'GrossPay',
    'VoluntaryContributions'
  ]

  const rows = [header]
  for (const run of runs) {
    const emp = empById.get(run.employee_id)
    if (!emp) continue

    const { surname, otherNames } = splitName(emp.name || '')
    rows.push([
      emp.employee_id || emp.staff_no || '',
      surname,
      otherNames,
      emp.id_number || '',
      emp.kra_pin || '',
      emp.nssf_number || '',
      run.gross_pay ?? 0,
      0
    ])
  }

  return toCSV(rows)
}

export const generateSHIFCsv = ({ runs, empById, period }) => {
  const header = [
    'EmployeeName',
    'SHIFNumber',
    'KRAPIN',
    'Period',
    'GrossPay',
    'SHIF_Employee',
    'SHIF_Employer'
  ]

  const rows = [header]
  for (const run of runs) {
    const emp = empById.get(run.employee_id)
    if (!emp) continue
    rows.push([
      emp.name || '',
      emp.shif_number || '',
      emp.kra_pin || '',
      period,
      run.gross_pay ?? 0,
      run.shif_employee ?? 0,
      run.shif_employer ?? 0
    ])
  }

  return toCSV(rows)
}

export const generateAHLCsv = ({ runs, empById, period }) => {
  const header = [
    'EmployeeName',
    'KRAPIN',
    'Period',
    'GrossPay',
    'AHL_Employee',
    'AHL_Employer',
    'AHL_Total'
  ]

  const rows = [header]
  for (const run of runs) {
    const emp = empById.get(run.employee_id)
    if (!emp) continue
    const empAhl = Number(run.ahl_employee ?? 0)
    const empAhlEr = Number(run.ahl_employer ?? 0)
    rows.push([
      emp.name || '',
      emp.kra_pin || '',
      period,
      run.gross_pay ?? 0,
      empAhl,
      empAhlEr,
      empAhl + empAhlEr
    ])
  }

  return toCSV(rows)
}

export const generateP9Csv = ({ runs, employees, year }) => {
  // Group runs by employee
  const byEmp = new Map()
  for (const run of runs) {
    const list = byEmp.get(run.employee_id) || []
    list.push(run)
    byEmp.set(run.employee_id, list)
  }

  const empById = new Map(employees.map(e => [e.$id, e]))

  const header = [
    'EmployeeName',
    'KRAPIN',
    'Year',
    'TotalGross',
    'TotalTaxable',
    'TotalPAYE',
    'TotalSHIF',
    'TotalNSSF',
    'TotalAHL',
    'TotalNet'
  ]

  const rows = [header]

  for (const [employeeId, list] of byEmp.entries()) {
    const emp = empById.get(employeeId)
    if (!emp) continue

    let gross = 0
    let taxable = 0
    let paye = 0
    let shif = 0
    let nssf = 0
    let ahl = 0
    let net = 0

    for (const r of list) {
      gross += Number(r.gross_pay || 0)
      taxable += Number(r.taxable_pay || 0)
      paye += Number(r.paye || 0)
      shif += Number(r.shif_employee || 0)
      nssf += Number(r.nssf_employee || 0)
      ahl += Number(r.ahl_employee || 0)
      net += Number(r.net_pay || 0)
    }

    rows.push([
      emp.name || '',
      emp.kra_pin || '',
      year,
      gross.toFixed(2),
      taxable.toFixed(2),
      paye.toFixed(2),
      shif.toFixed(2),
      nssf.toFixed(2),
      ahl.toFixed(2),
      net.toFixed(2)
    ])
  }

  return toCSV(rows)
}

// Payslips PDF Generator - 4 payslips per page matching template
export const generatePayslipsPDF = async ({
  companyName,
  companyTaxPin,
  period,
  runs,
  empById,
  deductionsByEmployeeId
}) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  
  // Format period for display (e.g., "NOVEMBER 2025")
  const [year, month] = period.split('-')
  const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
  const periodDisplay = `${monthNames[parseInt(month) - 1]} ${year}`
  
  const payslipWidth = (pageWidth - 60) / 2 // 2 columns
  const payslipHeight = (pageHeight - 60) / 2 // 2 rows
  const payslipPadding = 20
  
  let payslipIndex = 0
  
  for (const run of runs) {
    const emp = empById.get(run.employee_id)
    if (!emp) continue
    
    // Calculate position (4 payslips per page)
    if (payslipIndex > 0 && payslipIndex % 4 === 0) {
      doc.addPage()
    }
    
    const col = payslipIndex % 2
    const row = Math.floor((payslipIndex % 4) / 2)
    const x = 30 + col * (payslipWidth + 20)
    const y = 30 + row * (payslipHeight + 20)
    
    // Header
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(`${companyName} PIN: ${companyTaxPin || ''}`, x, y)
    doc.text(`${periodDisplay} PAYSLIP`, x, y + 12)
    
    // Employee info
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    const staffNo = emp.employee_id || emp.staff_no || ''
    doc.text(`NAME: ${emp.name || ''} NO.: ${staffNo}`, x, y + 24)
    
    // Earnings section
    let currentY = y + 36
    doc.setFont('helvetica', 'bold')
    doc.text('EARNINGS', x, currentY)
    currentY += 10
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    const basicPay = Number(run.basic_salary || 0)
    const housingAllowance = Number(run.housing_allowance || 0)
    const grossPay = Number(run.gross_pay || 0)
    
    doc.text('BASIC PAY', x, currentY)
    doc.text(money(basicPay), x + 80, currentY)
    currentY += 10
    
    doc.text('HOUSE ALLOWANCE', x, currentY)
    doc.text(money(housingAllowance), x + 80, currentY)
    currentY += 10
    
    doc.setFont('helvetica', 'bold')
    doc.text('GROSS PAY', x, currentY)
    doc.text(money(grossPay), x + 80, currentY)
    currentY += 12
    
    // Deductions section
    doc.setFont('helvetica', 'bold')
    doc.text('DEDUCTIONS', x, currentY)
    currentY += 10
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    
    const paye = Number(run.paye || 0)
    const nssf = Number(run.nssf_employee || 0)
    const nhif = Number(run.shif_employee || 0) // SHIF mapped to NHIF
    const ahl = Number(run.ahl_employee || 0) // AHL mapped to HOUSING LEVY
    const deduction = deductionsByEmployeeId.get(run.employee_id)
    const advance = Number(deduction?.advance_amount || 0)
    const shopping = Number(deduction?.shopping_amount || 0)
    const personalRelief = Number(run.paye || 0) > 0 ? 2400 : 0 // Estimate relief if PAYE exists
    
    if (paye > 0) {
      doc.text('P.A.Y.E', x, currentY)
      doc.text(money(paye), x + 80, currentY)
      currentY += 10
    }
    
    doc.text('N.S.S.F', x, currentY)
    doc.text(money(nssf), x + 80, currentY)
    currentY += 10
    
    doc.text('N.H.I.F', x, currentY)
    doc.text(money(nhif), x + 80, currentY)
    currentY += 10
    
    if (personalRelief > 0 && paye > 0) {
      doc.text('PAYE TAX RELIEF', x, currentY)
      doc.text(`-${money(personalRelief)}`, x + 80, currentY)
      currentY += 10
    }
    
    if (advance > 0) {
      doc.text('ADVANCE', x, currentY)
      doc.text(money(advance), x + 80, currentY)
      currentY += 10
    }
    
    if (shopping > 0) {
      doc.text('SHOPPING', x, currentY)
      doc.text(money(shopping), x + 80, currentY)
      currentY += 10
    }
    
    doc.text('SHIF', x, currentY)
    doc.text(money(nhif), x + 80, currentY)
    currentY += 10
    
    doc.text('HOUSING LEVY', x, currentY)
    doc.text(money(ahl), x + 80, currentY)
    currentY += 12
    
    // Total deductions and net pay
    const totalDeductions = paye + nssf + nhif + ahl + advance + shopping - (personalRelief > 0 ? personalRelief : 0)
    const netPay = Number(run.net_pay || 0)
    
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL DEDUCTIONS', x, currentY)
    doc.text(money(totalDeductions), x + 80, currentY)
    currentY += 10
    
    doc.text('NET PAY', x, currentY)
    doc.text(money(netPay), x + 80, currentY)
    currentY += 12
    
    // Signature line
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text('SIGNATURE :', x, currentY)
    
    payslipIndex++
  }
  
  const pdfBytes = doc.output('arraybuffer')
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

// Banking Report PDF Generator
export const generateBankingReportPDF = async ({
  companyName,
  period,
  runs,
  empById
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  
  // Header
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(companyName || 'COMPANY', 40, 40)
  
  const [year, month] = period.split('-')
  const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
  doc.setFontSize(12)
  doc.text(`BANKING REPORT FOR ${monthNames[parseInt(month) - 1]} ${year}`, 40, 60)
  
  // Group by bank
  const bankGroups = new Map()
  for (const run of runs) {
    const emp = empById.get(run.employee_id)
    if (!emp) continue
    
    const bankName = emp.bank_name || 'CASH'
    if (!bankGroups.has(bankName)) {
      bankGroups.set(bankName, [])
    }
    bankGroups.get(bankName).push({ emp, run })
  }
  
  let y = 90
  for (const [bankName, items] of bankGroups.entries()) {
    if (y > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage()
      y = 40
    }
    
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(bankName, 40, y)
    y += 20
    
    // Table header
    autoTable(doc, {
      startY: y,
      head: [['Staff No', 'Name', 'Account', 'Net Pay']],
      body: items.map(({ emp, run }) => [
        emp.employee_id || emp.staff_no || '',
        emp.name || '',
        emp.bank_account || '',
        money(run.net_pay || 0)
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' },
      columnStyles: {
        3: { halign: 'right' }
      }
    })
    
    // Bank total
    const bankTotal = items.reduce((sum, { run }) => sum + Number(run.net_pay || 0), 0)
    y = doc.lastAutoTable.finalY + 10
    doc.setFont('helvetica', 'bold')
    doc.text(`Total: ${money(bankTotal)}`, 40, y)
    y += 30
  }
  
  const pdfBytes = doc.output('arraybuffer')
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

// NSSF Report PDF Generator matching template
export const generateNSSFReportPDF = async ({
  companyName,
  period,
  runs,
  empById
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  
  // Header
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(companyName || 'COMPANY', 40, 40)
  
  const [year, month] = period.split('-')
  const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
  doc.setFontSize(12)
  doc.text(`NSSF REPORT FOR ${monthNames[parseInt(month) - 1]} ${year}`, 40, 60)
  
  const rows = []
  let totalGross = 0
  let totalNSSF = 0
  
  for (const run of runs) {
    const emp = empById.get(run.employee_id)
    if (!emp) continue
    
    const { surname, otherNames } = splitName(emp.name || '')
    const gross = Number(run.gross_pay || 0)
    const nssf = Number(run.nssf_employee || 0)
    
    rows.push([
      emp.employee_id || emp.staff_no || '',
      surname,
      otherNames,
      emp.id_number || '',
      emp.kra_pin || '',
      emp.nssf_number || '',
      money(gross),
      money(nssf)
    ])
    
    totalGross += gross
    totalNSSF += nssf
  }
  
  // Add totals row
  rows.push([
    'TOTAL',
    '',
    '',
    '',
    '',
    '',
    money(totalGross),
    money(totalNSSF)
  ])
  
  autoTable(doc, {
    startY: 80,
    head: [['Payroll No', 'Surname', 'Other Names', 'ID Number', 'KRA PIN', 'NSSF Number', 'Gross Pay', 'NSSF Contribution']],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' },
    columnStyles: {
      6: { halign: 'right' },
      7: { halign: 'right' }
    },
    footStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' }
  })
  
  const pdfBytes = doc.output('arraybuffer')
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

// P9 Report PDF Generator matching template
export const generateP9ReportPDF = async ({
  companyName,
  year,
  runs,
  employees
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  
  // Header
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(companyName || 'COMPANY', 40, 40)
  doc.setFontSize(12)
  doc.text(`P9 TAX DEDUCTION CARD FOR YEAR ${year}`, 40, 60)
  
  // Group runs by employee
  const byEmp = new Map()
  for (const run of runs) {
    const list = byEmp.get(run.employee_id) || []
    list.push(run)
    byEmp.set(run.employee_id, list)
  }
  
  const empById = new Map(employees.map(e => [e.$id, e]))
  const rows = []
  
  for (const [employeeId, list] of byEmp.entries()) {
    const emp = empById.get(employeeId)
    if (!emp) continue
    
    let gross = 0
    let taxable = 0
    let paye = 0
    let shif = 0
    let nssf = 0
    let ahl = 0
    let net = 0
    
    for (const r of list) {
      gross += Number(r.gross_pay || 0)
      taxable += Number(r.taxable_pay || 0)
      paye += Number(r.paye || 0)
      shif += Number(r.shif_employee || 0)
      nssf += Number(r.nssf_employee || 0)
      ahl += Number(r.ahl_employee || 0)
      net += Number(r.net_pay || 0)
    }
    
    rows.push([
      emp.name || '',
      emp.kra_pin || '',
      year,
      money(gross),
      money(taxable),
      money(paye),
      money(shif),
      money(nssf),
      money(ahl),
      money(net)
    ])
  }
  
  autoTable(doc, {
    startY: 80,
    head: [['Employee Name', 'KRA PIN', 'Year', 'Total Gross', 'Total Taxable', 'Total PAYE', 'Total SHIF', 'Total NSSF', 'Total AHL', 'Total Net']],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' }
    }
  })
  
  const pdfBytes = doc.output('arraybuffer')
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

// Fetch attendance data for a period
export const fetchAttendanceDataForPeriod = async (companyId, period) => {
  try {
    const [year, month] = period.split('-').map(Number)
    if (!year || !month || month < 1 || month > 12) {
      throw new Error(`Invalid period format: ${period}. Expected format: YYYY-MM`)
    }
    
    const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd')
    const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd')

    const [employees, attendanceRecords] = await Promise.all([
      getEmployees(companyId, { status: 'active' }),
      listAllDocuments(COLLECTIONS.ATTENDANCE, [
        Query.equal('company_id', companyId),
        Query.greaterThanEqual('date', startDate),
        Query.lessThanEqual('date', endDate)
      ])
    ])

  const empById = new Map(employees.map(e => [e.$id, e]))
  const empByUserId = new Map(employees.map(e => [e.user_id || e.$id, e]))

  // Group attendance by employee and date
  const attendanceByEmployee = new Map()
  attendanceRecords.forEach(record => {
    const emp = empByUserId.get(record.user_id) || empById.get(record.user_id)
    if (!emp) return

    const empId = emp.$id
    if (!attendanceByEmployee.has(empId)) {
      attendanceByEmployee.set(empId, {
        employee: emp,
        records: [],
        dates: new Set()
      })
    }

    const data = attendanceByEmployee.get(empId)
    data.records.push(record)
    data.dates.add(record.date)
  })

    return {
      employees,
      attendanceRecords,
      attendanceByEmployee,
      period,
      startDate,
      endDate
    }
  } catch (error) {
    console.error('Error fetching attendance data for period:', error)
    throw new Error(`Failed to fetch attendance data: ${error.message || error}`)
  }
}

// Generate Attendance Report PDF
export const generateAttendanceReportPDF = ({
  companyName,
  period,
  attendanceByEmployee,
  startDate,
  endDate
}) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

  // Header
  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.text(companyName || 'Company', 40, 40)
  
  doc.setFontSize(12)
  doc.setFont(undefined, 'normal')
  doc.text(`Monthly Attendance Report - ${period}`, 40, 60)
  doc.text(`Period: ${startDate} to ${endDate}`, 40, 75)

  // Prepare table data
  const rows = []
  attendanceByEmployee.forEach(({ employee, dates }) => {
    const daysPresent = dates.size
    rows.push([
      employee.name || 'N/A',
      employee.employee_id || employee.staff_no || 'N/A',
      employee.department || 'N/A',
      daysPresent.toString()
    ])
  })

  // Sort by employee name
  rows.sort((a, b) => a[0].localeCompare(b[0]))

  // Add totals row
  const totalDays = rows.reduce((sum, row) => sum + parseInt(row[3] || 0), 0)

  autoTable(doc, {
    startY: 90,
    head: [['Employee Name', 'Employee ID', 'Department', 'Days Present']],
    body: rows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' },
    columnStyles: {
      3: { halign: 'right' }
    },
    foot: [['TOTAL', '', '', totalDays.toString()]],
    footStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' }
  })

  const pdfBytes = doc.output('arraybuffer')
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

// Generate Attendance Report CSV
export const generateAttendanceReportCSV = ({
  period,
  attendanceByEmployee,
  startDate,
  endDate
}) => {
  const rows = [['Employee Name', 'Employee ID', 'Department', 'Days Present']]
  
  attendanceByEmployee.forEach(({ employee, dates }) => {
    rows.push([
      employee.name || 'N/A',
      employee.employee_id || employee.staff_no || 'N/A',
      employee.department || 'N/A',
      dates.size.toString()
    ])
  })

  // Sort by employee name (skip header)
  const dataRows = rows.slice(1)
  dataRows.sort((a, b) => a[0].localeCompare(b[0]))
  const sortedRows = [rows[0], ...dataRows]

  // Add totals
  const totalDays = dataRows.reduce((sum, row) => sum + parseInt(row[3] || 0), 0)
  sortedRows.push(['TOTAL', '', '', totalDays.toString()])

  return toCSV(sortedRows)
}
