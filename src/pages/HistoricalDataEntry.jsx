import { useEffect, useMemo, useState } from 'react'
import { format, parseISO, eachDayOfInterval, isWeekend, isSaturday, isSunday } from 'date-fns'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import { getEmployees } from '../services/employeeService'
import { isPeriodClosed } from '../services/periodClosureService'
import { getLeaveTypes } from '../services/leaveService'
import { createLeaveRequest, approveLeaveRequest } from '../services/leaveService'
import {
  bulkUpsertEmployeeDeductions,
  getEmployeeDeductionsForPeriod
} from '../services/employeeDeductionsService'
import { getHolidays } from '../services/holidayService'
import {
  applyBulkDefaultAttendance,
  listAttendanceRecords,
  syncEmployeeAttendanceDays
} from '../services/attendanceService'
import EmployeePicker from '../components/EmployeePicker'
import { getCompanySettings } from '../utils/settingsHelper'
import './HistoricalDataEntry.css'

const clampInt = (v, min, max, fallback = 0) => {
  const n = parseInt(v, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

const clampMoney = (v) => {
  const n = parseFloat(v)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

const HistoricalDataEntry = () => {
  const { currentCompany } = useCompany()
  const { user } = useAuth()

  const [period, setPeriod] = useState(format(new Date(), 'yyyy-MM'))
  const [employees, setEmployees] = useState([])
  const [leaveTypes, setLeaveTypes] = useState([])
  const [holidays, setHolidays] = useState([])
  
  // Data structure: { [employeeId]: { absentDays, advanceAmount, shoppingAmount, leaves: [...], notes } }
  const [employeeData, setEmployeeData] = useState({})
  const [selected, setSelected] = useState({})
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('table') // 'table' or 'dropdown'
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [attendanceCalendarEmployeeId, setAttendanceCalendarEmployeeId] = useState('')
  /** yyyy-MM-dd → 'full' | 'half' for days marked as attended */
  const [attendanceDayModes, setAttendanceDayModes] = useState({})
  const [attendanceDaysExisting, setAttendanceDaysExisting] = useState(new Set())
  const [workingHoursCalendar, setWorkingHoursCalendar] = useState(8)
  const [attendanceCalendarLoading, setAttendanceCalendarLoading] = useState(false)
  const [attendanceCalendarSaving, setAttendanceCalendarSaving] = useState(false)

  const [periodClosed, setPeriodClosed] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [markingAttendance, setMarkingAttendance] = useState(false)
  const [includeWeekends, setIncludeWeekends] = useState(false)
  const [includeHolidays, setIncludeHolidays] = useState(false)
  const [selectedWeekendDays, setSelectedWeekendDays] = useState(new Set()) // Set of date strings (yyyy-MM-dd)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const role = user?.prefs?.role || 'admin'
  const isAdmin = role === 'admin' || role === 'super_admin' || role === 'manager'

  useEffect(() => {
    if (!currentCompany) return
    loadBase()
    getCompanySettings(currentCompany.$id, ['working_hours']).then((s) => {
      const wh = Number(s?.working_hours)
      if (Number.isFinite(wh) && wh > 0) setWorkingHoursCalendar(Math.min(24, wh))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany])

  useEffect(() => {
    if (currentCompany && period) {
      checkPeriodClosure()
      loadData()
      loadHolidays()
      // Reset weekend day selections when period changes
      setSelectedWeekendDays(new Set())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany, period])

  useEffect(() => {
    const loadAttendanceCalendar = async () => {
      if (!currentCompany || !period || !attendanceCalendarEmployeeId) {
        setAttendanceDaysExisting(new Set())
        setAttendanceDayModes({})
        return
      }
      const emp = employees.find((e) => e.$id === attendanceCalendarEmployeeId)
      const userId = emp?.user_id || emp?.$id
      if (!userId) {
        setAttendanceDaysExisting(new Set())
        setAttendanceDayModes({})
        return
      }

      const [year, month] = period.split('-').map(Number)
      const from = format(new Date(year, month - 1, 1), 'yyyy-MM-dd')
      const to = format(new Date(year, month, 0), 'yyyy-MM-dd')
      setAttendanceCalendarLoading(true)
      try {
        const rows = await listAttendanceRecords({
          companyId: currentCompany.$id,
          userId,
          from,
          to
        })
        const daySet = new Set((rows || []).map((r) => String(r.date).slice(0, 10)))
        setAttendanceDaysExisting(daySet)
        const std = workingHoursCalendar
        const modes = {}
        ;(rows || []).forEach((r) => {
          const d = String(r.date).slice(0, 10)
          const hw = Number(r.hours_worked)
          if (Number.isFinite(hw) && hw > 0) {
            modes[d] = hw < std * 0.75 ? 'half' : 'full'
          } else {
            modes[d] = 'full'
          }
        })
        setAttendanceDayModes(modes)
      } catch (e) {
        setError(e.message || 'Failed to load attendance days for selected employee.')
      } finally {
        setAttendanceCalendarLoading(false)
      }
    }
    loadAttendanceCalendar()
  }, [currentCompany, period, attendanceCalendarEmployeeId, employees, workingHoursCalendar])

  const loadBase = async () => {
    setLoading(true)
    setError('')
    try {
      const [emps, types] = await Promise.all([
        getEmployees(currentCompany.$id, { status: 'active' }),
        getLeaveTypes(currentCompany.$id, true)
      ])
      setEmployees(emps)
      setLeaveTypes(types)
    } catch (e) {
      setError(e.message || 'Failed to load employees and leave types.')
    } finally {
      setLoading(false)
    }
  }

  const loadHolidays = async () => {
    if (!currentCompany || !period) return
    try {
      const [year, month] = period.split('-').map(Number)
      const yearHolidays = await getHolidays(currentCompany.$id, { year: year.toString(), status: 'active' })
      setHolidays(yearHolidays)
    } catch (e) {
      console.error('Failed to load holidays:', e)
      setHolidays([])
    }
  }

  const checkPeriodClosure = async () => {
    if (!period || !currentCompany) return
    try {
      const closed = await isPeriodClosed(currentCompany.$id, period)
      setPeriodClosed(closed)
    } catch (error) {
      console.error('Error checking period closure:', error)
      setPeriodClosed(null)
    }
  }

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const deductions = await getEmployeeDeductionsForPeriod(currentCompany.$id, period)
      
      // Initialize employee data from existing deductions
      const data = {}
      deductions.forEach(doc => {
        data[doc.employee_id] = {
          absent_days: doc.absent_days || 0,
          advance_amount: doc.advance_amount || 0,
          shopping_amount: doc.shopping_amount || 0,
          notes: doc.notes || '',
          leaves: [] // Leave requests will be loaded separately if needed
        }
      })
      
      setEmployeeData(data)
    } catch (e) {
      setError(e.message || 'Failed to load employee data.')
      setEmployeeData({})
    } finally {
      setLoading(false)
    }
  }

  const updateEmployeeData = (employeeId, patch) => {
    setEmployeeData((prev) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        ...patch
      }
    }))
  }

  const addLeaveToEmployee = (employeeId) => {
    const emp = employees.find(e => e.$id === employeeId)
    if (!emp) return

    const [year, month] = period.split('-').map(Number)
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)

    const newLeave = {
      id: `temp-${Date.now()}-${Math.random()}`,
      leave_type: '',
      start_date: format(firstDay, 'yyyy-MM-dd'),
      end_date: format(firstDay, 'yyyy-MM-dd'),
      days_requested: 1,
      reason: 'Historical data entry',
      status: 'approved' // Auto-approve historical leave
    }

    updateEmployeeData(employeeId, {
      leaves: [...(employeeData[employeeId]?.leaves || []), newLeave]
    })
  }

  const updateLeave = (employeeId, leaveId, patch) => {
    const current = employeeData[employeeId] || { leaves: [] }
    const leaves = current.leaves.map(l =>
      l.id === leaveId ? { ...l, ...patch } : l
    )
    
    // Recalculate days if dates changed
    if (patch.start_date || patch.end_date) {
      const leave = leaves.find(l => l.id === leaveId)
      if (leave && leave.start_date && leave.end_date) {
        const start = parseISO(leave.start_date)
        const end = parseISO(leave.end_date)
        leave.days_requested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
      }
    }

    updateEmployeeData(employeeId, { leaves })
  }

  const removeLeave = (employeeId, leaveId) => {
    const current = employeeData[employeeId] || { leaves: [] }
    const leaves = current.leaves.filter(l => l.id !== leaveId)
    updateEmployeeData(employeeId, { leaves })
  }

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) =>
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
      emp.staff_no?.toLowerCase().includes(search.toLowerCase())
    )
  }, [employees, search])

  const toggleSelectAllVisible = (e) => {
    const isChecked = e.target.checked
    setSelected((prev) => {
      const newSelected = { ...prev }
      for (const emp of filteredEmployees) {
        newSelected[emp.$id] = isChecked
      }
      return newSelected
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    
    if (!currentCompany) {
      setError('Please select a company first.')
      return
    }
    
    if (periodClosed) {
      setError(`Cannot save. Period ${period} is closed.`)
      return
    }

    // Get employees to save based on view mode
    let employeesToSave = []
    if (viewMode === 'dropdown') {
      if (!selectedEmployeeId) {
        setError('Please select an employee from the dropdown.')
        return
      }
      employeesToSave = employees.filter(emp => emp.$id === selectedEmployeeId)
    } else {
      employeesToSave = filteredEmployees.filter((emp) => selected[emp.$id])
      if (employeesToSave.length === 0) {
        setError('Please select employees to save data for.')
        return
      }
    }

    const itemsToSave = employeesToSave.map((emp) => {
      const d = employeeData[emp.$id] || {}
      return {
        employeeId: emp.$id,
        absentDays: d.absent_days || 0,
        advanceAmount: d.advance_amount || 0,
        shoppingAmount: d.shopping_amount || 0,
        notes: d.notes || '',
        leaves: d.leaves || []
      }
    })

    setSaving(true)
    try {
      // Save deductions
      const deductionItems = itemsToSave.map(item => ({
        employeeId: item.employeeId,
        absentDays: item.absentDays,
        advanceAmount: item.advanceAmount,
        shoppingAmount: item.shoppingAmount,
        notes: item.notes
      }))

      await bulkUpsertEmployeeDeductions({
        companyId: currentCompany.$id,
        period,
        items: deductionItems
      })

      // Create and approve leave requests
      let leavesCreated = 0
      const leaveErrors = []
      
      for (const item of itemsToSave) {
        const emp = employees.find(e => e.$id === item.employeeId)
        const empName = emp?.name || item.employeeId
        
        for (const leave of item.leaves) {
          if (!leave.leave_type || !leave.start_date || !leave.end_date) {
            continue // Skip incomplete leave entries
          }

          try {
            // Create leave request
            const leaveRequest = await createLeaveRequest({
              company_id: currentCompany.$id,
              employee_id: item.employeeId,
              leave_type: leave.leave_type,
              start_date: leave.start_date,
              end_date: leave.end_date,
              reason: leave.reason || 'Historical data entry'
            })

            // Auto-approve historical leave
            await approveLeaveRequest(leaveRequest.$id, user.$id || user.email || 'admin')
            leavesCreated++
          } catch (leaveError) {
            console.error(`Failed to create leave for ${empName}:`, leaveError)
            leaveErrors.push(`${empName}: ${leaveError.message || 'Leave creation failed'}`)
            // Continue with other leaves
          }
        }
      }

      let successMsg = `Saved historical data for ${itemsToSave.length} employees.`
      if (leavesCreated > 0) {
        successMsg += ` Created ${leavesCreated} leave request(s).`
      }
      if (leaveErrors.length > 0) {
        successMsg += ` Note: ${leaveErrors.length} leave request(s) failed (may overlap with existing leave).`
        console.warn('Leave creation errors:', leaveErrors)
      }
      
      setSuccess(successMsg)
      setTimeout(() => setSuccess(''), 5000)
      
      // Reload data
      await loadData()
    } catch (e) {
      setError(e.message || 'Failed to save historical data.')
    } finally {
      setSaving(false)
    }
  }

  const handleMarkRemainingDaysAsAttended = async () => {
    if (!currentCompany || !period) {
      setError('Please select a company and period first.')
      return
    }

    if (periodClosed) {
      setError(`Cannot mark attendance. Period ${period} is closed.`)
      return
    }

    const selectedEmps = filteredEmployees.filter(emp => selected[emp.$id])
    if (selectedEmps.length === 0) {
      setError('Please select employees to mark attendance for.')
      return
    }

    // Get employee user IDs
    const employeeIds = selectedEmps
      .map(emp => emp.user_id || emp.$id)
      .filter(Boolean)

    if (employeeIds.length === 0) {
      setError('Selected employees do not have user IDs. Please link employees to users first.')
      return
    }

    // Calculate date range for the period
    const [year, month] = period.split('-').map(Number)
    const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd')
    const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd')

    // Build list of dates to exclude
    // If includeWeekends is false, exclude all weekends
    // If includeWeekends is true, exclude only the unselected weekend days
    const datesToExclude = new Set()
    
    if (!includeWeekends) {
      // Exclude all weekend days
      periodInfo.weekendDaysList.forEach(wd => {
        datesToExclude.add(wd.dateStr)
      })
    } else {
      // Only exclude weekend days that are NOT selected
      periodInfo.weekendDaysList.forEach(wd => {
        if (!selectedWeekendDays.has(wd.dateStr)) {
          datesToExclude.add(wd.dateStr)
        }
      })
    }

    setMarkingAttendance(true)
    setError('')
    setSuccess('')

    try {
      const res = await applyBulkDefaultAttendance({
        companyId: currentCompany.$id,
        employeeIds,
        startDate,
        endDate,
        includeWeekends: true, // Always pass true, we handle exclusion via datesToExclude
        includeHolidays,
        datesToExclude: Array.from(datesToExclude),
        standardHours: 8
      })

      let successMsg = `Marked remaining days as attended for ${selectedEmps.length} employees. `
      if (res.created > 0) {
        successMsg += `${res.created} attendance record(s) created.`
      }
      if (res.failed > 0) {
        successMsg += ` ${res.failed} record(s) failed (rate limit). Please wait a moment and try again for the remaining records.`
      }
      
      setSuccess(successMsg)
      setTimeout(() => setSuccess(''), 8000)
    } catch (e) {
      const errorMsg = e.message || 'Failed to mark remaining days as attended.'
      // Check if it's a rate limit error
      if (errorMsg.includes('rate limit') || errorMsg.includes('429') || errorMsg.includes('Rate limit')) {
        setError(
          'Rate limit exceeded. Appwrite is limiting requests. ' +
          'Please wait 30-60 seconds and try again. ' +
          'The system will automatically retry failed records on the next attempt.'
        )
      } else {
        setError(errorMsg)
      }
    } finally {
      setMarkingAttendance(false)
    }
  }

  const toggleWeekendDay = (dateStr) => {
    setSelectedWeekendDays(prev => {
      const newSet = new Set(prev)
      if (newSet.has(dateStr)) {
        newSet.delete(dateStr)
      } else {
        newSet.add(dateStr)
      }
      return newSet
    })
  }

  const selectAllWeekendDays = () => {
    const allWeekendDates = new Set(periodInfo.weekendDaysList.map(wd => wd.dateStr))
    setSelectedWeekendDays(allWeekendDates)
  }

  const deselectAllWeekendDays = () => {
    setSelectedWeekendDays(new Set())
  }

  const calendarEmployee = useMemo(
    () => employees.find((e) => e.$id === attendanceCalendarEmployeeId) || null,
    [employees, attendanceCalendarEmployeeId]
  )

  const calendarDays = useMemo(() => {
    if (!period) return []
    const [year, month] = period.split('-').map(Number)
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)
    const holidayDates = new Set(holidays.map((h) => format(parseISO(h.holiday_date), 'yyyy-MM-dd')))
    return eachDayOfInterval({ start: startDate, end: endDate }).map((d) => {
      const dateStr = format(d, 'yyyy-MM-dd')
      return {
        dateStr,
        dayOfMonth: d.getDate(),
        isWeekend: isWeekend(d),
        isSaturday: isSaturday(d),
        isSunday: isSunday(d),
        isHoliday: holidayDates.has(dateStr),
        mode: attendanceDayModes[dateStr] || null,
        existed: attendanceDaysExisting.has(dateStr)
      }
    })
  }, [period, holidays, attendanceDayModes, attendanceDaysExisting])

  /** Cycle: off → full day → half day → off */
  const cycleAttendanceDay = (dateStr) => {
    setAttendanceDayModes((prev) => {
      const next = { ...prev }
      const cur = next[dateStr]
      if (cur == null) {
        next[dateStr] = 'full'
        return next
      }
      if (cur === 'full') {
        next[dateStr] = 'half'
        return next
      }
      delete next[dateStr]
      return next
    })
  }

  const selectAllAttendanceDays = () => {
    setAttendanceDayModes(
      Object.fromEntries(calendarDays.map((d) => [d.dateStr, 'full']))
    )
  }

  const selectWeekdaysOnly = () => {
    setAttendanceDayModes(
      Object.fromEntries(
        calendarDays.filter((d) => !d.isWeekend).map((d) => [d.dateStr, 'full'])
      )
    )
  }

  const clearAttendanceDays = () => {
    setAttendanceDayModes({})
  }

  const saveAttendanceCalendar = async () => {
    if (!currentCompany || !period || !calendarEmployee) {
      setError('Please select a company, period and employee for attendance calendar sync.')
      return
    }
    if (periodClosed) {
      setError(`Cannot save attendance. Period ${period} is closed.`)
      return
    }
    const userId = calendarEmployee.user_id || calendarEmployee.$id
    if (!userId) {
      setError('Selected employee does not have a valid user ID.')
      return
    }
    const [year, month] = period.split('-').map(Number)
    const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd')
    const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd')

    setAttendanceCalendarSaving(true)
    setError('')
    setSuccess('')
    try {
      const selectedDates = Object.keys(attendanceDayModes)
      const res = await syncEmployeeAttendanceDays({
        companyId: currentCompany.$id,
        userId,
        startDate,
        endDate,
        selectedDates,
        dayModes: attendanceDayModes,
        standardHours: workingHoursCalendar
      })
      setAttendanceDaysExisting(new Set(selectedDates))
      setSuccess(
        `Attendance updated for ${calendarEmployee.name}: ${res.inserted || 0} added, ${res.updated || 0} updated, ${
          res.deleted || 0
        } removed.`
      )
      setTimeout(() => setSuccess(''), 7000)
    } catch (e) {
      setError(e.message || 'Failed to sync attendance calendar.')
    } finally {
      setAttendanceCalendarSaving(false)
    }
  }

  // Calculate period info
  const periodInfo = useMemo(() => {
    if (!period) return { startDate: null, endDate: null, days: [], weekendDaysList: [] }
    
    const [year, month] = period.split('-').map(Number)
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)
    const days = eachDayOfInterval({ start: startDate, end: endDate })
    
    const holidayDates = new Set(
      holidays.map(h => format(parseISO(h.holiday_date), 'yyyy-MM-dd'))
    )
    
    const weekendDaysList = days
      .filter(d => isWeekend(d))
      .map(d => ({
        date: d,
        dateStr: format(d, 'yyyy-MM-dd'),
        display: format(d, 'EEE, MMM d')
      }))
    
    const weekendDays = weekendDaysList.length
    const holidayDays = days.filter(d => 
      holidayDates.has(format(d, 'yyyy-MM-dd'))
    ).length
    
    return { startDate, endDate, days, weekendDays, holidayDays, weekendDaysList }
  }, [period, holidays])

  if (!currentCompany) {
    return (
      <div className="historical-data-page">
        <div className="alert alert-warning">Please select a company first.</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="historical-data-page">
        <div className="alert alert-error">Access Denied: You do not have permission to view this page.</div>
      </div>
    )
  }

  return (
    <div className="historical-data-page">
      <div className="page-header">
        <h1>Historical Data Entry</h1>
      </div>

      <p className="page-description">
        Choose any <strong>past or current</strong> payroll month (up to this month) to record figures that affect pay for
        that period. Use this screen for <strong>shopping</strong> and <strong>salary advance</strong> amounts taken in
        earlier months, absences, and leave lines. This includes:
        <br />
        • <strong>Absent Days</strong> (unpaid offs) - deducted from gross pay
        <br />
        • <strong>Leave Requests</strong> - create and auto-approve historical leave
        <br />
        • <strong>Salary Advances</strong> - deducted from gross pay for the selected month
        <br />
        • <strong>Shopping Deductions</strong> - deducted from gross pay for the selected month
        <br />
        <small>
          Period: {periodInfo.startDate && format(periodInfo.startDate, 'MMMM yyyy')} 
          ({periodInfo.weekendDays} weekends, {periodInfo.holidayDays} holidays)
        </small>
      </p>

      <div className="historical-data-toolbar">
        <div className="filter-group">
          <label>Period</label>
          <input 
            type="month" 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            max={format(new Date(), 'yyyy-MM')}
          />
        </div>
        <div className="filter-group">
          <label>View Mode</label>
          <select
            value={viewMode}
            onChange={(e) => {
              setViewMode(e.target.value)
              if (e.target.value === 'dropdown') {
                setSelectedEmployeeId('')
              }
            }}
          >
            <option value="table">Table View (All Employees)</option>
            <option value="dropdown">Single Employee (Dropdown)</option>
          </select>
        </div>
        {viewMode === 'table' && (
          <div className="filter-group">
            <label>Search Employee</label>
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
        {viewMode === 'dropdown' && (
          <div className="filter-group">
            <label>Select Employee</label>
            <EmployeePicker
              employees={employees}
              value={selectedEmployeeId}
              onChange={(e) => {
                const v = e.target.value
                setSelectedEmployeeId(v)
                if (v) {
                  setSelected({ [v]: true })
                } else {
                  setSelected({})
                }
              }}
              selectPlaceholder="-- Select Employee --"
            />
          </div>
        )}
        {viewMode === 'table' && (
          <div className="filter-group">
            <label>Quick Actions</label>
            <div className="quick-actions">
              <button
                type="button"
                onClick={() => {
                  const allSelected = {}
                  employees.forEach(emp => {
                    allSelected[emp.$id] = true
                  })
                  setSelected(allSelected)
                }}
                className="btn-quick-action"
                disabled={periodClosed || saving}
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setSelected({})}
                className="btn-quick-action"
                disabled={periodClosed || saving}
              >
                Deselect All
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mark-attendance-section">
        <h3>Mark Remaining Days as Attended</h3>
        <p className="section-description">
          Create attendance records for all days in the selected month that don't already have records.
          This is useful for marking employees as fully attended for the period.
        </p>
        <div className="rate-limit-warning">
          <strong>⚠️ Note:</strong> If you're processing many employees, the system will automatically 
          handle rate limits by retrying failed requests. For large batches (50+ employees), 
          consider processing in smaller groups to avoid delays.
        </div>
        <div className="attendance-options">
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={includeWeekends}
                onChange={(e) => {
                  setIncludeWeekends(e.target.checked)
                  if (!e.target.checked) {
                    // When unchecking, clear all weekend selections
                    setSelectedWeekendDays(new Set())
                  }
                }}
                disabled={periodClosed || markingAttendance}
              />
              Include weekends ({periodInfo.weekendDays} days)
            </label>
          </div>
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={includeHolidays}
                onChange={(e) => setIncludeHolidays(e.target.checked)}
                disabled={periodClosed || markingAttendance}
              />
              Include holidays ({periodInfo.holidayDays} days)
            </label>
          </div>
        </div>

        {includeWeekends && periodInfo.weekendDaysList.length > 0 && (
          <div className="weekend-days-selection">
            <div className="weekend-days-header">
              <h4>Select Weekend Days to Include in Working Days:</h4>
              <p className="weekend-days-help">
                <strong>Note:</strong> Selected weekend days will be <strong>included</strong> as working days and attendance records will be created for them.
                Unselected weekend days will be <strong>excluded</strong> (no attendance records).
              </p>
              <div className="weekend-days-actions">
                <button
                  type="button"
                  onClick={selectAllWeekendDays}
                  className="btn-select-all-weekends"
                  disabled={periodClosed || markingAttendance}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={deselectAllWeekendDays}
                  className="btn-deselect-all-weekends"
                  disabled={periodClosed || markingAttendance}
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="weekend-days-list">
              {periodInfo.weekendDaysList.map((weekendDay) => {
                const isSelected = selectedWeekendDays.has(weekendDay.dateStr)
                const isHoliday = holidays.some(h => 
                  format(parseISO(h.holiday_date), 'yyyy-MM-dd') === weekendDay.dateStr
                )
                return (
                  <label key={weekendDay.dateStr} className="weekend-day-checkbox">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleWeekendDay(weekendDay.dateStr)}
                      disabled={periodClosed || markingAttendance}
                    />
                    <span className={isHoliday ? 'weekend-holiday' : ''}>
                      {weekendDay.display}
                      {isHoliday && ' (Holiday)'}
                    </span>
                  </label>
                )
              })}
            </div>
            <div className="weekend-days-summary">
              {selectedWeekendDays.size} of {periodInfo.weekendDaysList.length} weekend days selected
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleMarkRemainingDaysAsAttended}
          disabled={markingAttendance || periodClosed || loading || Object.values(selected).every(s => !s)}
          className="btn-mark-attendance"
        >
          {markingAttendance ? 'Marking Attendance...' : 'Mark Remaining Days as Attended'}
        </button>
      </div>

      <div className="attendance-calendar-section">
        <h3>Attendance Calendar (Per Employee)</h3>
        <p className="section-description">
          Pick attended days for one employee. <strong>Click</strong> a day to cycle: <em>off → full day → half day → off</em>.
          Half day stores {workingHoursCalendar / 2}h and pays half the Sunday/holiday (SUN/HOLIDAY) top-up for that day in
          payroll. Colours: Saturday, Sunday, and public holidays are highlighted.
        </p>

        <div className="attendance-calendar-controls">
          <div className="filter-group">
            <label>Select Employee For Calendar</label>
            <EmployeePicker
              employees={employees}
              value={attendanceCalendarEmployeeId}
              onChange={(e) => setAttendanceCalendarEmployeeId(e.target.value)}
              selectPlaceholder="-- Select Employee --"
            />
          </div>
          <div className="attendance-calendar-actions">
            <button
              type="button"
              className="btn-quick-action"
              onClick={selectAllAttendanceDays}
              disabled={!attendanceCalendarEmployeeId || attendanceCalendarLoading || periodClosed || attendanceCalendarSaving}
            >
              Select All
            </button>
            <button
              type="button"
              className="btn-quick-action"
              onClick={selectWeekdaysOnly}
              disabled={!attendanceCalendarEmployeeId || attendanceCalendarLoading || periodClosed || attendanceCalendarSaving}
            >
              Weekdays Only
            </button>
            <button
              type="button"
              className="btn-quick-action"
              onClick={clearAttendanceDays}
              disabled={!attendanceCalendarEmployeeId || attendanceCalendarLoading || periodClosed || attendanceCalendarSaving}
            >
              Clear All
            </button>
            <button
              type="button"
              className="btn-mark-attendance"
              onClick={saveAttendanceCalendar}
              disabled={!attendanceCalendarEmployeeId || attendanceCalendarLoading || periodClosed || attendanceCalendarSaving}
            >
              {attendanceCalendarSaving ? 'Saving Calendar...' : 'Save Attendance Calendar'}
            </button>
          </div>
        </div>

        {!attendanceCalendarEmployeeId ? (
          <div className="empty-state">Select an employee above to edit attendance days for this month.</div>
        ) : attendanceCalendarLoading ? (
          <div className="loading">Loading attendance days...</div>
        ) : (
          <>
            <div className="attendance-calendar-summary">
              <strong>{calendarEmployee?.name || 'Employee'}</strong>:{' '}
              {Object.keys(attendanceDayModes).length} day(s) on calendar (
              {Object.values(attendanceDayModes).filter((m) => m === 'full').length} full,{' '}
              {Object.values(attendanceDayModes).filter((m) => m === 'half').length} half), {attendanceDaysExisting.size} saved
              in DB before last edit.
            </div>
            <div className="attendance-calendar-grid">
              {calendarDays.map((d) => {
                const chipKind = d.isHoliday
                  ? 'day-holiday'
                  : d.isSunday
                    ? 'day-sunday'
                    : d.isSaturday
                      ? 'day-saturday'
                      : ''
                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    className={[
                      'attendance-day-chip',
                      d.mode ? 'selected' : '',
                      d.mode === 'half' ? 'half' : '',
                      d.existed ? 'existing' : '',
                      chipKind
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => cycleAttendanceDay(d.dateStr)}
                    disabled={periodClosed || attendanceCalendarSaving}
                    title={`${d.dateStr}${d.isSaturday ? ' (Sat)' : ''}${d.isSunday ? ' (Sun)' : ''}${
                      d.isHoliday ? ' (Holiday)' : ''
                    } — click: off / full / half`}
                  >
                    <span className="attendance-day-num">{d.dayOfMonth}</span>
                    {d.mode === 'half' && <span className="attendance-half-mark">½</span>}
                  </button>
                )
              })}
            </div>
            <small className="attendance-calendar-legend">
              Saturday, Sunday, and company holidays use different background tints. Half days show a &quot;½&quot; and count as
              50% of a day for Sunday/holiday pay add-ons.
            </small>
          </>
        )}
      </div>

      {periodClosed && (
        <div className="alert alert-warning">
          <strong>Period Closed:</strong> The period {period} is closed. You cannot edit historical data.
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSave} className="historical-data-form">
        {viewMode === 'table' ? (
          <div className="employee-data-table-container">
            <table className="employee-data-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={filteredEmployees.length > 0 && filteredEmployees.every((e) => selected[e.$id])}
                      onChange={toggleSelectAllVisible}
                      aria-label="Select all visible employees"
                    />
                  </th>
                  <th>Employee</th>
                  <th>Absent Days</th>
                  <th>Advance (KES)</th>
                  <th>Shopping (KES)</th>
                  <th>Leaves</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-cell">
                      {loading ? 'Loading...' : 'No employees found.'}
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                  const d = employeeData[emp.$id] || { 
                    absent_days: 0, 
                    advance_amount: 0, 
                    shopping_amount: 0, 
                    leaves: [],
                    notes: '' 
                  }
                  
                  return (
                    <tr key={emp.$id} className="employee-row">
                      <td>
                        <input
                          type="checkbox"
                          checked={!!selected[emp.$id]}
                          onChange={(e) => setSelected((prev) => ({ ...prev, [emp.$id]: e.target.checked }))}
                          aria-label={`Select ${emp.name}`}
                        />
                      </td>
                      <td>
                        <div className="emp-cell">
                          <div className="emp-name">{emp.name}</div>
                          <div className="emp-sub">
                            {(emp.employee_id || emp.staff_no || '-')}
                            {emp.department ? ` • ${emp.department}` : ''}
                          </div>
                        </div>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={d.absent_days ?? ''}
                          onChange={(e) => updateEmployeeData(emp.$id, { 
                            absent_days: clampInt(e.target.value, 0, 30, 0) 
                          })}
                          disabled={periodClosed || saving}
                          className="number-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={d.advance_amount ?? ''}
                          onChange={(e) => updateEmployeeData(emp.$id, { 
                            advance_amount: clampMoney(e.target.value) 
                          })}
                          disabled={periodClosed || saving}
                          className="money-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={d.shopping_amount ?? ''}
                          onChange={(e) => updateEmployeeData(emp.$id, { 
                            shopping_amount: clampMoney(e.target.value) 
                          })}
                          disabled={periodClosed || saving}
                          className="money-input"
                        />
                      </td>
                      <td>
                        <div className="leaves-cell">
                          <button
                            type="button"
                            onClick={() => addLeaveToEmployee(emp.$id)}
                            disabled={periodClosed || saving}
                            className="btn-add-leave"
                          >
                            + Add Leave
                          </button>
                          {d.leaves && d.leaves.length > 0 && (
                            <div className="leaves-list">
                              {d.leaves.map((leave) => (
                                <div key={leave.id} className="leave-item">
                                  <select
                                    value={leave.leave_type || ''}
                                    onChange={(e) => updateLeave(emp.$id, leave.id, { 
                                      leave_type: e.target.value 
                                    })}
                                    disabled={periodClosed || saving}
                                    className="leave-type-select"
                                  >
                                    <option value="">Select Type</option>
                                    {leaveTypes.map(lt => (
                                      <option key={lt.$id} value={lt.leave_code}>
                                        {lt.leave_name}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    type="date"
                                    value={leave.start_date || ''}
                                    onChange={(e) => updateLeave(emp.$id, leave.id, { 
                                      start_date: e.target.value 
                                    })}
                                    disabled={periodClosed || saving}
                                    className="leave-date-input"
                                  />
                                  <input
                                    type="date"
                                    value={leave.end_date || ''}
                                    onChange={(e) => updateLeave(emp.$id, leave.id, { 
                                      end_date: e.target.value 
                                    })}
                                    disabled={periodClosed || saving}
                                    className="leave-date-input"
                                  />
                                  <span className="leave-days">{leave.days_requested || 0} days</span>
                                  <button
                                    type="button"
                                    onClick={() => removeLeave(emp.$id, leave.id)}
                                    disabled={periodClosed || saving}
                                    className="btn-remove-leave"
                                    aria-label="Remove leave"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={d.notes ?? ''}
                          onChange={(e) => updateEmployeeData(emp.$id, { 
                            notes: e.target.value 
                          })}
                          placeholder="Optional notes"
                          disabled={periodClosed || saving}
                          className="notes-input"
                        />
                      </td>
                    </tr>
                  )
                })
              )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="employee-single-form">
            {selectedEmployeeId ? (
              (() => {
                const emp = employees.find(e => e.$id === selectedEmployeeId)
                if (!emp) return <div className="empty-state">Employee not found</div>
                
                const d = employeeData[emp.$id] || { 
                  absent_days: 0, 
                  advance_amount: 0, 
                  shopping_amount: 0, 
                  leaves: [],
                  notes: '' 
                }
                
                return (
                  <div className="single-employee-card">
                    <div className="employee-card-header">
                      <h3>{emp.name}</h3>
                      <p className="employee-card-subtitle">
                        {emp.employee_id || emp.staff_no || 'N/A'} {emp.department ? `• ${emp.department}` : ''}
                      </p>
                    </div>
                    
                    <div className="employee-card-fields">
                      <div className="form-field-group">
                        <label>Absent Days</label>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={d.absent_days ?? ''}
                          onChange={(e) => updateEmployeeData(emp.$id, { 
                            absent_days: clampInt(e.target.value, 0, 30, 0) 
                          })}
                          disabled={periodClosed || saving}
                          className="number-input"
                        />
                      </div>
                      
                      <div className="form-field-group">
                        <label>Advance Amount (KES)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={d.advance_amount ?? ''}
                          onChange={(e) => updateEmployeeData(emp.$id, { 
                            advance_amount: clampMoney(e.target.value) 
                          })}
                          disabled={periodClosed || saving}
                          className="money-input"
                        />
                      </div>
                      
                      <div className="form-field-group">
                        <label>Shopping Amount (KES)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={d.shopping_amount ?? ''}
                          onChange={(e) => updateEmployeeData(emp.$id, { 
                            shopping_amount: clampMoney(e.target.value) 
                          })}
                          disabled={periodClosed || saving}
                          className="money-input"
                        />
                      </div>
                      
                      <div className="form-field-group">
                        <label>Notes</label>
                        <textarea
                          value={d.notes ?? ''}
                          onChange={(e) => updateEmployeeData(emp.$id, { 
                            notes: e.target.value 
                          })}
                          placeholder="Optional notes"
                          disabled={periodClosed || saving}
                          className="notes-textarea"
                          rows="3"
                        />
                      </div>
                      
                      <div className="form-field-group leaves-field-group">
                        <div className="leaves-header">
                          <label>Leave Requests</label>
                          <button
                            type="button"
                            onClick={() => addLeaveToEmployee(emp.$id)}
                            disabled={periodClosed || saving}
                            className="btn-add-leave"
                          >
                            + Add Leave
                          </button>
                        </div>
                        {d.leaves && d.leaves.length > 0 && (
                          <div className="leaves-list-single">
                            {d.leaves.map((leave) => (
                              <div key={leave.id} className="leave-item-single">
                                <select
                                  value={leave.leave_type || ''}
                                  onChange={(e) => updateLeave(emp.$id, leave.id, { 
                                    leave_type: e.target.value 
                                  })}
                                  disabled={periodClosed || saving}
                                  className="leave-type-select"
                                >
                                  <option value="">Select Type</option>
                                  {leaveTypes.map(lt => (
                                    <option key={lt.$id} value={lt.leave_code}>
                                      {lt.leave_name}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="date"
                                  value={leave.start_date || ''}
                                  onChange={(e) => updateLeave(emp.$id, leave.id, { 
                                    start_date: e.target.value 
                                  })}
                                  disabled={periodClosed || saving}
                                  className="leave-date-input"
                                />
                                <input
                                  type="date"
                                  value={leave.end_date || ''}
                                  onChange={(e) => updateLeave(emp.$id, leave.id, { 
                                    end_date: e.target.value 
                                  })}
                                  disabled={periodClosed || saving}
                                  className="leave-date-input"
                                />
                                <span className="leave-days">{leave.days_requested || 0} days</span>
                                <button
                                  type="button"
                                  onClick={() => removeLeave(emp.$id, leave.id)}
                                  disabled={periodClosed || saving}
                                  className="btn-remove-leave"
                                  aria-label="Remove leave"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()
            ) : (
              <div className="empty-state">
                Please select an employee from the dropdown above to enter historical data.
              </div>
            )}
          </div>
        )}

        <div className="form-actions">
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={
              saving || 
              loading || 
              periodClosed || 
              (viewMode === 'table' && Object.values(selected).every(s => !s)) ||
              (viewMode === 'dropdown' && !selectedEmployeeId)
            }
          >
            {saving ? 'Saving...' : 'Save Historical Data'}
          </button>
          {viewMode === 'dropdown' && selectedEmployeeId && (
            <button
              type="button"
              onClick={() => {
                setSelectedEmployeeId('')
                setSelected({})
              }}
              className="btn-secondary"
              disabled={saving || loading}
            >
              Clear & Select Another
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default HistoricalDataEntry
