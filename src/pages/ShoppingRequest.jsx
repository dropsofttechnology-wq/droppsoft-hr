import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import { getEmployees } from '../services/employeeService'
import { createShoppingRequest } from '../services/shoppingService'
import { isLocalDataSource } from '../config/dataSource'
import { installmentPlanMatchesTotal, parseInstallmentPlan } from '../utils/moneySplit'
import EmployeePicker from '../components/EmployeePicker'
import './ShoppingRequest.css'

const STAFF_ROLES = new Set(['admin', 'super_admin', 'manager', 'cashier', 'hod'])
const EMPTY_ITEM = { item_code: '', qty: '1', unit_price: '' }

const ShoppingRequest = () => {
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
    amount: '0',
    reason: 'For personal reason',
    repayment_period: '',
    for_period: '',
    application_date: '',
    installment_count: '',
    installment_plan: ''
  })
  const [itemLines, setItemLines] = useState([{ ...EMPTY_ITEM }])

  useEffect(() => {
    if (currentCompany && isLocalDataSource()) {
      loadEmployees()
    }
  }, [currentCompany])

  useEffect(() => {
    const total = itemLines.reduce((sum, line) => {
      const qty = Number.parseFloat(String(line.qty || ''))
      const unitPrice = Number.parseFloat(String(line.unit_price || ''))
      if (!Number.isFinite(qty) || !Number.isFinite(unitPrice) || qty <= 0 || unitPrice < 0) return sum
      return sum + qty * unitPrice
    }, 0)
    setFormData((prev) => ({ ...prev, amount: (Math.round(total * 100) / 100).toString() }))
  }, [itemLines])

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
    const normalizedItems = itemLines
      .map((line) => ({
        item_code: String(line.item_code || '').trim(),
        qty: Number.parseFloat(String(line.qty || '')),
        unit_price: Number.parseFloat(String(line.unit_price || ''))
      }))
      .filter((line) => line.item_code && Number.isFinite(line.qty) && line.qty > 0 && Number.isFinite(line.unit_price) && line.unit_price >= 0)
    const amount =
      Math.round(
        normalizedItems.reduce((sum, line) => sum + line.qty * line.unit_price, 0) * 100
      ) / 100
    if (!formData.employee_id || !Number.isFinite(amount) || amount <= 0) {
      setError('Employee and valid shopping item lines are required')
      return
    }
    if (!String(formData.reason || '').trim()) {
      setError('Narration is required before submitting a shopping request')
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
        reason: String(formData.reason || '').trim(),
        repayment_period: formData.repayment_period,
        item_lines: normalizedItems
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
      await createShoppingRequest(payload)
      setSuccess('Shopping request submitted for approval.')
      setFormData({
        employee_id: canManage ? '' : selectedEmployee?.$id || '',
        amount: '0',
        reason: 'For personal reason',
        repayment_period: '',
        for_period: '',
        application_date: '',
        installment_count: '',
        installment_plan: ''
      })
      setItemLines([{ ...EMPTY_ITEM }])
    } catch (err) {
      setError(err.message || 'Failed to submit')
    } finally {
      setLoading(false)
    }
  }

  if (!isLocalDataSource()) {
    return (
      <div className="shopping-request-page">
        <div className="alert alert-warning">
          Shopping requests are only available in the desktop (local SQLite) app.
        </div>
      </div>
    )
  }

  if (!currentCompany) {
    return (
      <div className="shopping-request-page">
        <div className="alert alert-warning">Please select a company first.</div>
      </div>
    )
  }

  return (
    <div className="shopping-request-page">
      <div className="page-header">
        <h1>Request shopping</h1>
      </div>
      <p className="page-description">
        Submit a request for payroll to review. When a manager or admin <strong>approves</strong>, the advance is split across
        monthly instalments into payroll deductions (net pay), visible on payslips and reports. You can note the{' '}
        <strong>application date</strong> and repayment wording; admins set the exact first payroll month and number of
        instalments at approval. Shopping amounts for past months still use{' '}
        <Link to="/attendance/historical">Historical data entry</Link>.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit} className="sar-form">
        <div className="form-group">
          <label>Shopping items</label>
          <div className="shopping-items-wrap">
            {itemLines.map((line, idx) => {
              const qty = Number.parseFloat(String(line.qty || ''))
              const unitPrice = Number.parseFloat(String(line.unit_price || ''))
              const lineTotal = Number.isFinite(qty) && Number.isFinite(unitPrice) ? qty * unitPrice : 0
              return (
                <div key={`item-${idx}`} className="shopping-item-row">
                  <input
                    type="text"
                    value={line.item_code}
                    onChange={(e) =>
                      setItemLines((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, item_code: e.target.value } : x))
                      )
                    }
                    placeholder="Item code"
                  />
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={line.qty}
                    onChange={(e) =>
                      setItemLines((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x))
                      )
                    }
                    placeholder="Qty"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unit_price}
                    onChange={(e) =>
                      setItemLines((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, unit_price: e.target.value } : x))
                      )
                    }
                    placeholder="Price"
                  />
                  <div className="shopping-item-total">
                    {lineTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setItemLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))}
                    disabled={itemLines.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              )
            })}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setItemLines((prev) => [...prev, { ...EMPTY_ITEM }])}
            >
              Add item
            </button>
          </div>
          <p className="form-hint">
            Enter item code, quantity, and unit price line by line. Total is computed automatically.
          </p>
        </div>
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
            readOnly
            inputMode="decimal"
            placeholder="Computed from items"
            required
          />
          <p className="form-hint">
            Computed total: KES{' '}
            {itemLines
              .reduce((sum, line) => {
                const qty = Number.parseFloat(String(line.qty || ''))
                const unitPrice = Number.parseFloat(String(line.unit_price || ''))
                if (!Number.isFinite(qty) || !Number.isFinite(unitPrice) || qty <= 0 || unitPrice < 0) return sum
                return sum + qty * unitPrice
              }, 0)
              .toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
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
          <label>
            Narration <span className="required">*</span>
          </label>
          <textarea
            name="reason"
            value={formData.reason}
            onChange={handleChange}
            rows={4}
            placeholder="Describe why this shopping request is needed"
            required
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Submittingâ€¦' : 'Submit request'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ShoppingRequest









