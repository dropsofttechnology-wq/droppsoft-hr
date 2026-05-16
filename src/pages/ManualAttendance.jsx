import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import { getEmployees } from '../services/employeeService'
import { isPeriodClosed } from '../services/periodClosureService'
import {
  bulkUpsertEmployeeDeductions,
  getEmployeeDeductionsForPeriod
} from '../services/employeeDeductionsService'
import './ManualAttendance.css'

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

const ManualAttendance = () => {
  const { currentCompany } = useCompany()
  const { user } = useAuth()

  const [period, setPeriod] = useState(format(new Date(), 'yyyy-MM'))
  const [employees, setEmployees] = useState([])
  const [deductionsByEmp, setDeductionsByEmp] = useState({})
  const [selected, setSelected] = useState({})
  const [search, setSearch] = useState('')

  const [periodClosed, setPeriodClosed] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const role = user?.prefs?.role || 'admin'
  const isAdmin = role === 'admin' || role === 'super_admin' || role === 'manager'

  useEffect(() => {
    if (!currentCompany) return
    loadBase()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany])

  useEffect(() => {
    if (!currentCompany || !period) return
    loadPeriodData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany, period])

  const loadBase = async () => {
    try {
      setLoading(true)
      setError('')
      const emps = await getEmployees(currentCompany.$id, { status: 'active' })
      setEmployees(emps)
      // default select none
      const sel = {}
      for (const emp of emps) sel[emp.$id] = false
      setSelected(sel)
    } catch (e) {
      setError(e.message || 'Failed to load employees')
    } finally {
      setLoading(false)
    }
  }

  const loadPeriodData = async () => {
    try {
      setLoading(true)
      setError('')
      const closed = await isPeriodClosed(currentCompany.$id, period)
      setPeriodClosed(closed)

      const docs = await getEmployeeDeductionsForPeriod(currentCompany.$id, period)
      const map = {}
      for (const d of docs) {
        map[d.employee_id] = {
          absent_days: d.absent_days ?? 0,
          advance_amount: d.advance_amount ?? 0,
          shopping_amount: d.shopping_amount ?? 0,
          notes: d.notes ?? ''
        }
      }
      setDeductionsByEmp(map)
    } catch (e) {
      console.error(e)
      setDeductionsByEmp({})
    } finally {
      setLoading(false)
    }
  }

  const filteredEmployees = useMemo(() => {
    const q = (search || '').trim().toLowerCase()
    if (!q) return employees
    return employees.filter((e) => {
      const id = (e.employee_id || e.staff_no || '').toLowerCase()
      const name = (e.name || '').toLowerCase()
      const dept = (e.department || '').toLowerCase()
      return name.includes(q) || id.includes(q) || dept.includes(q)
    })
  }, [employees, search])

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  )

  const isLocked = !!periodClosed

  const toggleSelectAllVisible = () => {
    const allVisibleSelected =
      filteredEmployees.length > 0 &&
      filteredEmployees.every((e) => selected[e.$id])
    const next = { ...selected }
    for (const e of filteredEmployees) next[e.$id] = !allVisibleSelected
    setSelected(next)
  }

  const updateDeduction = (employeeId, patch) => {
    setDeductionsByEmp((prev) => ({
      ...prev,
      [employeeId]: {
        absent_days: 0,
        advance_amount: 0,
        shopping_amount: 0,
        notes: '',
        ...prev[employeeId],
        ...patch
      }
    }))
  }

  const setAbsentDaysForSelected = (days) => {
    const d = clampInt(days, 0, 30, 0)
    setDeductionsByEmp((prev) => {
      const next = { ...prev }
      for (const emp of employees) {
        if (!selected[emp.$id]) continue
        next[emp.$id] = {
          absent_days: d,
          advance_amount: prev?.[emp.$id]?.advance_amount ?? 0,
          shopping_amount: prev?.[emp.$id]?.shopping_amount ?? 0,
          notes: prev?.[emp.$id]?.notes ?? ''
        }
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!currentCompany) return
    if (!period) return
    if (isLocked) {
      setError(`Cannot edit this month. Period ${period} is closed.`)
      return
    }

    const items = employees
      .filter((e) => selected[e.$id])
      .map((e) => {
        const d = deductionsByEmp[e.$id] || {}
        return {
          employeeId: e.$id,
          absentDays: clampInt(d.absent_days, 0, 30, 0),
          advanceAmount: clampMoney(d.advance_amount),
          shoppingAmount: clampMoney(d.shopping_amount),
          notes: (d.notes || '').slice(0, 500)
        }
      })

    if (!items.length) {
      setError('Please select at least one employee to save.')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')
      const res = await bulkUpsertEmployeeDeductions({
        companyId: currentCompany.$id,
        period,
        items
      })
      setSuccess(`Saved monthly attendance/deductions for ${res.updated} employees.`)
      setTimeout(() => setSuccess(''), 3000)
      await loadPeriodData()
    } catch (e) {
      setError(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!currentCompany) {
    return (
      <div className="manual-attendance-page">
        <div className="alert alert-warning">Please select a company first.</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="manual-attendance-page">
        <div className="alert alert-warning">You do not have access to this page.</div>
      </div>
    )
  }

  return (
    <div className="manual-attendance-page">
      <div className="page-header">
        <h1>Manual Attendance (Past Month)</h1>
      </div>

      <p className="page-description">
        Use this page to set <strong>Absent Days</strong> for a past month, record <strong>Salary Advances</strong> and{' '}
        <strong>Shopping Deductions</strong> per employee.
        <br />
        <strong>Calculation order:</strong>
        <br />
        1. Absence Deduction = ((Basic Pay + HSE Allow) / 30) × Absent Days
        <br />
        2. Adjusted Gross = Gross Pay - Absence Deduction - Advance - Shopping
        <br />
        3. Statutory deductions (SHIF, NSSF, AHL, PAYE) are calculated on <strong>Adjusted Gross</strong>
        <br />
        <strong>Note:</strong> Advance and Shopping are deducted from <strong>gross pay</strong>, not net pay.
      </p>

      <div className="manual-attendance-toolbar">
        <div className="filter-group">
          <label>Period</label>
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        <div className="filter-group grow">
          <label>Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, employee ID, department..."
          />
        </div>
        <div className="toolbar-actions">
          <button className="btn-secondary" type="button" onClick={() => setAbsentDaysForSelected(0)} disabled={isLocked}>
            Set Absent = 0 (Selected)
          </button>
          <button className="btn-secondary" type="button" onClick={() => setAbsentDaysForSelected(30)} disabled={isLocked}>
            Set Absent = 30 (Selected)
          </button>
          <button className="btn-primary" type="button" onClick={handleSave} disabled={saving || loading || isLocked}>
            {saving ? 'Saving...' : `Save (${selectedCount})`}
          </button>
        </div>
      </div>

      {periodClosed && (
        <div className="alert alert-warning">
          <strong>Period Closed:</strong> The period {period} is closed. You cannot edit manual attendance/deductions.
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="manual-attendance-table-container">
        <table className="manual-attendance-table">
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
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-cell">
                  {loading ? 'Loading...' : 'No employees found.'}
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => {
                const d = deductionsByEmp[emp.$id] || {}
                return (
                  <tr key={emp.$id}>
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
                          {(emp.employee_id || emp.staff_no || '-')}{emp.department ? ` • ${emp.department}` : ''}
                        </div>
                      </div>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={d.absent_days ?? 0}
                        disabled={isLocked}
                        onChange={(e) => updateDeduction(emp.$id, { absent_days: clampInt(e.target.value, 0, 30, 0) })}
                        className="num-input"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={d.advance_amount ?? 0}
                        disabled={isLocked}
                        onChange={(e) => updateDeduction(emp.$id, { advance_amount: clampMoney(e.target.value) })}
                        className="money-input"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={d.shopping_amount ?? 0}
                        disabled={isLocked}
                        onChange={(e) => updateDeduction(emp.$id, { shopping_amount: clampMoney(e.target.value) })}
                        className="money-input"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={d.notes ?? ''}
                        disabled={isLocked}
                        onChange={(e) => updateDeduction(emp.$id, { notes: e.target.value })}
                        placeholder="Optional..."
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
    </div>
  )
}

export default ManualAttendance

