import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { getEmployees } from './employeeService'
import { getLeaveRequests } from './leaveService'
import { getHolidays } from './holidayService'
import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'
import { format, subMonths } from 'date-fns'

const listAll = async (collectionId, queries = []) => {
  const limit = 100
  let offset = 0
  let all = []
  while (true) {
    const res = await databases.listDocuments(DATABASE_ID, collectionId, [
      ...queries.filter(Boolean),
      Query.limit(limit),
      Query.offset(offset)
    ])
    all = all.concat(res.documents)
    if (res.documents.length < limit) break
    offset += limit
  }
  return all
}

/**
 * Fetch all company data for export (employees, attendance, payroll runs, leave, holidays).
 * Optionally limit to last N months for attendance and payroll.
 */
export const fetchCompanyDataForExport = async (companyId, options = {}) => {
  const monthsBack = Math.max(1, Math.min(24, options.monthsBack || 12))
  const endDate = new Date()
  const startDate = subMonths(endDate, monthsBack)
  const startStr = format(startDate, 'yyyy-MM-dd')
  const endStr = format(endDate, 'yyyy-MM-dd')

  const periodFrom = format(startDate, 'yyyy-MM')
  const periodTo = format(endDate, 'yyyy-MM')

  const [employees, attendance, payrollRuns, leaveRequests, holidays] = await Promise.all([
    getEmployees(companyId, { status: 'active' }).catch(() => getEmployees(companyId, {})).catch(() => []),
    isLocalDataSource()
      ? (async () => {
          const res = await localApiFetch(
            `/api/attendance/records?company_id=${encodeURIComponent(companyId)}&from=${encodeURIComponent(startStr)}&to=${encodeURIComponent(endStr)}`
          )
          if (!res.ok) return []
          return res.json()
        })()
      : listAll(COLLECTIONS.ATTENDANCE, [
          Query.equal('company_id', companyId),
          Query.greaterThanEqual('date', startStr),
          Query.lessThanEqual('date', endStr)
        ]),
    isLocalDataSource()
      ? (async () => {
          const res = await localApiFetch(
            `/api/payroll/runs?company_id=${encodeURIComponent(companyId)}`
          )
          if (!res.ok) return []
          const all = await res.json()
          return all.filter((r) => {
            const p = String(r.period || '')
            return p >= periodFrom && p <= periodTo
          })
        })()
      : listAll(COLLECTIONS.PAYROLL_RUNS, [
          Query.equal('company_id', companyId),
          Query.greaterThanEqual('period', periodFrom),
          Query.lessThanEqual('period', periodTo)
        ]),
    getLeaveRequests(companyId, { start_date: startStr, end_date: endStr }).catch(() => []),
    getHolidays(companyId, { status: 'active' }).catch(() => [])
  ])

  return {
    exportedAt: new Date().toISOString(),
    companyId,
    period: { start: startStr, end: endStr, monthsBack },
    employees: employees || [],
    attendance: attendance || [],
    payrollRuns: payrollRuns || [],
    leaveRequests: leaveRequests || [],
    holidays: holidays || []
  }
}

/**
 * Trigger download of company data as JSON file.
 */
export const downloadCompanyDataJSON = (data, companyName = 'Company') => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `company_data_${(companyName || 'export').replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Trigger download of company data as CSV (one sheet per entity type in a single file, or multiple files).
 * Simple approach: one CSV for employees, one for attendance summary.
 */
export const downloadCompanyDataCSV = (data, companyName = 'Company') => {
  const baseName = `company_data_${(companyName || 'export').replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}`
  const escape = (v) => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }

  const employees = data.employees || []
  if (employees.length > 0) {
    const headers = ['name', 'employee_id', 'department', 'position', 'basic_salary', 'email', 'status']
    const rows = [headers.join(','), ...employees.map(e => headers.map(h => escape(e[h])).join(','))]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${baseName}_employees.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const attendance = data.attendance || []
  if (attendance.length > 0) {
    const headers = ['date', 'user_id', 'clock_in_time', 'clock_out_time', 'hours_worked']
    const rows = [headers.join(','), ...attendance.map(r => headers.map(h => escape(r[h])).join(','))]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${baseName}_attendance.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}
