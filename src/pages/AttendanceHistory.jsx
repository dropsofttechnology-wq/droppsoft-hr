import { useState, useEffect } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import { getEmployees } from '../services/employeeService'
import { listAttendanceRecords } from '../services/attendanceService'
import { getCompanySettings } from '../utils/settingsHelper'
import { isPeriodClosed } from '../services/periodClosureService'
import { isClockInOnTime } from '../utils/attendanceHelper'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import EmployeePicker from '../components/EmployeePicker'
import './AttendanceHistory.css'

const AttendanceHistory = () => {
  const { currentCompany } = useCompany()
  const { user } = useAuth()
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState(format(new Date(), 'yyyy-MM'))
  const [summary, setSummary] = useState(null)
  const [periodClosed, setPeriodClosed] = useState(null)
  const [reportingSettings, setReportingSettings] = useState({})

  useEffect(() => {
    if (currentCompany) {
      loadEmployees()
      getCompanySettings(currentCompany.$id, ['official_reporting_time', 'reporting_grace_minutes']).then(s => setReportingSettings(s || {}))
    }
  }, [currentCompany])

  useEffect(() => {
    if (currentCompany && period) {
      checkPeriodClosure()
    }
  }, [currentCompany, period])

  useEffect(() => {
    if (selectedEmployee && period) {
      loadAttendanceHistory()
    }
  }, [selectedEmployee, period])

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

  const loadEmployees = async () => {
    try {
      const data = await getEmployees(currentCompany.$id, { status: 'active' })

      const role = user?.prefs?.role || 'admin'
      if (role !== 'admin' && role !== 'super_admin' && role !== 'manager') {
        // Employee view: try to find their own employee record by user_id or email
        const self =
          data.find((emp) => emp.user_id === user.$id) ||
          data.find((emp) => emp.email && emp.email.toLowerCase() === user.email.toLowerCase())

        if (self) {
          setEmployees([self])
          setSelectedEmployee(self)
          return
        }
      }

      setEmployees(data)
    } catch (error) {
      console.error('Error loading employees:', error)
    }
  }

  const loadAttendanceHistory = async () => {
    if (!selectedEmployee) return

    try {
      setLoading(true)
      const userId = selectedEmployee.user_id || selectedEmployee.$id
      const periodStart = startOfMonth(parseISO(`${period}-01`))
      const periodEnd = endOfMonth(periodStart)

      const response = await listAttendanceRecords({
        companyId: currentCompany.$id,
        userId,
        from: format(periodStart, 'yyyy-MM-dd'),
        to: format(periodEnd, 'yyyy-MM-dd')
      })

      const records = response.sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      )

      setAttendanceRecords(records)

      // Calculate summary
      const totalDays = records.length
      const presentDays = records.filter(r => r.clock_in_time && r.clock_out_time).length
      const totalHours = records.reduce((sum, r) => sum + (parseFloat(r.hours_worked) || 0), 0)
      const overtimeHours = records.reduce((sum, r) => sum + (parseFloat(r.overtime_hours) || 0), 0)

      setSummary({
        totalDays,
        presentDays,
        absentDays: totalDays - presentDays,
        totalHours: totalHours.toFixed(2),
        overtimeHours: overtimeHours.toFixed(2)
      })
    } catch (error) {
      console.error('Error loading attendance history:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!currentCompany) {
    return (
      <div className="attendance-history-page">
        <div className="alert alert-warning">
          Please select a company first.
        </div>
      </div>
    )
  }

  return (
    <div className="attendance-history-page">
      <div className="page-header">
        <h1>Attendance History</h1>
      </div>

      {periodClosed && (
        <div className="alert alert-warning">
          <strong>Period Closed:</strong> The period {period} is closed. Attendance records are read-only.
        </div>
      )}

      <div className="attendance-filters">
        <div className="filter-group">
          <label>Employee:</label>
          <EmployeePicker
            employees={employees}
            value={selectedEmployee?.$id || ''}
            onChange={(e) => {
              const emp = employees.find((x) => x.$id === e.target.value)
              setSelectedEmployee(emp || null)
            }}
            selectPlaceholder="All employees"
          />
        </div>

        <div className="filter-group">
          <label>Period:</label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
      </div>

      {summary && (
        <div className="attendance-summary">
          <div className="summary-card">
            <div className="summary-label">Total Days</div>
            <div className="summary-value">{summary.totalDays}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Present Days</div>
            <div className="summary-value success">{summary.presentDays}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Absent Days</div>
            <div className="summary-value error">{summary.absentDays}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Total Hours</div>
            <div className="summary-value">{summary.totalHours}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Overtime Hours</div>
            <div className="summary-value">{summary.overtimeHours}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading attendance records...</div>
      ) : attendanceRecords.length === 0 ? (
        <div className="empty-state">
          {selectedEmployee 
            ? 'No attendance records found for this period.'
            : 'Please select an employee to view attendance history.'}
        </div>
      ) : (
        <div className="attendance-table-container">
          <table className="attendance-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Reporting</th>
                <th>Hours Worked</th>
                <th>Overtime</th>
                <th>Method</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRecords.map(record => {
                const clockIn = record.clock_in_time 
                  ? format(parseISO(record.clock_in_time), 'HH:mm:ss')
                  : '-'
                const clockOut = record.clock_out_time
                  ? format(parseISO(record.clock_out_time), 'HH:mm:ss')
                  : '-'
                const hours = parseFloat(record.hours_worked || 0).toFixed(2)
                const overtime = parseFloat(record.overtime_hours || 0).toFixed(2)
                const status = record.clock_in_time && record.clock_out_time 
                  ? 'Present' 
                  : record.clock_in_time 
                    ? 'Incomplete' 
                    : 'Absent'
                const onTime = record.clock_in_time && isClockInOnTime(record.clock_in_time, record.date, reportingSettings)
                const reportingLabel = record.clock_in_time ? (onTime ? 'On time' : 'Late') : '-'

                return (
                  <tr key={record.$id}>
                    <td>{format(parseISO(record.date), 'dd MMM yyyy')}</td>
                    <td>{clockIn}</td>
                    <td>{clockOut}</td>
                    <td>
                      {record.clock_in_time ? (
                        <span className={`reporting-badge reporting-${onTime ? 'on-time' : 'late'}`}>
                          {reportingLabel}
                        </span>
                      ) : '-'}
                    </td>
                    <td>{hours}</td>
                    <td>{overtime}</td>
                    <td>
                      <span className={`method-badge method-${record.auth_method}`}>
                        {record.auth_method || 'manual'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge status-${status.toLowerCase()}`}>
                        {status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default AttendanceHistory
