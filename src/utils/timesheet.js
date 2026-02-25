import { format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth, isWeekend } from 'date-fns'

/**
 * Generate timesheet for an employee for a given period
 */
export const generateTimesheet = (attendanceRecords, period) => {
  const periodStart = startOfMonth(parseISO(`${period}-01`))
  const periodEnd = endOfMonth(periodStart)
  const allDays = eachDayOfInterval({ start: periodStart, end: periodEnd })

  const timesheet = allDays.map(date => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const record = attendanceRecords.find(r => r.date === dateStr)

    if (record) {
      const clockIn = record.clock_in_time ? parseISO(record.clock_in_time) : null
      const clockOut = record.clock_out_time ? parseISO(record.clock_out_time) : null
      const hoursWorked = parseFloat(record.hours_worked || 0)
      const overtimeHours = parseFloat(record.overtime_hours || 0)

      return {
        date: dateStr,
        day: format(date, 'EEE'),
        isWeekend: isWeekend(date),
        clockIn: clockIn ? format(clockIn, 'HH:mm') : null,
        clockOut: clockOut ? format(clockOut, 'HH:mm') : null,
        hoursWorked,
        overtimeHours,
        status: clockIn && clockOut ? 'present' : clockIn ? 'incomplete' : 'absent',
        authMethod: record.auth_method || 'manual'
      }
    } else {
      return {
        date: dateStr,
        day: format(date, 'EEE'),
        isWeekend: isWeekend(date),
        clockIn: null,
        clockOut: null,
        hoursWorked: 0,
        overtimeHours: 0,
        status: isWeekend(date) ? 'weekend' : 'absent',
        authMethod: null
      }
    }
  })

  // Calculate summary
  const summary = {
    totalDays: allDays.length,
    workingDays: allDays.filter(d => !isWeekend(d)).length,
    presentDays: timesheet.filter(t => t.status === 'present').length,
    absentDays: timesheet.filter(t => t.status === 'absent').length,
    incompleteDays: timesheet.filter(t => t.status === 'incomplete').length,
    totalHours: timesheet.reduce((sum, t) => sum + t.hoursWorked, 0),
    totalOvertime: timesheet.reduce((sum, t) => sum + t.overtimeHours, 0),
    averageHoursPerDay: 0
  }

  if (summary.presentDays > 0) {
    summary.averageHoursPerDay = summary.totalHours / summary.presentDays
  }

  return {
    timesheet,
    summary,
    period
  }
}

/**
 * Calculate overtime hours
 */
export const calculateOvertime = (hoursWorked, standardHours = 8) => {
  if (hoursWorked <= standardHours) {
    return {
      regularHours: hoursWorked,
      overtime1_5x: 0,
      overtime2x: 0,
      totalOvertime: 0
    }
  }

  const overtime = hoursWorked - standardHours
  const overtime1_5x = Math.min(overtime, 2) // First 2 hours at 1.5x
  const overtime2x = Math.max(0, overtime - 2) // Remaining at 2x

  return {
    regularHours: standardHours,
    overtime1_5x,
    overtime2x,
    totalOvertime: overtime
  }
}
