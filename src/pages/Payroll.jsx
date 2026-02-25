import { useEffect, useMemo, useState } from 'react'
import { Query } from 'appwrite'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import { useCompany } from '../contexts/CompanyContext'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { getEmployees } from '../services/employeeService'
import { getCompanySettings } from '../utils/settingsHelper'
import { calculatePayrollLine } from '../utils/payrollCalc'
import { getPayrollRunsForPeriod, savePayrollRunsForPeriod } from '../services/payrollService'
import './Payroll.css'

const SETTINGS_KEYS = [
  'standard_allowance',
  'housing_allowance',
  'housing_allowance_type',
  'overtime_rate',
  'overtime_rate_type',
  'working_hours',
  'shif_rate',
  'shif_minimum',
  'nssf_tier1_limit',
  'nssf_tier2_limit',
  'ahl_rate',
  'personal_relief'
]

const num = (v, d = 0) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : d
}

const Payroll = () => {
  const { currentCompany } = useCompany()
  const [period, setPeriod] = useState(format(new Date(), 'yyyy-MM'))
  const [employees, setEmployees] = useState([])
  const [attendance, setAttendance] = useState([])
  const [settings, setSettings] = useState(null)

  const [preview, setPreview] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!currentCompany) return
    loadBaseData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany])

  const loadBaseData = async () => {
    try {
      setLoading(true)
      setError('')
      const [emps, s] = await Promise.all([
        getEmployees(currentCompany.$id, { status: 'active' }),
        getCompanySettings(currentCompany.$id, SETTINGS_KEYS)
      ])

      // normalize settings with defaults
      const normalized = {
        standard_allowance: num(s.standard_allowance, 0),
        housing_allowance: num(s.housing_allowance, 0),
        housing_allowance_type: s.housing_allowance_type || 'fixed',
        overtime_rate: num(s.overtime_rate, 0),
        overtime_rate_type: s.overtime_rate_type || 'fixed',
        working_hours: num(s.working_hours, 8),
        shif_rate: num(s.shif_rate, 2.75),
        shif_minimum: num(s.shif_minimum, 300),
        nssf_tier1_limit: num(s.nssf_tier1_limit, 7000),
        nssf_tier2_limit: num(s.nssf_tier2_limit, 36000),
        ahl_rate: num(s.ahl_rate, 1.5),
        personal_relief: num(s.personal_relief, 2400)
      }

      setEmployees(emps)
      setSettings(normalized)
    } catch (e) {
      setError(e.message || 'Failed to load employees/settings')
    } finally {
      setLoading(false)
    }
  }

  const loadAttendanceForPeriod = async () => {
    if (!currentCompany || !period) return []
    const start = startOfMonth(parseISO(`${period}-01`))
    const end = endOfMonth(start)

    const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.ATTENDANCE, [
      Query.equal('company_id', currentCompany.$id),
      Query.greaterThanEqual('date', format(start, 'yyyy-MM-dd')),
      Query.lessThanEqual('date', format(end, 'yyyy-MM-dd')),
      Query.limit(5000)
    ])
    return res.documents
  }

  const attendanceByUserId = useMemo(() => {
    const map = new Map()
    for (const rec of attendance || []) {
      const key = rec.user_id
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(rec)
    }
    return map
  }, [attendance])

  const totals = useMemo(() => {
    const sum = (key) => preview.reduce((a, l) => a + (Number(l[key]) || 0), 0)
    return {
      gross: sum('gross_pay'),
      shif: sum('shif_employee'),
      nssf: sum('nssf_employee'),
      ahl: sum('ahl_employee'),
      paye: sum('paye'),
      net: sum('net_pay')
    }
  }, [preview])

  const handlePreview = async () => {
    if (!currentCompany) return
    if (!settings) return

    try {
      setLoading(true)
      setError('')
      setSuccess('')

      const att = await loadAttendanceForPeriod()
      setAttendance(att)

      const lines = employees.map((emp) => {
        const userId = emp.user_id || emp.$id
        const records = attendanceByUserId.get(userId) || att.filter(r => r.user_id === userId)
        return calculatePayrollLine({
          employee: emp,
          attendanceRecords: records,
          period,
          settings
        })
      })

      setPreview(lines)
      setSuccess(`Payroll preview ready for ${period} (${lines.length} employees).`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Failed to generate payroll preview')
    } finally {
      setLoading(false)
    }
  }

  const handleLoadSaved = async () => {
    if (!currentCompany) return
    try {
      setLoading(true)
      setError('')
      setSuccess('')
      const runs = await getPayrollRunsForPeriod(currentCompany.$id, period)
      if (!runs.length) {
        setPreview([])
        setSuccess('No saved payroll runs found for this period.')
        setTimeout(() => setSuccess(''), 3000)
        return
      }

      // Map to the same shape as preview for display
      const byEmployeeId = new Map(runs.map(r => [r.employee_id, r]))
      const lines = employees.map(emp => {
        const run = byEmployeeId.get(emp.$id)
        if (!run) return null
        return {
          period,
          employee_id: emp.$id,
          user_id: emp.user_id || emp.$id,
          name: emp.name,
          department: emp.department || '',
          position: emp.position || '',
          basic_salary: run.basic_salary,
          allowances: run.allowances,
          gross_pay: run.gross_pay,
          shif_employee: run.shif_employee,
          nssf_employee: run.nssf_employee,
          ahl_employee: run.ahl_employee,
          taxable_pay: run.taxable_pay,
          paye: run.paye,
          net_pay: run.net_pay,
          overtime_hours: run.overtime_hours,
          overtime_pay: run.overtime_pay,
          holiday_pay: run.holiday_pay,
          absence_deduction: run.absence_deduction,
          other_deductions: run.other_deductions
        }
      }).filter(Boolean)

      setPreview(lines)
      setSuccess(`Loaded saved payroll for ${period}.`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Failed to load saved payroll runs')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!currentCompany) return
    if (!preview.length) {
      setError('Generate a preview first.')
      return
    }

    if (!window.confirm(`Save payroll runs for ${period}? This will overwrite existing runs for this period.`)) {
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')
      await savePayrollRunsForPeriod({
        companyId: currentCompany.$id,
        period,
        payrollLines: preview,
        overwrite: true
      })
      setSuccess(`Payroll saved for ${period}.`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Failed to save payroll runs')
    } finally {
      setSaving(false)
    }
  }

  if (!currentCompany) {
    return (
      <div className="payroll-page">
        <div className="alert alert-warning">Please select a company first.</div>
      </div>
    )
  }

  return (
    <div className="payroll-page">
      <div className="page-header">
        <h1>Payroll</h1>
        <div className="payroll-actions">
          <button className="btn-secondary" onClick={handleLoadSaved} disabled={loading || saving}>
            Load Saved
          </button>
          <button className="btn-secondary" onClick={handlePreview} disabled={loading || saving}>
            Preview
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || loading || !preview.length}>
            {saving ? 'Saving...' : 'Save Payroll'}
          </button>
        </div>
      </div>

      <div className="payroll-filters">
        <div className="filter-group">
          <label>Period</label>
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
        <div className="filter-group">
          <button className="btn-secondary" onClick={loadBaseData} disabled={loading || saving}>
            Refresh Employees/Settings
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          <div className="payroll-summary">
            <div className="summary-card">
              <div className="summary-label">Employees</div>
              <div className="summary-value">{preview.length || employees.length}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Gross Total</div>
              <div className="summary-value">KES {totals.gross.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Net Total</div>
              <div className="summary-value success">KES {totals.net.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            </div>
          </div>

          {!preview.length ? (
            <div className="empty-state">
              Click <strong>Preview</strong> to calculate payroll for {period}.
            </div>
          ) : (
            <div className="payroll-table-container">
              <table className="payroll-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Basic</th>
                    <th>Allowances</th>
                    <th>Overtime</th>
                    <th>Gross</th>
                    <th>SHIF</th>
                    <th>NSSF</th>
                    <th>AHL</th>
                    <th>Taxable</th>
                    <th>PAYE</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((l) => (
                    <tr key={l.employee_id}>
                      <td>
                        <div className="emp-cell">
                          <div className="emp-name">{l.name}</div>
                          <div className="emp-sub">{l.department}{l.department && l.position ? ' • ' : ''}{l.position}</div>
                        </div>
                      </td>
                      <td>KES {Number(l.basic_salary).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td>KES {Number(l.allowances).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td>
                        <div className="ot-cell">
                          <div>{Number(l.overtime_hours).toFixed(2)}h</div>
                          <div className="emp-sub">KES {Number(l.overtime_pay).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        </div>
                      </td>
                      <td className="strong">KES {Number(l.gross_pay).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td>KES {Number(l.shif_employee).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td>KES {Number(l.nssf_employee).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td>KES {Number(l.ahl_employee).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td>KES {Number(l.taxable_pay).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td>KES {Number(l.paye).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="strong success">KES {Number(l.net_pay).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="strong">Totals</td>
                    <td />
                    <td />
                    <td />
                    <td className="strong">KES {totals.gross.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td>KES {totals.shif.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td>KES {totals.nssf.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td>KES {totals.ahl.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td />
                    <td>KES {totals.paye.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className="strong success">KES {totals.net.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Payroll
