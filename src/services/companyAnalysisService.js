import { format, subDays, subMonths, eachDayOfInterval } from 'date-fns'
import { fetchAttendanceForRange, getAttendanceStats } from './dashboardService'
import { getEmployees } from './employeeService'
import { getLeaveRequests } from './leaveService'
import { getPayrollRunsForPeriod } from './payrollService'
import { getShoppingRequests } from './shoppingService'
import { isLocalDataSource } from '../config/dataSource'

const MAX_DEPT_LABELS = 10

function groupDepartment(employees) {
  const map = new Map()
  for (const e of employees) {
    const d = (e.department && String(e.department).trim()) || 'Unassigned'
    map.set(d, (map.get(d) || 0) + 1)
  }
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1])
  if (entries.length <= MAX_DEPT_LABELS) {
    return entries.map(([name, count]) => ({ name, count }))
  }
  const top = entries.slice(0, MAX_DEPT_LABELS - 1)
  const rest = entries.slice(MAX_DEPT_LABELS - 1).reduce((s, [, c]) => s + c, 0)
  return [...top.map(([name, count]) => ({ name, count })), { name: 'Other', count: rest }]
}

function statusLabel(s) {
  const v = (s && String(s).toLowerCase()) || 'unknown'
  if (v === 'active') return 'Active'
  if (v === 'inactive') return 'Inactive'
  if (v === 'terminated' || v === 'former') return 'Terminated'
  if (v === 'unknown') return 'Unspecified'
  return v.charAt(0).toUpperCase() + v.slice(1)
}

async function buildAttendanceTrend(companyId, days = 14) {
  const end = new Date()
  const start = subDays(end, days - 1)
  const from = format(start, 'yyyy-MM-dd')
  const to = format(end, 'yyyy-MM-dd')
  const records = await fetchAttendanceForRange(companyId, from, to)
  const byDate = new Map()
  for (const r of records) {
    const d = r.date
    if (!d) continue
    if (!byDate.has(d)) byDate.set(d, new Set())
    if (r.user_id) byDate.get(d).add(r.user_id)
  }
  const interval = eachDayOfInterval({ start, end })
  return interval.map((day) => {
    const key = format(day, 'yyyy-MM-dd')
    const set = byDate.get(key)
    return {
      date: key,
      label: format(day, 'EEE d'),
      present: set ? set.size : 0
    }
  })
}

/**
 * Aggregates HR metrics for charts on the company analysis page.
 */
export async function getCompanyAnalysisData(companyId) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const leaveFrom = format(subDays(new Date(), 90), 'yyyy-MM-dd')

  const monthPeriods = []
  for (let i = 0; i < 6; i++) {
    monthPeriods.push(format(subMonths(new Date(), i), 'yyyy-MM'))
  }

  const [allEmployees, attendanceStats, attendanceTrend, leaveRows, payrollChunks] = await Promise.all([
    getEmployees(companyId, {}).catch(() => []),
    getAttendanceStats(companyId).catch(() => null),
    buildAttendanceTrend(companyId, 14).catch(() => []),
    getLeaveRequests(companyId, { from: leaveFrom, to: today }).catch(() => []),
    Promise.all(
      monthPeriods.map(async (period) => {
        try {
          const runs = await getPayrollRunsForPeriod(companyId, period)
          const totalNet = runs.reduce((sum, line) => sum + (Number(line.net_pay) || 0), 0)
          return { period, totalNetPay: totalNet, lineCount: runs.length }
        } catch {
          return { period, totalNetPay: 0, lineCount: 0 }
        }
      })
    )
  ])
  const shoppingRows = isLocalDataSource()
    ? await getShoppingRequests(companyId, { status: 'all' }).catch(() => [])
    : []

  const payrollByMonth = [...payrollChunks].reverse()

  const departmentBar = groupDepartment(allEmployees)

  const statusMap = new Map()
  for (const e of allEmployees) {
    const label = statusLabel(e.status)
    statusMap.set(label, (statusMap.get(label) || 0) + 1)
  }
  const employeeStatusPie = [...statusMap.entries()].map(([name, value]) => ({ name, value }))

  const leaveStatusCount = {}
  for (const row of leaveRows) {
    const st = (row.status || 'unknown').toLowerCase()
    leaveStatusCount[st] = (leaveStatusCount[st] || 0) + 1
  }
  const leaveStatusPie = Object.entries(leaveStatusCount).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value
  }))

  const typeMap = new Map()
  for (const row of leaveRows) {
    if ((row.status || '').toLowerCase() !== 'approved') continue
    const t = row.leave_type || 'Unknown'
    typeMap.set(t, (typeMap.get(t) || 0) + 1)
  }
  const leaveTypeBar = [...typeMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  const activeCount = allEmployees.filter((e) => (e.status || '').toLowerCase() === 'active').length
  const employeeById = new Map((allEmployees || []).map((e) => [String(e.$id), e]))
  const shoppingApprovedRows = (shoppingRows || []).filter((row) => String(row.status || '').toLowerCase() === 'approved')
  const totalShoppingApproved = shoppingApprovedRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const shoppingDeptMap = new Map()
  for (const row of shoppingApprovedRows) {
    const employee = employeeById.get(String(row.employee_id))
    const dept = String(employee?.department || 'Unassigned').trim() || 'Unassigned'
    shoppingDeptMap.set(dept, (shoppingDeptMap.get(dept) || 0) + (Number(row.amount) || 0))
  }
  const shoppingByDepartment = [...shoppingDeptMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))

  return {
    headcount: {
      total: allEmployees.length,
      active: activeCount,
      inactiveOrOther: Math.max(0, allEmployees.length - activeCount)
    },
    attendanceStats: attendanceStats || {},
    attendanceTrend,
    departmentBar,
    employeeStatusPie,
    leaveStatusPie,
    leaveTypeBar,
    payrollByMonth,
    shopping: {
      totalApprovedAmount: Math.round(totalShoppingApproved * 100) / 100,
      approvedCount: shoppingApprovedRows.length,
      byDepartment: shoppingByDepartment
    },
    leaveWindowDays: 90
  }
}
