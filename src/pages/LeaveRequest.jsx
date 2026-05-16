import { useState, useEffect, useRef, useCallback } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import { createLeaveRequest } from '../services/leaveService'
import { getLeaveTypes } from '../services/leaveService'
import { getEmployees } from '../services/employeeService'
import { calculateLeaveBalance } from '../services/leaveService'
import { format, addDays, isAfter, isBefore, parseISO, startOfDay } from 'date-fns'
import EmployeePicker from '../components/EmployeePicker'
import {
  BALANCE_DEDUCTION,
  getDefaultBalanceDeduction,
  normalizeBalanceDeductionInput
} from '../utils/leaveBalanceDeduction'
import { getCompanySettings } from '../utils/settingsHelper'
import './LeaveRequest.css'

const STAFF_ROLES = new Set(['admin', 'super_admin', 'manager', 'cashier'])

const LeaveRequest = () => {
  const { currentCompany } = useCompany()
  const { user } = useAuth()
  const role = user?.prefs?.role || 'employee'
  const canActOnBehalf = STAFF_ROLES.has(role)
  const [leaveTypes, setLeaveTypes] = useState([])
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [selectedLeaveType, setSelectedLeaveType] = useState('')
  const [leaveBalance, setLeaveBalance] = useState(null)
  /** When true, max bookable = current + next year pool; when false, current calendar year only (company setting). */
  const [annualLeaveRollover, setAnnualLeaveRollover] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    employee_id: '',
    leave_type: '',
    balance_deduction: '',
    start_date: '',
    end_date: '',
    reason: 'For personal reason'
  })

  useEffect(() => {
    if (currentCompany) {
      loadLeaveTypes()
      loadEmployees()
    }
  }, [currentCompany])

  useEffect(() => {
    if (!currentCompany) return
    let cancelled = false
    getCompanySettings(currentCompany.$id, ['annual_leave_rollover']).then((loaded) => {
      if (cancelled) return
      const v = loaded.annual_leave_rollover
      if (v == null) setAnnualLeaveRollover(true)
      else setAnnualLeaveRollover(v === true || v === 'true')
    })
    return () => {
      cancelled = true
    }
  }, [currentCompany])

  /** 21 days/year annual pool — shown for Annual leave, or Unpaid when taken from that pool. */
  const showAnnualEntitlementBalance =
    formData.leave_type?.toUpperCase() === 'ANNUAL' ||
    (formData.leave_type?.toUpperCase() === 'UNPAID' &&
      formData.balance_deduction === BALANCE_DEDUCTION.ANNUAL_BALANCE)

  const balanceLeaveCode = showAnnualEntitlementBalance ? 'ANNUAL' : null

  const loadLeaveBalance = useCallback(async () => {
    if (!formData.employee_id || !balanceLeaveCode || !currentCompany) return

    try {
      const employee = employees.find((emp) => emp.$id === formData.employee_id)
      const balance = await calculateLeaveBalance(
        formData.employee_id,
        balanceLeaveCode,
        currentCompany.$id,
        { employee: employee || undefined, leaveTypes: leaveTypes.length ? leaveTypes : undefined }
      )
      setLeaveBalance(balance)
    } catch (error) {
      console.error('Error loading leave balance:', error)
    }
  }, [formData.employee_id, balanceLeaveCode, currentCompany, employees, leaveTypes])

  const balanceDebounceRef = useRef(null)

  useEffect(() => {
    if (!formData.employee_id || !currentCompany) {
      setLeaveBalance(null)
      return
    }
    if (!showAnnualEntitlementBalance) {
      setLeaveBalance(null)
      return
    }
    if (balanceDebounceRef.current) clearTimeout(balanceDebounceRef.current)
    balanceDebounceRef.current = setTimeout(() => {
      balanceDebounceRef.current = null
      loadLeaveBalance()
    }, 320)
    return () => {
      if (balanceDebounceRef.current) clearTimeout(balanceDebounceRef.current)
    }
  }, [formData.employee_id, showAnnualEntitlementBalance, currentCompany, loadLeaveBalance])

  const loadLeaveTypes = async () => {
    if (!currentCompany) return

    try {
      const data = await getLeaveTypes(currentCompany.$id, true) // Active only
      setLeaveTypes(data)
    } catch (error) {
      console.error('Error loading leave types:', error)
    }
  }

  const loadEmployees = async () => {
    if (!currentCompany) return

    try {
      const data = await getEmployees(currentCompany.$id, { status: 'active' })
      setEmployees(data)
      
      // Auto-select employee if user is an employee
      const employee = data.find(emp => emp.user_id === user?.$id)
      if (employee) {
        setSelectedEmployee(employee)
        setFormData(prev => ({ ...prev, employee_id: employee.$id }))
      }
    } catch (error) {
      console.error('Error loading employees:', error)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target

    if (name === 'employee_id') {
      const employee = employees.find((emp) => emp.$id === value)
      setSelectedEmployee(employee)
      setFormData((prev) => ({ ...prev, employee_id: value }))
      return
    }

    if (name === 'leave_type') {
      const leaveTypeInfo = leaveTypes.find((lt) => String(lt.leave_code || '').toUpperCase() === String(value || '').toUpperCase())
      const leaveReason = leaveTypeInfo?.leave_name || (value ? `${String(value).toUpperCase()} leave` : 'For personal reason')
      setSelectedLeaveType(value)
      setFormData((prev) => ({
        ...prev,
        leave_type: value,
        balance_deduction: value ? getDefaultBalanceDeduction(value) : '',
        reason: leaveReason
      }))
      return
    }

    if (name === 'balance_deduction') {
      setFormData((prev) => ({ ...prev, balance_deduction: value }))
      return
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  const calculateDays = () => {
    if (!formData.start_date || !formData.end_date) return 0
    const start = new Date(formData.start_date)
    const end = new Date(formData.end_date)
    if (isAfter(start, end)) return 0
    const diffTime = Math.abs(end - start)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    return diffDays
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (!currentCompany) {
      setError('Please select a company first')
      setLoading(false)
      return
    }

    if (!formData.employee_id || !formData.leave_type || !formData.start_date || !formData.end_date) {
      setError('Please fill in all required fields')
      setLoading(false)
      return
    }

    // Enforce gender-based leave rules (e.g. maternity vs paternity)
    const leaveTypeData = leaveTypes.find(
      (lt) => lt.leave_code === formData.leave_type.toUpperCase()
    )
    const employee = employees.find((emp) => emp.$id === formData.employee_id)
    const gender = (employee?.gender || '').toLowerCase()

    const isMaternity =
      leaveTypeData &&
      (leaveTypeData.leave_code?.toUpperCase() === 'MATERNITY' ||
        leaveTypeData.leave_name?.toLowerCase().includes('maternity'))

    if (isMaternity && gender === 'male') {
      setError('Maternity leave can only be requested for female employees.')
      setLoading(false)
      return
    }

    // Validate dates
    const start = new Date(formData.start_date)
    const end = new Date(formData.end_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (!canActOnBehalf && isBefore(start, today)) {
      setError('Start date cannot be in the past')
      setLoading(false)
      return
    }

    const endLeaveDay = startOfDay(parseISO(formData.end_date))
    const todayStart = startOfDay(new Date())
    const isBackdatedLeave = canActOnBehalf && isBefore(endLeaveDay, todayStart)

    if (isAfter(start, end)) {
      setError('End date must be after start date')
      setLoading(false)
      return
    }

    const lt = formData.leave_type?.toUpperCase() || ''
    const bd = normalizeBalanceDeductionInput(formData.balance_deduction, lt)
    const usesAnnualPool =
      (lt === 'ANNUAL' && bd === BALANCE_DEDUCTION.ANNUAL_BALANCE) ||
      (lt === 'UNPAID' && bd === BALANCE_DEDUCTION.ANNUAL_BALANCE)

    // Enforce annual pool limit (admins may enter backdated leave without this check)
    if (leaveBalance && !isBackdatedLeave && usesAnnualPool) {
      const daysRequested = calculateDays()
      const cy = leaveBalance.current_year.available
      const ny = leaveBalance.next_year.available
      const maxDays = annualLeaveRollover ? cy + ny : cy
      if (daysRequested > maxDays) {
        setError(
          `You are requesting ${daysRequested} day(s) but only ${maxDays.toFixed(1)} day(s) ${
            annualLeaveRollover
              ? 'are available (current and next year pool combined)'
              : 'are available for this calendar year (annual leave rollover is off in company settings)'
          }. Reduce the date range or ask an administrator.`
        )
        setLoading(false)
        return
      }
    }

    try {
      await createLeaveRequest({
        ...formData,
        balance_deduction: bd,
        company_id: currentCompany.$id
      })
      setSuccess('Leave request submitted successfully!')
      setFormData({
        employee_id: canActOnBehalf ? '' : selectedEmployee?.$id || '',
        leave_type: '',
        balance_deduction: '',
        start_date: '',
        end_date: '',
        reason: 'For personal reason'
      })
      if (canActOnBehalf) {
        setSelectedEmployee(null)
      }
      setSelectedLeaveType('')
      setLeaveBalance(null)
    } catch (error) {
      setError(error.message || 'Failed to submit leave request')
    } finally {
      setLoading(false)
    }
  }

  const daysRequested = calculateDays()

  const ltForm = formData.leave_type?.toUpperCase() || ''
  const bdForm = normalizeBalanceDeductionInput(formData.balance_deduction, ltForm)
  const usesAnnualPoolForForm =
    (ltForm === 'ANNUAL' && bdForm === BALANCE_DEDUCTION.ANNUAL_BALANCE) ||
    (ltForm === 'UNPAID' && bdForm === BALANCE_DEDUCTION.ANNUAL_BALANCE)

  const endLeaveDayPreview = formData.end_date ? startOfDay(parseISO(formData.end_date)) : null
  const todayStartPreview = startOfDay(new Date())
  const isBackdatedLeavePreview =
    canActOnBehalf && endLeaveDayPreview && isBefore(endLeaveDayPreview, todayStartPreview)

  const currentCalendarYear = new Date().getFullYear()
  const nextCalendarYear = currentCalendarYear + 1
  const cyAvail = leaveBalance?.current_year?.available ?? 0
  const nyAvail = leaveBalance?.next_year?.available ?? 0
  const maxAnnualBookable =
    leaveBalance && showAnnualEntitlementBalance
      ? annualLeaveRollover
        ? cyAvail + nyAvail
        : cyAvail
      : null

  const remainingAfterRequest =
    usesAnnualPoolForForm && maxAnnualBookable != null ? Math.max(0, maxAnnualBookable - daysRequested) : null

  const exceedsAnnualLimit =
    usesAnnualPoolForForm &&
    leaveBalance &&
    maxAnnualBookable != null &&
    daysRequested > maxAnnualBookable &&
    !isBackdatedLeavePreview

  if (!currentCompany) {
    return (
      <div className="leave-request-page">
        <div className="alert alert-warning">
          Please select a company first to submit leave requests.
        </div>
      </div>
    )
  }

  return (
    <div className="leave-request-page">
      <div className="page-header">
        <h1>Submit Leave Request</h1>
      </div>

      <p className="page-description">
        {canActOnBehalf
          ? 'Submit leave for any employee, including past dates for catch-up records. Date fields allow any day when you use this form as an admin or manager. Approve and print from Leave management.'
          : 'Submit a leave request for approval. Your request will be reviewed by your manager.'}
      </p>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      <div className="leave-request-form-container">
        <form onSubmit={handleSubmit} className="leave-request-form">
          <div className="form-group">
            <label>Employee <span className="required">*</span></label>
            <EmployeePicker
              employees={employees}
              value={formData.employee_id}
              onChange={handleInputChange}
              name="employee_id"
              required
              disabled={!canActOnBehalf && !!selectedEmployee}
            />
            <p className="form-description">
              {canActOnBehalf ? 'Choose which employee this leave applies to.' : 'Select the employee requesting leave'}
            </p>
          </div>

          <div className="form-group">
            <label>Leave Type <span className="required">*</span></label>
            <select
              name="leave_type"
              value={formData.leave_type}
              onChange={handleInputChange}
              required
            >
              <option value="">Select Leave Type</option>
              {leaveTypes.map(lt => (
                <option key={lt.$id} value={lt.leave_code}>
                  {lt.leave_name} {lt.entitlement_days ? `(${lt.entitlement_days} days/year)` : ''}
                </option>
              ))}
            </select>
            <p className="form-description">Select the type of leave</p>
          </div>

          {formData.leave_type &&
            ['ANNUAL', 'UNPAID'].includes(formData.leave_type.toUpperCase()) && (
              <div className="form-group">
                <label>
                  How should this absence be applied? <span className="required">*</span>
                </label>
                <div className="balance-deduction-options">
                  <label className="radio-line">
                    <input
                      type="radio"
                      name="balance_deduction"
                      value={BALANCE_DEDUCTION.ANNUAL_BALANCE}
                      checked={formData.balance_deduction === BALANCE_DEDUCTION.ANNUAL_BALANCE}
                      onChange={handleInputChange}
                    />
                    <span>
                      Deduct from my annual leave balance (annual entitlement is applied per calendar year)
                    </span>
                  </label>
                  <label className="radio-line">
                    <input
                      type="radio"
                      name="balance_deduction"
                      value={BALANCE_DEDUCTION.SALARY}
                      checked={formData.balance_deduction === BALANCE_DEDUCTION.SALARY}
                      onChange={handleInputChange}
                    />
                    <span>Deduct from salary only (does not reduce annual leave days)</span>
                  </label>
                </div>
                <p className="form-description">
                  Annual leave normally uses your yearly entitlement. Unpaid leave can either use that entitlement or be
                  handled purely as a salary deduction, depending on your choice.
                </p>
              </div>
            )}

          {leaveBalance && showAnnualEntitlementBalance && (
            <div className="leave-balance-info">
              <h3>Annual leave balance ({currentCalendarYear})</h3>
              <p className="leave-balance-lead">
                Balance for <strong>{currentCalendarYear}</strong> is your annual entitlement minus approved leave that
                already consumed your annual pool in the same year.
              </p>
              <div className="balance-details">
                <div className="balance-item">
                  <span className="balance-label">Year entitlement ({currentCalendarYear}):</span>
                  <span className="balance-value">{(leaveBalance?.current_year?.accrued ?? 0).toFixed(1)} days</span>
                </div>
                <div className="balance-item">
                  <span className="balance-label">Already used ({currentCalendarYear}):</span>
                  <span className="balance-value">{(leaveBalance?.current_year?.used ?? 0).toFixed(1)} days</span>
                </div>
                <div className="balance-item highlight">
                  <span className="balance-label">Available this year ({currentCalendarYear}):</span>
                  <span className="balance-value">{cyAvail.toFixed(1)} days</span>
                </div>
                <div className="balance-item">
                  <span className="balance-label">Next calendar year ({nextCalendarYear}) pool (approved leave there):</span>
                  <span className="balance-value">{nyAvail.toFixed(1)} days</span>
                </div>
                {usesAnnualPoolForForm && (
                  <div className="balance-item total">
                    <span className="balance-label">
                      {annualLeaveRollover
                        ? 'Maximum you can request (combined):'
                        : 'Maximum you can request (this year only):'}
                    </span>
                    <span className="balance-value">
                      {maxAnnualBookable != null ? maxAnnualBookable.toFixed(1) : '—'} days
                    </span>
                  </div>
                )}
              </div>
              {usesAnnualPoolForForm && !annualLeaveRollover && (
                <p className="leave-balance-note">
                  This company does not allow using next year&apos;s entitlement when booking leave — requests cannot
                  exceed this year&apos;s available days.
                </p>
              )}
              <p className="leave-balance-note">
                Year-end reset: unused annual leave days do not carry forward; each new calendar year starts with that
                year&apos;s entitlement and approved usage for that same year only.
              </p>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Start Date <span className="required">*</span></label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleInputChange}
                {...(!canActOnBehalf ? { min: format(new Date(), 'yyyy-MM-dd') } : {})}
                required
              />
              <p className="form-description">
                {canActOnBehalf ? 'First day of leave (past dates allowed for records)' : 'First day of leave'}
              </p>
            </div>

            <div className="form-group">
              <label>End Date <span className="required">*</span></label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleInputChange}
                {...(formData.start_date
                  ? { min: formData.start_date }
                  : canActOnBehalf
                    ? {}
                    : { min: format(new Date(), 'yyyy-MM-dd') })}
                required
              />
              <p className="form-description">Last day of leave</p>
            </div>
          </div>

          {formData.start_date && formData.end_date && (
            <div className={`days-calculated${exceedsAnnualLimit ? ' days-calculated--over-limit' : ''}`}>
              <strong>Days requested: {daysRequested}</strong>
              {usesAnnualPoolForForm && leaveBalance && maxAnnualBookable != null && (
                <span className="days-vs-balance">
                  {' '}
                  / max {maxAnnualBookable.toFixed(1)} day(s) available
                </span>
              )}
              {usesAnnualPoolForForm && remainingAfterRequest != null && (
                <div className="days-vs-balance">
                  Balance after this request: <strong>{remainingAfterRequest.toFixed(1)}</strong> day(s)
                </div>
              )}
              {exceedsAnnualLimit && (
                <div className="days-limit-error" role="alert">
                  Reduce the range or switch to &quot;Deduct from salary only&quot; if applicable. Submission is blocked
                  until days requested are within your balance.
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label>Reason</label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleInputChange}
              rows="4"
              placeholder="Leave type will auto-fill here"
            />
            <p className="form-description">Provide a reason for your leave request</p>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || exceedsAnnualLimit}
            >
              {loading ? 'Submitting...' : 'Submit Leave Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LeaveRequest
