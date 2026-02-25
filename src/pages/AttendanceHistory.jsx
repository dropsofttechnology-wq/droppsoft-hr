import { useState, useEffect } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { getEmployees } from '../services/employeeService'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { Query } from 'appwrite'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import './AttendanceHistory.css'

const AttendanceHistory = () => {
  const { currentCompany } = useCompany()
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState(format(new Date(), 'yyyy-MM'))
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    if (currentCompany) {
      loadEmployees()
    }
  }, [currentCompany])

  useEffect(() => {
    if (selectedEmployee && period) {
      loadAttendanceHistory()
    }
  }, [selectedEmployee, period])

  const loadEmployees = async () => {
    try {
      const data = await getEmployees(currentCompany.$id, { status: 'active' })
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

      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.ATTENDANCE,
        [
          Query.equal('user_id', userId),
          Query.greaterThanEqual('date', format(periodStart, 'yyyy-MM-dd')),
          Query.lessThanEqual('date', format(periodEnd, 'yyyy-MM-dd')),
          Query.limit(5000)
        ]
      )

      const records = response.documents.sort((a, b) => 
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

      <div className="attendance-filters">
        <div className="filter-group">
          <label>Employee:</label>
          <select
            value={selectedEmployee?.$id || ''}
            onChange={(e) => {
              const emp = employees.find(e => e.$id === e.target.value)
              setSelectedEmployee(emp || null)
            }}
          >
            <option value="">Select Employee</option>
            {employees.map(emp => (
              <option key={emp.$id} value={emp.$id}>
                {emp.name} {emp.employee_id ? `(${emp.employee_id})` : ''}
              </option>
            ))}
          </select>
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

                return (
                  <tr key={record.$id}>
                    <td>{format(parseISO(record.date), 'dd MMM yyyy')}</td>
                    <td>{clockIn}</td>
                    <td>{clockOut}</td>
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
