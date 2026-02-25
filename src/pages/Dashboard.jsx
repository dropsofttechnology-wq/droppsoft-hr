import { useEffect, useState } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { getAttendanceStats, getPayrollStats } from '../services/dashboardService'
import './Dashboard.css'

const Dashboard = () => {
  const { currentCompany } = useCompany()
  const [stats, setStats] = useState({
    attendance: null,
    payroll: null
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentCompany) {
      loadStats()
    }
  }, [currentCompany])

  const loadStats = async () => {
    try {
      const [attendance, payroll] = await Promise.all([
        getAttendanceStats(currentCompany.$id),
        getPayrollStats(currentCompany.$id)
      ])
      setStats({ attendance, payroll })
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Loading dashboard...</div>
  }

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      
      {!currentCompany && (
        <div className="alert">
          Please select a company to view dashboard data.
        </div>
      )}

      {currentCompany && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Today's Attendance</h3>
            <div className="stat-value">
              {stats.attendance?.todayPresent || 0}
            </div>
            <div className="stat-label">Employees Present</div>
          </div>

          <div className="stat-card">
            <h3>This Month</h3>
            <div className="stat-value">
              {stats.attendance?.monthPresent || 0}
            </div>
            <div className="stat-label">Total Present Days</div>
          </div>

          <div className="stat-card">
            <h3>Payroll Status</h3>
            <div className="stat-value">
              {stats.payroll?.processed ? 'Processed' : 'Pending'}
            </div>
            <div className="stat-label">Current Period</div>
          </div>

          <div className="stat-card">
            <h3>Total Employees</h3>
            <div className="stat-value">
              {stats.payroll?.totalEmployees || 0}
            </div>
            <div className="stat-label">Active Employees</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
