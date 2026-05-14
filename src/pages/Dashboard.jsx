import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import { getAttendanceStats, getPayrollStats } from '../services/dashboardService'
import { getEmployees } from '../services/employeeService'
import { getLeaveRequests, approveLeaveRequest, rejectLeaveRequest } from '../services/leaveService'
import {
  getSalaryAdvanceRequests,
  approveSalaryAdvanceRequest
} from '../services/salaryAdvanceService'
import { getShoppingRequests, approveShoppingRequest } from '../services/shoppingService'
import { getOperationalExpensesSummary } from '../services/schoolOperationalExpensesService'
import { isLocalDataSource } from '../config/dataSource'
import { hasPermission } from '../utils/permissions'
import { format } from 'date-fns'
import './Dashboard.css'

const Dashboard = () => {
  const { currentCompany } = useCompany()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    attendance: null,
    payroll: null,
    employees: []
  })
  const [loading, setLoading] = useState(true)
  const [pendingLeaves, setPendingLeaves] = useState([])
  const [pendingAdvances, setPendingAdvances] = useState([])
  const [pendingShoppings, setPendingShoppings] = useState([])
  const [expenseSummary, setExpenseSummary] = useState(null)
  const [expenseSummaryMonth, setExpenseSummaryMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [approvalModal, setApprovalModal] = useState(null)
  const [busyActionKey, setBusyActionKey] = useState('')
  const [leavePage, setLeavePage] = useState(1)
  const [advancePage, setAdvancePage] = useState(1)
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('pending')
  const [advanceStatusFilter, setAdvanceStatusFilter] = useState('pending')
  const [leaveDateFilter, setLeaveDateFilter] = useState('all')
  const [advanceDateFilter, setAdvanceDateFilter] = useState('all')
  const [leaveSearch, setLeaveSearch] = useState('')
  const [advanceSearch, setAdvanceSearch] = useState('')

  const role = String(user?.prefs?.role || '').toLowerCase()
  const canApprove = ['admin', 'super_admin', 'manager'].includes(role)
  const canApproveShopping = canApprove
  const modalPageSize = 8

  const matchesDateWindow = (dateValue, windowKey) => {
    if (windowKey === 'all') return true
    if (!dateValue) return false
    const d = new Date(dateValue)
    if (Number.isNaN(d.getTime())) return false
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const DAY_MS = 24 * 60 * 60 * 1000
    if (windowKey === 'today') return d >= startOfToday
    if (windowKey === '7d') return now.getTime() - d.getTime() <= 7 * DAY_MS
    if (windowKey === '30d') return now.getTime() - d.getTime() <= 30 * DAY_MS
    if (windowKey === 'year') return d.getFullYear() === now.getFullYear()
    return true
  }

  useEffect(() => {
    if (currentCompany) {
      loadStats()
    } else {
      setLoading(false)
    }
  }, [currentCompany, canApprove, canApproveShopping, user, expenseSummaryMonth])

  const loadStats = async () => {
    try {
      setLoading(true)
      const [attendance, payroll, employees] = await Promise.all([
        getAttendanceStats(currentCompany.$id),
        getPayrollStats(currentCompany.$id),
        getEmployees(currentCompany.$id, { status: 'active' })
      ])
      setStats({ attendance, payroll, employees })

      if (canApprove) {
        const tasks = [getLeaveRequests(currentCompany.$id, { status: 'all' })]
        if (isLocalDataSource()) {
          tasks.push(getSalaryAdvanceRequests(currentCompany.$id, { status: 'all' }))
          if (canApproveShopping) {
            tasks.push(getShoppingRequests(currentCompany.$id, { status: 'all' }))
          }
        }
        const [leaveRows, advanceRows = [], shoppingRows = []] = await Promise.all(tasks)
        setPendingLeaves(Array.isArray(leaveRows) ? leaveRows : [])
        setPendingAdvances(Array.isArray(advanceRows) ? advanceRows : [])
        setPendingShoppings(Array.isArray(shoppingRows) ? shoppingRows : [])
      } else {
        setPendingLeaves([])
        setPendingAdvances([])
        setPendingShoppings([])
      }

      if (
        isLocalDataSource() &&
        currentCompany?.$id &&
        (hasPermission(user, 'operational_expenses') ||
          hasPermission(user, 'operational_expenses_approval'))
      ) {
        try {
          const s = await getOperationalExpensesSummary(currentCompany.$id, expenseSummaryMonth)
          setExpenseSummary(s)
        } catch {
          setExpenseSummary(null)
        }
      } else {
        setExpenseSummary(null)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const getAttendanceRate = () => {
    if (!stats.attendance || !stats.employees.length) return 0
    const expected = stats.attendance.expectedAttendanceToday ?? stats.employees.length
    const todayRate = expected > 0 ? (stats.attendance.todayPresent / expected) * 100 : 0
    return Math.round(todayRate)
  }

  const getRecentEmployees = () => {
    return stats.employees.slice(0, 5)
  }

  const employeeNameMap = useMemo(() => {
    const m = new Map()
    for (const e of stats.employees || []) {
      m.set(String(e.$id), e.name || e.full_name || e.employee_name || e.employee_id || 'Employee')
    }
    return m
  }, [stats.employees])

  const filteredLeaves = useMemo(() => {
    if (leaveStatusFilter === 'all') return pendingLeaves
    return pendingLeaves.filter((r) => String(r.status || '').toLowerCase() === leaveStatusFilter)
  }, [pendingLeaves, leaveStatusFilter])

  const dateFilteredLeaves = useMemo(
    () =>
      filteredLeaves.filter((r) =>
        matchesDateWindow(r.approved_at || r.updated_at || r.created_at || r.application_date || r.start_date, leaveDateFilter)
      ),
    [filteredLeaves, leaveDateFilter]
  )

  const searchedLeaves = useMemo(() => {
    const q = leaveSearch.trim().toLowerCase()
    if (!q) return dateFilteredLeaves
    return dateFilteredLeaves.filter((r) => {
      const employeeName = (employeeNameMap.get(String(r.employee_id)) || r.employee_name || '').toLowerCase()
      return employeeName.includes(q)
    })
  }, [dateFilteredLeaves, leaveSearch, employeeNameMap])

  const filteredAdvances = useMemo(() => {
    if (advanceStatusFilter === 'all') return pendingAdvances
    return pendingAdvances.filter((r) => String(r.status || '').toLowerCase() === advanceStatusFilter)
  }, [pendingAdvances, advanceStatusFilter])

  const dateFilteredAdvances = useMemo(
    () => filteredAdvances.filter((r) => matchesDateWindow(r.approved_at || r.updated_at || r.created_at || r.application_date, advanceDateFilter)),
    [filteredAdvances, advanceDateFilter]
  )

  const searchedAdvances = useMemo(() => {
    const q = advanceSearch.trim().toLowerCase()
    if (!q) return dateFilteredAdvances
    return dateFilteredAdvances.filter((r) => {
      const employeeName = (employeeNameMap.get(String(r.employee_id)) || r.employee_name || '').toLowerCase()
      return employeeName.includes(q)
    })
  }, [dateFilteredAdvances, advanceSearch, employeeNameMap])

  const pendingLeavesCount = pendingLeaves.filter((r) => String(r.status || '').toLowerCase() === 'pending').length
  const pendingAdvancesCount = pendingAdvances.filter((r) => String(r.status || '').toLowerCase() === 'pending').length
  const pendingShoppingsCount = pendingShoppings.filter((r) => String(r.status || '').toLowerCase() === 'pending').length

  const leaveTotalPages = Math.max(1, Math.ceil(searchedLeaves.length / modalPageSize))
  const advanceTotalPages = Math.max(1, Math.ceil(searchedAdvances.length / modalPageSize))
  const safeLeavePage = Math.min(leavePage, leaveTotalPages)
  const safeAdvancePage = Math.min(advancePage, advanceTotalPages)
  const leaveStart = (safeLeavePage - 1) * modalPageSize
  const advanceStart = (safeAdvancePage - 1) * modalPageSize
  const leaveModalRows = searchedLeaves.slice(leaveStart, leaveStart + modalPageSize)
  const advanceModalRows = searchedAdvances.slice(advanceStart, advanceStart + modalPageSize)

  const closeApprovalModal = () => {
    if (!busyActionKey) {
      setApprovalModal(null)
      setLeavePage(1)
      setAdvancePage(1)
      setLeaveStatusFilter('pending')
      setAdvanceStatusFilter('pending')
      setLeaveDateFilter('all')
      setAdvanceDateFilter('all')
      setLeaveSearch('')
      setAdvanceSearch('')
    }
  }

  const onApproveLeave = async (requestId) => {
    const key = `leave-approve-${requestId}`
    setBusyActionKey(key)
    try {
      await approveLeaveRequest(requestId, user?.$id)
      toast.success('Leave approved')
      await loadStats()
    } catch (e) {
      toast.error(e.message || 'Failed to approve leave')
    } finally {
      setBusyActionKey('')
    }
  }

  const onRejectLeave = async (requestId) => {
    const key = `leave-reject-${requestId}`
    setBusyActionKey(key)
    try {
      await rejectLeaveRequest(requestId, user?.$id)
      toast.success('Leave rejected')
      await loadStats()
    } catch (e) {
      toast.error(e.message || 'Failed to reject leave')
    } finally {
      setBusyActionKey('')
    }
  }

  const onApproveAdvance = async (requestId) => {
    const key = `advance-approve-${requestId}`
    setBusyActionKey(key)
    try {
      await approveSalaryAdvanceRequest(requestId, 'approved')
      toast.success('Salary advance approved')
      await loadStats()
    } catch (e) {
      toast.error(e.message || 'Failed to approve salary advance')
    } finally {
      setBusyActionKey('')
    }
  }

  const onRejectAdvance = async (requestId) => {
    const key = `advance-reject-${requestId}`
    setBusyActionKey(key)
    try {
      await approveSalaryAdvanceRequest(requestId, 'rejected')
      toast.success('Salary advance rejected')
      await loadStats()
    } catch (e) {
      toast.error(e.message || 'Failed to reject salary advance')
    } finally {
      setBusyActionKey('')
    }
  }

  const onApproveShopping = async (requestId) => {
    const key = `shopping-approve-${requestId}`
    setBusyActionKey(key)
    try {
      await approveShoppingRequest(requestId, 'approved')
      toast.success('Shopping request approved')
      await loadStats()
    } catch (e) {
      toast.error(e.message || 'Failed to approve shopping request')
    } finally {
      setBusyActionKey('')
    }
  }

  const onRejectShopping = async (requestId) => {
    const key = `shopping-reject-${requestId}`
    setBusyActionKey(key)
    try {
      await approveShoppingRequest(requestId, 'rejected')
      toast.success('Shopping request rejected')
      await loadStats()
    } catch (e) {
      toast.error(e.message || 'Failed to reject shopping request')
    } finally {
      setBusyActionKey('')
    }
  }

  const resetLeaveFilters = () => {
    setLeaveSearch('')
    setLeaveStatusFilter('pending')
    setLeaveDateFilter('all')
    setLeavePage(1)
  }

  const resetAdvanceFilters = () => {
    setAdvanceSearch('')
    setAdvanceStatusFilter('pending')
    setAdvanceDateFilter('all')
    setAdvancePage(1)
  }

  const csvEscape = (value) => {
    const raw = value == null ? '' : String(value)
    if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`
    return raw
  }

  const toCsvDateTime = (value) => {
    if (!value) return ''
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return String(value)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const downloadCsv = (filename, headers, rows) => {
    const lines = [headers.join(',')]
    for (const row of rows) {
      lines.push(row.map(csvEscape).join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const safeFilePart = (value, fallback = 'all') => {
    const v = String(value || '').trim().toLowerCase()
    if (!v) return fallback
    const cleaned = v.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    return cleaned || fallback
  }

  const exportLeaveCsv = () => {
    const headers = [
      'Employee',
      'Leave Type',
      'Days',
      'Start Date',
      'End Date',
      'Status',
      'Requested At',
      'Approver',
      'Approved At',
      'Rejected At',
      'Rejection Reason'
    ]
    const rows = searchedLeaves.map((r) => [
      employeeNameMap.get(String(r.employee_id)) || r.employee_name || '',
      r.leave_type || '',
      Number(r.days_requested || 0),
      r.start_date || '',
      r.end_date || '',
      r.status || '',
      toCsvDateTime(r.application_date || r.created_at || ''),
      r.approver_name || r.approved_by || '',
      toCsvDateTime(r.approved_at || ''),
      toCsvDateTime(r.rejected_at || ''),
      r.rejection_reason || ''
    ])
    const status = safeFilePart(leaveStatusFilter, 'all')
    const date = safeFilePart(leaveDateFilter, 'all-time')
    const search = leaveSearch.trim() ? `-${safeFilePart(leaveSearch, 'search')}` : ''
    downloadCsv(`leave-${status}-${date}${search}.csv`, headers, rows)
  }

  const exportAdvanceCsv = () => {
    const headers = [
      'Employee',
      'Amount',
      'Installments',
      'First Payroll Month',
      'Application Date',
      'Status',
      'Approver',
      'Approved At',
      'Rejected At',
      'Rejection Reason'
    ]
    const rows = searchedAdvances.map((r) => [
      employeeNameMap.get(String(r.employee_id)) || r.employee_name || '',
      Number(r.amount || 0),
      r.installment_count != null ? r.installment_count : '',
      r.for_period || '',
      toCsvDateTime(r.application_date || r.created_at || ''),
      r.status || '',
      r.approver_name || r.approved_by || '',
      toCsvDateTime(r.approved_at || ''),
      toCsvDateTime(r.rejected_at || ''),
      r.rejection_reason || ''
    ])
    const status = safeFilePart(advanceStatusFilter, 'all')
    const date = safeFilePart(advanceDateFilter, 'all-time')
    const search = advanceSearch.trim() ? `-${safeFilePart(advanceSearch, 'search')}` : ''
    downloadCsv(`salary-advance-${status}-${date}${search}.csv`, headers, rows)
  }

  if (!currentCompany) {
    return (
      <div className="dashboard">
        <h1>Dashboard</h1>
        <div className="alert alert-warning">
          <strong>No Company Selected</strong>
          <p>Please select a company from the Companies page to view dashboard data.</p>
          <button className="btn-primary" onClick={() => navigate('/companies')} style={{ marginTop: '1rem' }}>
            Go to Companies
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="dashboard">
        <h1>Dashboard</h1>
        <div className="loading">Loading dashboard data...</div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="dashboard-subtitle">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="dashboard-actions">
          <button className="btn-primary" onClick={() => navigate('/attendance/terminal')}>
            Attendance Terminal
          </button>
        </div>
      </div>

      {canApprove && (
        <div className="dashboard-section approval-inbox-section">
          <h2>Approval Inbox</h2>
          <div className="approval-inbox-grid">
            <button
              type="button"
              className="approval-inbox-card approval-inbox-leave"
              onClick={() => {
                setLeavePage(1)
                setApprovalModal('leave')
              }}
            >
              <div className="approval-inbox-head">
                <span className="approval-icon">🏖️</span>
                <strong>Leave Management</strong>
              </div>
              <div className="approval-inbox-count">{pendingLeavesCount}</div>
              <div className="approval-inbox-meta">Pending leave requests</div>
            </button>

            <button
              type="button"
              className="approval-inbox-card approval-inbox-advance"
              onClick={() => {
                setAdvancePage(1)
                setApprovalModal('advance')
              }}
              disabled={!isLocalDataSource()}
              title={!isLocalDataSource() ? 'Salary advance approvals are available in local desktop mode.' : ''}
            >
              <div className="approval-inbox-head">
                <span className="approval-icon">💸</span>
                <strong>Salary Advance Manager</strong>
              </div>
              <div className="approval-inbox-count">{pendingAdvancesCount}</div>
              <div className="approval-inbox-meta">Pending salary advance requests</div>
            </button>
            {canApproveShopping && (
              <button
                type="button"
                className="approval-inbox-card approval-inbox-advance"
                onClick={() => setApprovalModal('shopping')}
                disabled={!isLocalDataSource()}
                title={!isLocalDataSource() ? 'Shopping approvals are available in local desktop mode.' : ''}
              >
                <div className="approval-inbox-head">
                  <span className="approval-icon">🛒</span>
                  <strong>Shopping Manager</strong>
                </div>
                <div className="approval-inbox-count">{pendingShoppingsCount}</div>
                <div className="approval-inbox-meta">Pending shopping requests</div>
              </button>
            )}
          </div>
        </div>
      )}

      {isLocalDataSource() &&
        currentCompany &&
        expenseSummary &&
        (hasPermission(user, 'operational_expenses') ||
          hasPermission(user, 'operational_expenses_approval')) && (
          <div className="dashboard-section school-expense-summary-section">
            <div className="school-expense-summary-heading">
              <h2>School operational spend</h2>
              <label className="school-expense-month-label">
                Month (paid total)
                <input
                  type="month"
                  value={expenseSummaryMonth}
                  onChange={(e) => setExpenseSummaryMonth(e.target.value)}
                />
              </label>
            </div>
            <p className="dashboard-section-lead">
              Track institutional costs separately from payroll. Open the expenses page to add drafts,
              approve, and mark as paid. <strong>Draft count</strong> is all outstanding drafts;{' '}
              <strong>Paid total</strong> uses the month you select.
            </p>
            <div className="school-expense-summary-grid">
              {hasPermission(user, 'operational_expenses_approval') && (
                <button
                  type="button"
                  className="school-expense-card"
                  onClick={() => navigate('/school/operational-expenses')}
                >
                  <div className="school-expense-card-head">
                    <span className="school-expense-icon" aria-hidden="true">
                      🏫
                    </span>
                    <strong>Draft expenses</strong>
                  </div>
                  <div className="school-expense-stat">{expenseSummary.draft_count}</div>
                  <div className="school-expense-meta">Awaiting approval</div>
                </button>
              )}
              {hasPermission(user, 'operational_expenses') && (
                <div className="school-expense-card school-expense-card--readonly">
                  <div className="school-expense-card-head">
                    <span className="school-expense-icon" aria-hidden="true">
                      💳
                    </span>
                    <strong>Paid this month</strong>
                  </div>
                  <div className="school-expense-stat">
                    {Number(expenseSummary.paid_month_total || 0).toLocaleString()}
                  </div>
                  <div className="school-expense-meta">{expenseSummary.month} (paid date)</div>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Key Statistics */}
      <div className="stats-grid">
        <div className="stat-card stat-card-primary">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>Total Employees</h3>
            <div className="stat-value">{stats.employees.length || 0}</div>
            <div className="stat-label">Active Staff</div>
          </div>
        </div>

        <div className="stat-card stat-card-attendance-expected">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <h3>Expected Attendance Today</h3>
            <div className="stat-value">{stats.attendance?.expectedAttendanceToday ?? stats.employees.length ?? 0}</div>
            <div className="stat-label">
              Staff expected at work today
              {stats.attendance?.staffOnLeaveToday > 0 && (
                <span className="stat-sublabel-inline"> (excl. leave)</span>
              )}
            </div>
          </div>
        </div>

        <div className="stat-card stat-card-leave">
          <div className="stat-icon">🏖️</div>
          <div className="stat-content">
            <h3>Staff on Leave Today</h3>
            <div className="stat-value">{stats.attendance?.staffOnLeaveToday ?? 0}</div>
            <div className="stat-label">Approved leave today</div>
            {(stats.attendance?.staffOnLeaveToday ?? 0) > 0 && (
              <div className="stat-leave-indicators" title={`${stats.attendance.staffOnLeaveToday} staff on leave`}>
                {Array.from({ length: Math.min(stats.attendance.staffOnLeaveToday, 15) }).map((_, i) => (
                  <span key={i} className="stat-leave-dot" aria-hidden="true" />
                ))}
                {stats.attendance.staffOnLeaveToday > 15 && (
                  <span className="stat-leave-more">+{stats.attendance.staffOnLeaveToday - 15}</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="stat-card stat-card-success">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>Today's Attendance</h3>
            <div className="stat-value">{stats.attendance?.todayPresent || 0}</div>
            <div className="stat-label">
              {stats.employees.length > 0 
                ? `${getAttendanceRate()}% Present (${(stats.attendance?.expectedAttendanceToday ?? stats.employees.length) - (stats.attendance?.todayPresent || 0)} absent)`
                : 'No attendance yet'}
            </div>
            {(stats.attendance?.todayOnTime != null || stats.attendance?.todayLate != null) && (stats.attendance?.todayOnTime > 0 || stats.attendance?.todayLate > 0) && (
              <div className="stat-sublabel">
                {stats.attendance.todayOnTime ?? 0} on time · {stats.attendance.todayLate ?? 0} late
              </div>
            )}
          </div>
        </div>

        <div className="stat-card stat-card-info">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>This Month</h3>
            <div className="stat-value">{stats.attendance?.totalDaysPresent || 0}</div>
            <div className="stat-label">
              {stats.attendance?.attendanceRate 
                ? `${stats.attendance.attendanceRate}% Attendance Rate`
                : 'Total Present Days'}
            </div>
            {stats.attendance?.expectedAttendanceDays > 0 && (
              <div className="stat-sublabel">
                Expected: {stats.attendance.expectedAttendanceDays} days
                {stats.attendance?.totalLeaveDays > 0 && (
                  <span> ({stats.attendance.totalLeaveDays} on leave)</span>
                )}
              </div>
            )}
            {stats.attendance?.averageDaysPerEmployee > 0 && (
              <div className="stat-sublabel">
                Avg: {stats.attendance.averageDaysPerEmployee} days/employee
              </div>
            )}
          </div>
        </div>

        <div className="stat-card stat-card-warning">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>Payroll Status</h3>
            <div className="stat-value-small">
              {stats.payroll?.processed ? '✓ Processed' : 'Pending'}
            </div>
            <div className="stat-label">
              {format(new Date(), 'MMMM yyyy')}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dashboard-section">
        <h2>Quick Actions</h2>
        <div className="quick-actions">
          <button className="action-card" onClick={() => navigate('/employees')}>
            <div className="action-icon">➕</div>
            <div className="action-text">
              <strong>Add Employee</strong>
              <span>Register a new employee</span>
            </div>
          </button>
          <button className="action-card" onClick={() => navigate('/attendance/enrollment')}>
            <div className="action-icon">📸</div>
            <div className="action-text">
              <strong>Face Enrollment</strong>
              <span>Enroll employee face data</span>
            </div>
          </button>
          <button className="action-card" onClick={() => navigate('/payroll')}>
            <div className="action-icon">💵</div>
            <div className="action-text">
              <strong>Process Payroll</strong>
              <span>Calculate and process payroll</span>
            </div>
          </button>
          <button className="action-card" onClick={() => navigate('/reports')}>
            <div className="action-icon">📊</div>
            <div className="action-text">
              <strong>Generate Reports</strong>
              <span>Create statutory reports</span>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Employees */}
      {stats.employees.length > 0 && (
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Recent Employees</h2>
            <button className="btn-secondary" onClick={() => navigate('/employees')}>
              View All
            </button>
          </div>
          <div className="employees-list">
            {getRecentEmployees().map(employee => (
              <div key={employee.$id} className="employee-item">
                <div className="employee-avatar">
                  {employee.name.charAt(0).toUpperCase()}
                </div>
                <div className="employee-info">
                  <strong>{employee.name}</strong>
                  <span>{employee.department || 'No Department'}</span>
                </div>
                <div className="employee-salary">
                  KES {parseFloat(employee.basic_salary || 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Company Info */}
      <div className="dashboard-section">
        <h2>Company Information</h2>
        <div className="company-info-card">
          <div className="info-row">
            <span className="info-label">Company Name:</span>
            <span className="info-value">{currentCompany.name}</span>
          </div>
          {currentCompany.registration_number && (
            <div className="info-row">
              <span className="info-label">Registration:</span>
              <span className="info-value">{currentCompany.registration_number}</span>
            </div>
          )}
          {currentCompany.email && (
            <div className="info-row">
              <span className="info-label">Email:</span>
              <span className="info-value">{currentCompany.email}</span>
            </div>
          )}
          {currentCompany.phone && (
            <div className="info-row">
              <span className="info-label">Phone:</span>
              <span className="info-value">{currentCompany.phone}</span>
            </div>
          )}
        </div>
      </div>

      {approvalModal === 'leave' && (
        <div className="approval-modal-overlay" role="dialog" aria-modal="true" onClick={closeApprovalModal}>
          <div className="approval-modal" onClick={(e) => e.stopPropagation()}>
            <div className="approval-modal-header">
              <h3>Leave Requests</h3>
              <button type="button" className="approval-modal-close" onClick={closeApprovalModal} disabled={!!busyActionKey}>
                Close
              </button>
            </div>
            <div className="approval-filter-row">
              <label className="approval-search-field">
                Employee
                <input
                  type="text"
                  value={leaveSearch}
                  onChange={(e) => {
                    setLeaveSearch(e.target.value)
                    setLeavePage(1)
                  }}
                  placeholder="Search employee name"
                />
              </label>
              <label>
                Status
                <select
                  value={leaveStatusFilter}
                  onChange={(e) => {
                    setLeaveStatusFilter(e.target.value)
                    setLeavePage(1)
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="all">All</option>
                </select>
              </label>
              <label>
                Date
                <select
                  value={leaveDateFilter}
                  onChange={(e) => {
                    setLeaveDateFilter(e.target.value)
                    setLeavePage(1)
                  }}
                >
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="year">This year</option>
                </select>
              </label>
              <button type="button" className="approval-reset-btn" onClick={resetLeaveFilters}>
                Reset filters
              </button>
              <button
                type="button"
                className="approval-export-btn"
                onClick={exportLeaveCsv}
                disabled={searchedLeaves.length === 0}
              >
                Export CSV
              </button>
            </div>
            {leaveModalRows.length === 0 ? (
              <p className="approval-empty">No {leaveStatusFilter} leave requests.</p>
            ) : (
              <>
                <p className="approval-results-meta">
                  Showing <strong>{leaveModalRows.length}</strong> of <strong>{searchedLeaves.length}</strong> records
                  {searchedLeaves.length !== pendingLeaves.length ? (
                    <>
                      {' '}
                      (filtered from <strong>{pendingLeaves.length}</strong> total)
                    </>
                  ) : null}
                </p>
                <div className="approval-list">
                  {leaveModalRows.map((r) => (
                    <div key={r.$id} className="approval-item">
                      <div className="approval-item-main">
                        <strong>{employeeNameMap.get(String(r.employee_id)) || r.employee_name || 'Employee'}</strong>
                        <span>{r.leave_type || 'Leave'} • {Number(r.days_requested || 0)} day(s)</span>
                      </div>
                      {String(r.status || '').toLowerCase() === 'pending' && (
                        <div className="approval-item-actions">
                          <button
                            type="button"
                            className="approval-btn approval-btn-approve"
                            onClick={() => onApproveLeave(r.$id)}
                            disabled={busyActionKey === `leave-approve-${r.$id}` || busyActionKey === `leave-reject-${r.$id}`}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="approval-btn approval-btn-reject"
                            onClick={() => onRejectLeave(r.$id)}
                            disabled={busyActionKey === `leave-approve-${r.$id}` || busyActionKey === `leave-reject-${r.$id}`}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {leaveTotalPages > 1 && (
                  <div className="approval-pagination">
                    <button
                      type="button"
                      className="approval-page-btn"
                      onClick={() => setLeavePage((p) => Math.max(1, p - 1))}
                      disabled={safeLeavePage <= 1}
                    >
                      Previous
                    </button>
                    <span>
                      Page {safeLeavePage} of {leaveTotalPages}
                    </span>
                    <button
                      type="button"
                      className="approval-page-btn"
                      onClick={() => setLeavePage((p) => Math.min(leaveTotalPages, p + 1))}
                      disabled={safeLeavePage >= leaveTotalPages}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
            <button type="button" className="approval-btn-link" onClick={() => navigate('/leave')}>
              Open full Leave Management
            </button>
          </div>
        </div>
      )}

      {approvalModal === 'advance' && (
        <div className="approval-modal-overlay" role="dialog" aria-modal="true" onClick={closeApprovalModal}>
          <div className="approval-modal" onClick={(e) => e.stopPropagation()}>
            <div className="approval-modal-header">
              <h3>Salary Advance Requests</h3>
              <button type="button" className="approval-modal-close" onClick={closeApprovalModal} disabled={!!busyActionKey}>
                Close
              </button>
            </div>
            <div className="approval-filter-row">
              <label className="approval-search-field">
                Employee
                <input
                  type="text"
                  value={advanceSearch}
                  onChange={(e) => {
                    setAdvanceSearch(e.target.value)
                    setAdvancePage(1)
                  }}
                  placeholder="Search employee name"
                />
              </label>
              <label>
                Status
                <select
                  value={advanceStatusFilter}
                  onChange={(e) => {
                    setAdvanceStatusFilter(e.target.value)
                    setAdvancePage(1)
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="voided">Voided</option>
                  <option value="all">All</option>
                </select>
              </label>
              <label>
                Date
                <select
                  value={advanceDateFilter}
                  onChange={(e) => {
                    setAdvanceDateFilter(e.target.value)
                    setAdvancePage(1)
                  }}
                >
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="year">This year</option>
                </select>
              </label>
              <button type="button" className="approval-reset-btn" onClick={resetAdvanceFilters}>
                Reset filters
              </button>
              <button
                type="button"
                className="approval-export-btn"
                onClick={exportAdvanceCsv}
                disabled={searchedAdvances.length === 0}
              >
                Export CSV
              </button>
            </div>
            {advanceModalRows.length === 0 ? (
              <p className="approval-empty">No {advanceStatusFilter} salary advance requests.</p>
            ) : (
              <>
                <p className="approval-results-meta">
                  Showing <strong>{advanceModalRows.length}</strong> of <strong>{searchedAdvances.length}</strong> records
                  {searchedAdvances.length !== pendingAdvances.length ? (
                    <>
                      {' '}
                      (filtered from <strong>{pendingAdvances.length}</strong> total)
                    </>
                  ) : null}
                </p>
                <div className="approval-list">
                  {advanceModalRows.map((r) => (
                    <div key={r.$id} className="approval-item">
                      <div className="approval-item-main">
                        <strong>{employeeNameMap.get(String(r.employee_id)) || 'Employee'}</strong>
                        <span>KES {Number(r.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                      {String(r.status || '').toLowerCase() === 'pending' && (
                        <div className="approval-item-actions">
                          <button
                            type="button"
                            className="approval-btn approval-btn-approve"
                            onClick={() => onApproveAdvance(r.$id)}
                            disabled={busyActionKey === `advance-approve-${r.$id}` || busyActionKey === `advance-reject-${r.$id}`}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="approval-btn approval-btn-reject"
                            onClick={() => onRejectAdvance(r.$id)}
                            disabled={busyActionKey === `advance-approve-${r.$id}` || busyActionKey === `advance-reject-${r.$id}`}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {advanceTotalPages > 1 && (
                  <div className="approval-pagination">
                    <button
                      type="button"
                      className="approval-page-btn"
                      onClick={() => setAdvancePage((p) => Math.max(1, p - 1))}
                      disabled={safeAdvancePage <= 1}
                    >
                      Previous
                    </button>
                    <span>
                      Page {safeAdvancePage} of {advanceTotalPages}
                    </span>
                    <button
                      type="button"
                      className="approval-page-btn"
                      onClick={() => setAdvancePage((p) => Math.min(advanceTotalPages, p + 1))}
                      disabled={safeAdvancePage >= advanceTotalPages}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
            <button type="button" className="approval-btn-link" onClick={() => navigate('/salary-advance')}>
              Open full Salary Advance Management
            </button>
          </div>
        </div>
      )}
      {approvalModal === 'shopping' && canApproveShopping && (
        <div className="approval-modal-overlay" role="dialog" aria-modal="true" onClick={closeApprovalModal}>
          <div className="approval-modal" onClick={(e) => e.stopPropagation()}>
            <div className="approval-modal-header">
              <h3>Shopping Requests</h3>
              <button type="button" className="approval-modal-close" onClick={closeApprovalModal} disabled={!!busyActionKey}>
                Close
              </button>
            </div>
            {pendingShoppings.length === 0 ? (
              <p className="approval-empty">No shopping requests available.</p>
            ) : (
              <div className="approval-list">
                {pendingShoppings.map((r) => (
                  <div key={r.$id} className="approval-item">
                    <div className="approval-item-main">
                      <strong>{employeeNameMap.get(String(r.employee_id)) || 'Employee'}</strong>
                      <span>
                        KES {Number(r.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} • {r.status || 'pending'}
                      </span>
                    </div>
                    {String(r.status || '').toLowerCase() === 'pending' && (
                      <div className="approval-item-actions">
                        <button
                          type="button"
                          className="approval-btn approval-btn-approve"
                          onClick={() => onApproveShopping(r.$id)}
                          disabled={busyActionKey === `shopping-approve-${r.$id}` || busyActionKey === `shopping-reject-${r.$id}`}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="approval-btn approval-btn-reject"
                          onClick={() => onRejectShopping(r.$id)}
                          disabled={busyActionKey === `shopping-approve-${r.$id}` || busyActionKey === `shopping-reject-${r.$id}`}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="approval-btn-link" onClick={() => navigate('/shopping')}>
              Open full Shopping Management
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
