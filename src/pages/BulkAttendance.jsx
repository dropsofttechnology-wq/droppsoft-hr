import { useState, useEffect, useMemo } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { getEmployees } from '../services/employeeService'
import { applyBulkDefaultAttendance } from '../services/attendanceService'
import { isPeriodClosed } from '../services/periodClosureService'
import { getHolidays } from '../services/holidayService'
import { format, parseISO, eachDayOfInterval, isWeekend, isSameDay } from 'date-fns'
import { filterEmployeesByQuery } from '../utils/employeePickerUtils'
import './BulkAttendance.css'

const BulkAttendance = () => {
  const { currentCompany } = useCompany()
  const [employees, setEmployees] = useState([])
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [includeWeekends, setIncludeWeekends] = useState(false)
  const [includeHolidays, setIncludeHolidays] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [periodClosed, setPeriodClosed] = useState(null)
  const [holidays, setHolidays] = useState([])
  const [loadingHolidays, setLoadingHolidays] = useState(false)
  const [empFilter, setEmpFilter] = useState('')
  /** yyyy-MM-dd → company was open for bulk present */
  const [openDays, setOpenDays] = useState({})

  const filteredEmployees = useMemo(
    () => filterEmployeesByQuery(employees, empFilter),
    [employees, empFilter]
  )

  const filteredBulkIds = useMemo(
    () => filteredEmployees.map((e) => e.user_id || e.$id),
    [filteredEmployees]
  )

  const allFilteredSelected =
    filteredBulkIds.length > 0 && filteredBulkIds.every((id) => selectedEmployeeIds.includes(id))

  useEffect(() => {
    if (currentCompany) {
      loadEmployees()
    }
  }, [currentCompany])

  useEffect(() => {
    if (currentCompany && startDate) {
      checkPeriodClosure()
    }
  }, [currentCompany, startDate])

  useEffect(() => {
    if (currentCompany && startDate && endDate) {
      loadHolidays()
    } else {
      setHolidays([])
    }
  }, [currentCompany, startDate, endDate])

  const checkPeriodClosure = async () => {
    if (!startDate || !currentCompany) return
    try {
      const period = format(parseISO(startDate), 'yyyy-MM')
      const closed = await isPeriodClosed(currentCompany.$id, period)
      setPeriodClosed(closed)
    } catch (error) {
      console.error('Error checking period closure:', error)
      setPeriodClosed(null)
    }
  }

  const loadEmployees = async () => {
    try {
      const data = await getEmployees(currentCompany.$id, { status: 'active' })
      setEmployees(data)
    } catch (e) {
      setError('Failed to load employees')
    }
  }

  const loadHolidays = async () => {
    if (!currentCompany || !startDate || !endDate) return
    try {
      setLoadingHolidays(true)
      const start = parseISO(startDate)
      const end = parseISO(endDate)
      const y0 = start.getFullYear()
      const y1 = end.getFullYear()
      const years = []
      for (let y = y0; y <= y1; y++) years.push(y)

      const merged = []
      for (const year of years) {
        const part = await getHolidays(currentCompany.$id, { year: String(year), status: 'active' })
        merged.push(...part)
      }
      const seen = new Set()
      const rangeHolidays = merged.filter((h) => {
        const holidayDate = parseISO(h.holiday_date)
        if (holidayDate < start || holidayDate > end) return false
        const id = h.$id || h.id || h.holiday_date
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })

      setHolidays(rangeHolidays)
    } catch (e) {
      console.error('Failed to load holidays:', e)
      setHolidays([])
    } finally {
      setLoadingHolidays(false)
    }
  }

  const toggleEmployee = (id) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedEmployeeIds((prev) => prev.filter((id) => !filteredBulkIds.includes(id)))
    } else {
      setSelectedEmployeeIds((prev) => {
        const next = new Set(prev)
        filteredBulkIds.forEach((id) => next.add(id))
        return [...next]
      })
    }
  }

  const daysInRange = useMemo(() => {
    if (!startDate || !endDate) return []
    try {
      const start = parseISO(startDate)
      const end = parseISO(endDate)
      if (end < start) return []
      return eachDayOfInterval({ start, end })
    } catch {
      return []
    }
  }, [startDate, endDate])

  const holidayDateSet = useMemo(() => new Set(holidays.map((h) => h.holiday_date)), [holidays])

  const defaultOpenForDay = (day) => {
    const ds = format(day, 'yyyy-MM-dd')
    if (!includeWeekends && isWeekend(day)) return false
    if (!includeHolidays && holidayDateSet.has(ds)) return false
    return true
  }

  useEffect(() => {
    if (!daysInRange.length) {
      setOpenDays({})
      return
    }
    const next = {}
    for (const day of daysInRange) {
      const ds = format(day, 'yyyy-MM-dd')
      let open = true
      if (!includeWeekends && isWeekend(day)) open = false
      if (!includeHolidays && holidayDateSet.has(ds)) open = false
      next[ds] = open
    }
    setOpenDays(next)
  }, [daysInRange, includeWeekends, includeHolidays, holidayDateSet])

  const openDaysSelectedCount = useMemo(() => {
    if (!daysInRange.length) return 0
    return daysInRange.filter((day) => openDays[format(day, 'yyyy-MM-dd')]).length
  }, [openDays, daysInRange])

  const toggleOpenDay = (ds) => {
    setOpenDays((prev) => ({ ...prev, [ds]: !prev[ds] }))
  }

  const resetOpenDaysToDefaults = () => {
    if (!daysInRange.length) return
    const next = {}
    for (const day of daysInRange) {
      const ds = format(day, 'yyyy-MM-dd')
      next[ds] = defaultOpenForDay(day)
    }
    setOpenDays(next)
  }

  const selectAllOpenDays = () => {
    if (!daysInRange.length) return
    const next = {}
    for (const day of daysInRange) {
      next[format(day, 'yyyy-MM-dd')] = true
    }
    setOpenDays(next)
  }

  const clearAllOpenDays = () => {
    if (!daysInRange.length) return
    const next = {}
    for (const day of daysInRange) {
      next[format(day, 'yyyy-MM-dd')] = false
    }
    setOpenDays(next)
  }

  const weekendDaysCount = useMemo(
    () => daysInRange.filter((d) => isWeekend(d)).length,
    [daysInRange]
  )

  /** Turn on all Saturday/Sunday checkboxes in the range (weekdays unchanged). */
  const selectAllWeekendDays = () => {
    if (!daysInRange.length) return
    setOpenDays((prev) => {
      const next = { ...prev }
      for (const day of daysInRange) {
        if (isWeekend(day)) {
          next[format(day, 'yyyy-MM-dd')] = true
        }
      }
      return next
    })
  }

  /** Turn off all weekend checkboxes in the range. */
  const clearWeekendDays = () => {
    if (!daysInRange.length) return
    setOpenDays((prev) => {
      const next = { ...prev }
      for (const day of daysInRange) {
        if (isWeekend(day)) {
          next[format(day, 'yyyy-MM-dd')] = false
        }
      }
      return next
    })
  }

  // Calculate weekend days and holidays in the date range
  const dateRangeInfo = useMemo(() => {
    if (!startDate || !endDate) return { weekendDays: [], holidayDays: [], allDays: [] }
    
    try {
      const start = parseISO(startDate)
      const end = parseISO(endDate)
      const allDays = eachDayOfInterval({ start, end })
      
      const weekendDays = allDays.filter(day => isWeekend(day))
      const holidayDays = allDays.filter(day => {
        return holidays.some(holiday => isSameDay(parseISO(holiday.holiday_date), day))
      })
      
      return { weekendDays, holidayDays, allDays }
    } catch (e) {
      return { weekendDays: [], holidayDays: [], allDays: [] }
    }
  }, [startDate, endDate, holidays])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!currentCompany) {
      setError('Please select a company first.')
      return
    }
    if (!startDate || !endDate) {
      setError('Please select start and end dates.')
      return
    }
    if (selectedEmployeeIds.length === 0) {
      setError('Please select at least one employee.')
      return
    }

    const datesToInclude = daysInRange
      .map((day) => format(day, 'yyyy-MM-dd'))
      .filter((ds) => openDays[ds])
    if (datesToInclude.length === 0) {
      setError('Select at least one company open day (use the checklist below).')
      return
    }

    // Check if period is closed
    const period = format(parseISO(startDate), 'yyyy-MM')
    const closed = await isPeriodClosed(currentCompany.$id, period)
    if (closed) {
      setError(`Cannot modify attendance. Period ${period} is closed. Please reopen the period first or select a different date range.`)
      return
    }

    try {
      setLoading(true)
      const res = await applyBulkDefaultAttendance({
        companyId: currentCompany.$id,
        employeeIds: selectedEmployeeIds,
        startDate,
        endDate,
        includeWeekends,
        includeHolidays,
        datesToInclude
      })
      const skipPart =
        res.skippedOnLeave > 0
          ? ` Skipped ${res.skippedOnLeave} employee-day(s) (approved leave).`
          : ''
      const created = res.created ?? 0
      setSuccess(
        created > 0
          ? `Bulk attendance: ${created} new record(s) created for ${datesToInclude.length} company open day(s).${skipPart}`
          : `No new attendance rows were inserted (all combinations already exist or were skipped for leave). Open days: ${datesToInclude.length}.${skipPart}`
      )
      setTimeout(() => setSuccess(''), 4000)
    } catch (e) {
      setError(e.message || 'Failed to apply bulk attendance')
    } finally {
      setLoading(false)
    }
  }

  if (!currentCompany) {
    return (
      <div className="bulk-attendance-page">
        <div className="alert alert-warning">
          Please select a company first to manage attendance.
        </div>
      </div>
    )
  }

  return (
    <div className="bulk-attendance-page">
      <div className="page-header">
        <h1>Bulk Default Attendance</h1>
      </div>

      <p className="page-description">
        Apply full attendance for a past period for selected employees. This is
        ideal for companies that do not use the live attendance terminal.
      </p>

      {periodClosed && (
        <div className="alert alert-warning">
          <strong>Period Closed:</strong> The period {format(parseISO(startDate), 'yyyy-MM')} is closed. Bulk attendance cannot be applied to closed periods.
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit} className="bulk-attendance-form">
        <div className="form-row">
          <div className="form-group">
            <label>
              Start Date <span className="required">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>
              End Date <span className="required">*</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group checkbox-group bulk-weekend-default">
            <label>
              <input
                type="checkbox"
                checked={includeWeekends}
                onChange={(e) => setIncludeWeekends(e.target.checked)}
              />
              <span>
                Pre-check weekend days (Sat–Sun) as open
                {dateRangeInfo.weekendDays.length > 0 && (
                  <span className="date-count"> ({dateRangeInfo.weekendDays.length} in range)</span>
                )}
              </span>
            </label>
            <p className="form-hint-inline">
              Off by default. You can still include any weekend using <strong>Select weekend days</strong> below or by
              ticking individual days.
            </p>
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={includeHolidays}
                onChange={(e) => setIncludeHolidays(e.target.checked)}
              />
              Include holidays
              {dateRangeInfo.holidayDays.length > 0 && (
                <span className="date-count"> ({dateRangeInfo.holidayDays.length} days)</span>
              )}
            </label>
          </div>
        </div>

        {/* Display weekend days and holidays */}
        {(dateRangeInfo.weekendDays.length > 0 || dateRangeInfo.holidayDays.length > 0) && (
          <div className="date-range-info">
            <h3>Available Dates in Range</h3>
            {dateRangeInfo.weekendDays.length > 0 && (
              <div className="date-group">
                <div className="date-group-header">
                  <span className="date-type-badge weekend">Weekend Days</span>
                  <span className="date-count-badge">{dateRangeInfo.weekendDays.length} days</span>
                </div>
                <div className="date-list">
                  {dateRangeInfo.weekendDays.map((day, idx) => {
                    const dayStr = format(day, 'yyyy-MM-dd')
                    const holiday = holidays.find(h => h.holiday_date === dayStr)
                    return (
                      <div key={idx} className="date-item weekend">
                        <span className="date-day">{format(day, 'EEE, MMM d')}</span>
                        {holiday && (
                          <span className="date-holiday-note"> (Also a holiday: {holiday.holiday_name})</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {dateRangeInfo.holidayDays.length > 0 && (
              <div className="date-group">
                <div className="date-group-header">
                  <span className="date-type-badge holiday">Holidays</span>
                  <span className="date-count-badge">{dateRangeInfo.holidayDays.length} days</span>
                </div>
                <div className="date-list">
                  {dateRangeInfo.holidayDays.map((day, idx) => {
                    const dayStr = format(day, 'yyyy-MM-dd')
                    const holiday = holidays.find(h => h.holiday_date === dayStr)
                    const isWeekendDay = isWeekend(day)
                    return (
                      <div key={idx} className={`date-item holiday ${isWeekendDay ? 'also-weekend' : ''}`}>
                        <span className="date-day">{format(day, 'EEE, MMM d')}</span>
                        {holiday && (
                          <span className="date-holiday-name">{holiday.holiday_name}</span>
                        )}
                        {isWeekendDay && (
                          <span className="date-weekend-note"> (Also a weekend)</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {loadingHolidays && (
              <div className="loading-indicator">Loading holidays...</div>
            )}
          </div>
        )}

        {daysInRange.length > 0 && (
          <div className="bulk-open-days-panel">
            <div className="bulk-open-days-header">
              <h3>Company open days</h3>
              <p className="bulk-open-days-lead">
                Bulk attendance is created only for checked days ({openDaysSelectedCount} selected). Weekends can be
                included even when &quot;Pre-check weekend days&quot; above is off — use the weekend buttons or tick each
                Saturday/Sunday.
              </p>
              <div className="bulk-open-days-actions">
                <button type="button" className="btn-secondary btn-sm" onClick={resetOpenDaysToDefaults}>
                  Reset to defaults
                </button>
                <button type="button" className="btn-secondary btn-sm" onClick={selectAllOpenDays}>
                  Select all days in range
                </button>
                <button type="button" className="btn-secondary btn-sm" onClick={clearAllOpenDays}>
                  Clear all
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm btn-weekend-select"
                  onClick={selectAllWeekendDays}
                  disabled={weekendDaysCount === 0}
                  title="Check every Saturday and Sunday in the date range"
                >
                  Select weekend days
                  {weekendDaysCount > 0 ? ` (${weekendDaysCount})` : ''}
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={clearWeekendDays}
                  disabled={weekendDaysCount === 0}
                  title="Uncheck every Saturday and Sunday"
                >
                  Clear weekend days
                </button>
              </div>
            </div>
            <ul className="bulk-open-days-list" aria-label="Company open days">
              {daysInRange.map((day) => {
                const ds = format(day, 'yyyy-MM-dd')
                const on = !!openDays[ds]
                const hol = holidays.find((h) => h.holiday_date === ds)
                const wk = isWeekend(day)
                return (
                  <li key={ds}>
                    <label className="bulk-open-day-row">
                      <input type="checkbox" checked={on} onChange={() => toggleOpenDay(ds)} />
                      <span className="bulk-open-day-label">
                        <span className="bulk-open-day-dow">{format(day, 'EEE')}</span>
                        <span className="bulk-open-day-date">{format(day, 'MMM d, yyyy')}</span>
                        {wk && <span className="bulk-open-day-tag weekend">Weekend</span>}
                        {hol && <span className="bulk-open-day-tag holiday">{hol.holiday_name || 'Holiday'}</span>}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="employees-selector">
          <div className="selector-header">
            <h2>Select Employees</h2>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleSelectAll}
              disabled={filteredEmployees.length === 0}
            >
              {allFilteredSelected ? 'Deselect shown' : 'Select all shown'}
            </button>
          </div>
          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="bulk-emp-filter">Filter employees</label>
            <input
              id="bulk-emp-filter"
              type="search"
              className="bulk-emp-filter-input"
              placeholder="Type to filter by name, ID, department…"
              value={empFilter}
              onChange={(e) => setEmpFilter(e.target.value)}
              autoComplete="off"
            />
          </div>
          {employees.length === 0 ? (
            <p className="empty-state">
              No employees found. Add employees first.
            </p>
          ) : filteredEmployees.length === 0 ? (
            <p className="empty-state">No employees match your filter.</p>
          ) : (
            <div className="employees-list">
              {filteredEmployees.map((emp) => {
                const id = emp.user_id || emp.$id
                const selected = selectedEmployeeIds.includes(id)
                return (
                  <div
                    key={emp.$id}
                    className={`employee-item ${
                      selected ? 'selected' : ''
                    }`}
                    onClick={() => toggleEmployee(id)}
                  >
                    <div className="employee-name">{emp.name}</div>
                    <div className="employee-meta">
                      <span>{emp.employee_id || emp.staff_no || '-'}</span>
                      {emp.department && <span> • {emp.department}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={
              loading ||
              employees.length === 0 ||
              !startDate ||
              !endDate ||
              selectedEmployeeIds.length === 0 ||
              openDaysSelectedCount === 0 ||
              !!periodClosed
            }
          >
            {loading ? 'Applying...' : 'Apply Default Attendance'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default BulkAttendance

