import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { getEmployees } from './employeeService'

const listAllDocuments = async (collectionId, baseQueries = []) => {
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

