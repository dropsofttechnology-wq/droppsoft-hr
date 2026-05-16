import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { format, parseISO, eachDayOfInterval } from 'date-fns'
import { getLeaveRequests } from './leaveService'
import { getEmployees } from './employeeService'
import { getPayrollRunsForPeriod } from './payrollService'
import { getCompanySettings } from '../utils/settingsHelper'
import { isClockInOnTime } from '../utils/attendanceHelper'
import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'

export async function fetchAttendanceForRange(companyId, from, to) {
  if (isLocalDataSource()) {
    const res = await localApiFetch(
      `/api/attendance/records?company_id=${encodeURIComponent(companyId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    )
    if (!res.ok) return []
    return res.json()
  }
  const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.ATTENDANCE, [
    Query.equal('company_id', companyId),
    Query.greaterThanEqual('date', from),
    Query.lessThanEqual('date', to),
    Query.limit(5000)
  ])
  return res.documents
}

export const getAttendanceStats = async (companyId) => {
  try {
    const today = format(new Date(), 'yyyy-MM-dd')
    const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')
    const monthEnd = format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd')
    
    const employeeDocs = await getEmployees(companyId, { status: 'active' })
    const totalEmployees = employeeDocs.length
    const empById = new Map(employeeDocs.map(e => [e.$id, e]))

    const todayAttendance = await fetchAttendanceForRange(companyId, today, today)

    // Get unique employees present today
    const todayPresentSet = new Set(todayAttendance.map(r => r.user_id))
    const todayPresent = todayPresentSet.size

    // On-time vs late today (using reporting grace period)
    let todayOnTime = 0
    let todayLate = 0
    try {
      const reportingSettings = await getCompanySettings(companyId, ['official_reporting_time', 'reporting_grace_minutes'])
      todayAttendance.forEach(record => {
        if (record.clock_in_time && record.date) {
          if (isClockInOnTime(record.clock_in_time, record.date, reportingSettings)) todayOnTime++
          else todayLate++
        }
      })
    } catch (_) { /* ignore */ }

    const monthAttendance = await fetchAttendanceForRange(companyId, monthStart, monthEnd)

    // Group by employee to count unique days per employee
    const employeeDaysMap = new Map()
    monthAttendance.forEach(record => {
      const userId = record.user_id
      if (!employeeDaysMap.has(userId)) {
        employeeDaysMap.set(userId, new Set())
      }
      employeeDaysMap.get(userId).add(record.date)
    })

    // Get approved leave requests (we'll filter by month/today in code)
    let totalLeaveDays = 0
    let staffOnLeaveToday = 0
    const staffOnLeaveDetails = []
    try {
      const leaveRequests = await getLeaveRequests(companyId, {
        status: 'approved'
      })

      // Staff on leave today (approved leave that covers today)
      const todayDate = parseISO(today)
      const staffOnLeaveTodaySet = new Set()
      leaveRequests.forEach(leave => {
        if (leave.start_date <= today && leave.end_date >= today) {
          staffOnLeaveTodaySet.add(leave.employee_id)
          const emp = empById.get(leave.employee_id)
          const end = parseISO(leave.end_date)
          let remaining = 0
          if (end >= todayDate) {
            const diffMs = end.getTime() - todayDate.getTime()
            remaining = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
          }
          staffOnLeaveDetails.push({
            employee_id: leave.employee_id,
            name: emp?.name || '',
            department: emp?.department || '',
            leave_type: leave.leave_type,
            start_date: leave.start_date,
            end_date: leave.end_date,
            remaining_days: remaining
          })
        }
      })
      staffOnLeaveToday = staffOnLeaveTodaySet.size

      // Calculate total leave days (only count days within the month)
      const monthStartDate = parseISO(monthStart)
      const monthEndDate = parseISO(monthEnd)
      
      leaveRequests.forEach(leave => {
        const leaveStart = parseISO(leave.start_date)
        const leaveEnd = parseISO(leave.end_date)
        
        // Find overlap with month period
        const overlapStart = leaveStart > monthStartDate ? leaveStart : monthStartDate
        const overlapEnd = leaveEnd < monthEndDate ? leaveEnd : monthEndDate
        
        if (overlapStart <= overlapEnd) {
          // Count days in the overlap (excluding weekends if needed, but typically leave includes all days)
          const days = eachDayOfInterval({ start: overlapStart, end: overlapEnd })
          totalLeaveDays += days.length
        }
      })
    } catch (error) {
      console.warn('Error fetching leave requests for dashboard stats:', error)
      // Continue without leave adjustment if there's an error
    }

    const expectedAttendanceToday = Math.max(0, totalEmployees - staffOnLeaveToday)

    // Calculate statistics
    const totalDaysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    const totalPossibleDays = totalEmployees * totalDaysInMonth
    const expectedAttendanceDays = totalPossibleDays - totalLeaveDays // Subtract leave days
    const totalDaysPresent = Array.from(employeeDaysMap.values()).reduce((sum, days) => sum + days.size, 0)
    const averageDaysPerEmployee = totalEmployees > 0 ? (totalDaysPresent / totalEmployees).toFixed(1) : 0
    const attendanceRate = expectedAttendanceDays > 0 ? ((totalDaysPresent / expectedAttendanceDays) * 100).toFixed(1) : 0

    return {
      todayPresent,
      todayOnTime,
      todayLate,
      monthPresent: monthAttendance.length,
      totalEmployees,
      totalDaysPresent,
      totalLeaveDays,
      expectedAttendanceDays,
      averageDaysPerEmployee: parseFloat(averageDaysPerEmployee),
      attendanceRate: parseFloat(attendanceRate),
      totalDaysInMonth,
      staffOnLeaveToday,
      staffOnLeaveDetails,
      expectedAttendanceToday
    }
  } catch (error) {
    console.error('Error fetching attendance stats:', error)
    return { 
      todayPresent: 0, 
      todayOnTime: 0,
      todayLate: 0,
      monthPresent: 0, 
      totalEmployees: 0,
      totalDaysPresent: 0,
      totalLeaveDays: 0,
      expectedAttendanceDays: 0,
      averageDaysPerEmployee: 0,
      attendanceRate: 0,
      totalDaysInMonth: 0,
      staffOnLeaveToday: 0,
      staffOnLeaveDetails: [],
      expectedAttendanceToday: 0
    }
  }
}

export const getPayrollStats = async (companyId) => {
  try {
    const currentPeriod = format(new Date(), 'yyyy-MM')
    const [runs, employees] = await Promise.all([
      getPayrollRunsForPeriod(companyId, currentPeriod),
      getEmployees(companyId, { status: 'active' })
    ])

    return {
      processed: runs.length > 0,
      totalEmployees: employees.length
    }
  } catch (error) {
    console.error('Error fetching payroll stats:', error)
    return { processed: false, totalEmployees: 0 }
  }
}
