import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import { getEmployees } from '../services/employeeService'
import { createSalaryAdvanceRequest } from '../services/salaryAdvanceService'
import { isLocalDataSource } from '../config/dataSource'
import { installmentPlanMatchesTotal, parseInstallmentPlan } from '../utils/moneySplit'
import EmployeePicker from '../components/EmployeePicker'
import './SalaryAdvanceRequest.css'

const STAFF_ROLES = new Set(['admin', 'super_admin', 'manager', 'cashier'])

const SalaryAdvanceRequest = () => {
  const { currentCompany } = useCompany()
  const { user } = useAuth()
  const role = user?.prefs?.role || 'employee'
  const canManage = STAFF_ROLES.has(role)
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    employee_id: '',
    amount: '',
    reason: 'For personal reason',
    repayment_period: '',
    for_period: '',
    application_date: '',
    installment_count: '',
    installment_plan: ''
  })

  useEffect(() => {
    if (currentCompany && isLocalDataSource()) {
      loadEmployees()
    }
  }, [currentCompany])

  const loadEmployees = async () => {
    if (!currentCompany) return
    try {
      const data = await getEmployees(currentCompany.$id, { status: 'active' })
      setEmployees(data)
      const linked = data.find((emp) => emp.user_id === user?.$id)
      if (linked && !canManage) {
        setSelectedEmployee(linked)
        setFormData((prev) => ({ ...prev, employee_id: linked.$id }))
      } else if (canManage) {
        setSelectedEmployee(null)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'application_date' && value && canManage && !prev.for_period) {
        next.for_period = value.slice(0, 7)
      }
      return next
    })
    if (name === 'employee_id') {
      const emp = employees.find((x) => x.$id === value)
      setSelectedEmployee(emp || null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!currentCompany) {
      setError('Please select a company first')
      return
    }
    const amount = Number.parseFloat(String(formData.amount).replace(/,/g, ''))
    if (!formData.employee_id || !Number.isFinite(amount) || amount <= 0) {
      setError('Employee and a valid amount are required')
      return
    }
    const customPlan = parseInstallmentPlan(formData.installment_plan)
    if (formData.installment_plan?.trim()) {
      if (!customPlan.length) {
        setError('Custom installment amounts must contain positive values separated by commas.')
        return
      }
      if (!installmentPlanMatchesTotal(customPlan, amount)) {
        setError('Custom installment amounts must add up exactly to the amount requested.')
        return
      }
    }
    setLoading(true)
    try {
      const payload = {
        company_id: currentCompany.$id,
        employee_id: formData.employee_id,
        amount,
        reason: formData.reason,
        repayment_period: formData.repayment_period
      }
      if (formData.application_date) {
        payload.application_date = formData.application_date
      }
      if (canManage && formData.for_period) {
        payload.for_period = formData.for_period
      }
      if (canManage && formData.installment_count) {
        payload.installment_count = parseInt(String(formData.installment_count), 10)
      }
      if (formData.installment_plan?.trim()) {
        payload.installment_plan = formData.installment_plan.trim()
      }
      await createSalaryAdvanceRequest(payload)
      setSuccess('Salary advance request submitted for approval.')
      setFormData({
        employee_id: canManage ? '' : selectedEmployee?.$id || '',
        amount: '',
        reason: 'For personal reason',
        repayment_period: '',
        for_period: '',
        application_date: '',
        installment_count: '',
        installment_plan: ''
      })
    } catch (err) {
      setError(err.message || 'Failed to submit')
    } finally {
      setLoading(false)
    }
  }

  if (!isLocalDataSource()) {
    return (
      <div className="salary-advance-request-page">
        <div className="alert alert-warning">
          Salary advance requests are only available in the desktop (local SQLite) app.
        </div>
      </div>
    )
  }

  if (!currentCompany) {
    return (
      <div className="salary-advance-request-page">
        <div className="alert alert-warning">Please select a company first.</div>
      </div>
    )
  }

  return (
    <div className="salary-advance-request-page">
      <div className="page-header">
        <h1>Request salary advance</h1>
      </div>
      <p className="page-description">
        Submit a request for payroll to review. When an approver <strong>approves</strong>, the advance is split across
        monthly instalments into payroll deductions (net pay), visible on payslips and reports. You can note the{' '}
        <strong>application date</strong> and repayment wording; admins set the exact first payroll month and number of
        instalments at approval. Shopping amounts for past months still use{' '}
        <Link to="/attendance/historical">Historical data entry</Link>.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit} className="sar-form">
        <div className="form-group">
          <label>
            Employee <span className="required">*</span>
          </label>
          <EmployeePicker
            employees={employees}
            value={formData.employee_id}
            onChange={handleChange}
            name="employee_id"
            required
            disabled={!!selectedEmployee && !canManage}
          />
        </div>

        <div className="form-group">
          <label>
            Date of application <span className="optional">(optional)</span>
          </label>
          <input type="date" name="application_date" value={formData.application_date} onChange={handleChange} />
          <p className="form-hint">
            When the money was advanced (e.g. 15 Mar). The first payroll month usually matches this month unless you set
            otherwise below.
          </p>
        </div>

        {canManage ? (
          <>
            <div className="form-group">
              <label>
                First payroll month for deductions <span className="optional">(optional)</span>
              </label>
              <input
                type="month"
                name="for_period"
                value={formData.for_period}
                onChange={handleChange}
                max={format(new Date(), 'yyyy-MM')}
              />
              <p className="form-hint">First month that receives an instalment (defaults from application date if empty).</p>
            </div>
            <div className="form-group">
              <label>
                Number of monthly instalments <span className="optional">(optional)</span>
              </label>
              <input
                type="number"
                name="installment_count"
                min={1}
                max={60}
                value={formData.installment_count}
                onChange={handleChange}
                placeholder="e.g. 3"
              />
              <p className="form-hint">Override repayment text; approver can change this again when approving.</p>
            </div>
          </>
        ) : null}

        <div className="form-group">
          <label>
            Amount (KES) <span className="required">*</span>
          </label>
          <input
            type="text"
            name="amount"
            value={formData.amount}
            onChange={handleChange}
            inputMode="decimal"
            placeholder="e.g. 15000"
            required
          />
        </div>

        <div className="form-group">
          <label>Repayment / deductions note</label>
          <input
            type="text"
            name="repayment_period"
            value={formData.repayment_period}
            onChange={handleChange}
            placeholder="e.g. 3 monthly instalments from net pay"
          />
        </div>

        <div className="form-group">
          <label>
            Custom installment amounts <span className="optional">(optional)</span>
          </label>
          <textarea
            name="installment_plan"
            value={formData.installment_plan}
            onChange={handleChange}
            rows={3}
            placeholder="Example: 10000, 5000, 5000, 5000, 5000"
          />
          <p className="form-hint">
            Enter comma-separated amounts to set an exact schedule (first value is first month). Total must equal the
            advance amount.
          </p>
        </div>

        <div className="form-group">
          <label>Purpose</label>
          <textarea
            name="reason"
            value={formData.reason}
            onChange={handleChange}
            rows={4}
            placeholder="For personal reason"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default SalaryAdvanceRequest
