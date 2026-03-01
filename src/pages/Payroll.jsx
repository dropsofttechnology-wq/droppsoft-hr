import { useEffect, useMemo, useState } from 'react'
import { Query } from 'appwrite'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { getEmployees } from '../services/employeeService'
import { getCompanySettings } from '../utils/settingsHelper'
import { calculatePayrollLine } from '../utils/payrollCalc'
import { getPayrollRunsForPeriod, savePayrollRunsForPeriod } from '../services/payrollService'
import { isPeriodClosed, closePeriod } from '../services/periodClosureService'
import { getEmployeeDeductionsForPeriod } from '../services/employeeDeductionsService'
import './Payroll.css'

const SETTINGS_KEYS = [
  'pay_date',
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

const getOrdinal = (n) => {
  const d = n % 10
  if (d === 1 && n !== 11) return 'st'
  if (d === 2 && n !== 12) return 'nd'
  if (d === 3 && n !== 13) return 'rd'
  return 'th'
}

const Payroll = () => {
  const { currentCompany } = useCompany()
  const { user } = useAuth()
  const [period, setPeriod] = useState(format(new Date(), 'yyyy-MM'))
  const [employees, setEmployees] = useState([])
  const [attendance, setAttendance] = useState([])
  const [settings, setSettings] = useState(null)
  const [employeeDeductions, setEmployeeDeductions] = useState([])

  const [preview, setPreview] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [periodClosed, setPeriodClosed] = useState(null)
  const [closingPeriod, setClosingPeriod] = useState(false)

  useEffect(() => {
    if (!currentCompany) return
    loadBaseData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany])

  useEffect(() => {
    if (currentCompany && period) {
      checkPeriodClosure()
    }
  }, [currentCompany, period])

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
        pay_date: Math.min(31, Math.max(1, num(s.pay_date, 25))),
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
    if (!preview.length) return {
      basic: 0, hse: 0, sday: 0, absence: 0, otherEarn: 0, totalEarn: 0,
      paye: 0, nssf: 0, nhif: 0, shopping: 0, advance: 0, housing: 0, otherDed: 0, pension: 0, totalDed: 0, net: 0
    }
    
    let totals = {
      basic: 0, hse: 0, sday: 0, absence: 0, otherEarn: 0, totalEarn: 0,
      paye: 0, nssf: 0, nhif: 0, shopping: 0, advance: 0, housing: 0, otherDed: 0, pension: 0, totalDed: 0, net: 0
    }
    
    preview.forEach(l => {
      const basic = Number(l.basic_salary || 0)
      const hse = Number(l.housing_allowance || 0)
      const sday = Number(l.holiday_pay || 0)
      const absence = -Number(l.absence_deduction || 0)
      const standard = Number(l.standard_allowance || 0)
      const otherEarn = standard + Number(l.overtime_pay || 0)
      const totalEarn = basic + hse + sday + otherEarn + absence
      const paye = Number(l.paye || 0)
      const nssf = Number(l.nssf_employee || 0)
      const nhif = Number(l.shif_employee || 0)
      const shopping = Number(l.shopping_amount || 0)
      const advance = Number(l.advance_amount || 0)
      const housing = Number(l.ahl_employee || 0)
      const otherDed = Number(l.other_deductions || 0)
      const pension = 0
      const totalDed = paye + nssf + nhif + shopping + advance + housing + otherDed + pension
      const net = totalEarn - totalDed
      
      totals.basic += basic
      totals.hse += hse
      totals.sday += sday
      totals.absence += absence
      totals.otherEarn += otherEarn
      totals.totalEarn += totalEarn
      totals.paye += paye
      totals.nssf += nssf
      totals.nhif += nhif
      totals.shopping += shopping
      totals.advance += advance
      totals.housing += housing
      totals.otherDed += otherDed
      totals.pension += pension
      totals.totalDed += totalDed
      totals.net += net
    })
    
    return totals
  }, [preview])

  const handlePreview = async () => {
    if (!currentCompany) return
    if (!settings) return

    try {
      setLoading(true)
      setError('')
      setSuccess('')

      const closed = await isPeriodClosed(currentCompany.$id, period)
      setPeriodClosed(closed)

      const att = await loadAttendanceForPeriod()
      setAttendance(att)

      // Load employee deductions for the period
      const deductions = await getEmployeeDeductionsForPeriod(currentCompany.$id, period)
      setEmployeeDeductions(deductions)
      const deductionsByEmployeeId = new Map(deductions.map(d => [d.employee_id, d]))

      const lines = employees.map((emp) => {
        const userId = emp.user_id || emp.$id
        const records = attendanceByUserId.get(userId) || att.filter(r => r.user_id === userId)
        const employeeDeduction = deductionsByEmployeeId.get(emp.$id) || null
        return calculatePayrollLine({
          employee: emp,
          attendanceRecords: records,
          period,
          settings,
          employeeDeduction
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

      // Map to the same shape as preview for display (compute actual/projected from gross if not saved)
      const payDate = Math.min(31, Math.max(1, settings?.pay_date ?? 25))
      const [y, m] = period.split('-').map(Number)
      const daysInMonth = y && m ? new Date(y, m, 0).getDate() : 30
      const actualDays = Math.max(0, payDate - 1)
      const projectedDays = Math.max(0, daysInMonth - payDate + 1)
      const actualRatio = daysInMonth > 0 ? actualDays / daysInMonth : 0
      const projectedRatio = daysInMonth > 0 ? projectedDays / daysInMonth : 1

      const byEmployeeId = new Map(runs.map(r => [r.employee_id, r]))
      const lines = employees.map(emp => {
        const run = byEmployeeId.get(emp.$id)
        if (!run) return null
        
        // Calculate housing allowance and standard allowance if not in saved run
        const basic = Number(run.basic_salary || 0)
        const housingAllowance = run.housing_allowance ?? (settings?.housing_allowance_type === 'percentage' 
          ? (basic * (settings?.housing_allowance || 0)) / 100 
          : (settings?.housing_allowance || 0))
        const standardAllowance = run.standard_allowance ?? (settings?.standard_allowance || 0)
        
        const gross = Number(run.gross_pay) || 0
        const net = Number(run.net_pay) || 0
        return {
          period,
          employee_id: emp.$id,
          user_id: emp.user_id || emp.$id,
          name: emp.name,
          department: emp.department || '',
          position: emp.position || '',
          basic_salary: run.basic_salary,
          allowances: run.allowances,
          housing_allowance: housingAllowance,
          standard_allowance: standardAllowance,
          gross_pay: run.gross_pay,
          actual_earnings: run.actual_earnings ?? Math.round(gross * actualRatio * 100) / 100,
          projected_earnings: run.projected_earnings ?? Math.round(gross * projectedRatio * 100) / 100,
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
          other_deductions: run.other_deductions,
          shopping_amount: run.shopping_amount || 0,
          advance_amount: run.advance_amount || 0
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

  const handleCloseMonth = async () => {
    if (!currentCompany || !user) return

    if (!window.confirm(`Close period ${period}? This will lock further changes for this month.`)) {
      return
    }

    try {
      setClosingPeriod(true)
      setError('')
      const closed = await closePeriod(currentCompany.$id, period, user.$id || user.email || 'admin')
      setPeriodClosed(closed)
      setSuccess(`Period ${period} has been closed.`)
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e.message || 'Failed to close period')
    } finally {
      setClosingPeriod(false)
    }
  }

  const handleSave = async () => {
    if (!currentCompany) return
    if (!preview.length) {
      setError('Generate a preview first.')
      return
    }

    // Check if period is closed
    if (periodClosed) {
      setError(`Cannot save payroll. Period ${period} is closed. Please reopen the period first or select a different period.`)
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

  const payDate = Math.min(31, Math.max(1, settings?.pay_date ?? 25))

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
          <button className="btn-primary" onClick={handleSave} disabled={saving || loading || !preview.length || !!periodClosed}>
            {saving ? 'Saving...' : 'Save Payroll'}
          </button>
          <button
            className="btn-secondary"
            onClick={handleCloseMonth}
            disabled={loading || saving || !!periodClosed || closingPeriod}
          >
            {closingPeriod ? 'Closing...' : periodClosed ? 'Month Closed' : 'Close Month'}
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

      <div className="payroll-info-box">
        <strong>📋 Important Calculation Notes:</strong>
        <ul>
          <li>
            <strong>Absence Deduction</strong> is calculated as: <strong>(Gross Pay / 30) × Absent Days</strong>
            <br />
            <small>Where Gross Pay = Basic Salary + House Allowance + Other Fixed Monthly Allowances (per Kenyan law)</small>
          </li>
          <li>
            If you loaded saved payroll, click <strong>"Preview"</strong> to recalculate with the latest formula, then <strong>"Save Payroll"</strong> to update.
          </li>
        </ul>
      </div>

      <div className="payroll-filters">
        {settings?.pay_date && (
          <div className="payroll-pay-date-info">
            <small>
              Pay date: {settings.pay_date}{getOrdinal(settings.pay_date)} of month.
              {settings.pay_date > 1 ? (
                <> Actual earnings: 1st–{(settings.pay_date - 1)}{getOrdinal(settings.pay_date - 1)}. Projected: {settings.pay_date}{getOrdinal(settings.pay_date)}–end.</>
              ) : (
                <> Pay on 1st. Projected: 1st–end.</>
              )}
            </small>
          </div>
        )}
      </div>

      {periodClosed && (
        <div className="alert alert-info">
          Period {periodClosed.period} is <strong>closed</strong>. Further changes should be avoided for this month.
        </div>
      )}
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
            <div className="summary-value">KES {(totals.totalEarn || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Total Deductions</div>
            <div className="summary-value">KES {(totals.totalDed || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Net Total</div>
            <div className="summary-value success">KES {(totals.net || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
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
                    <th>STAFF NO.</th>
                    <th>NAME</th>
                    <th>BASIC PAY</th>
                    <th>HSE ALLOW</th>
                    <th>S/DAYSHOL</th>
                    <th>ABSENCE</th>
                    <th>OTHER EARNINGS</th>
                    <th>TOTAL EARN.</th>
                    <th>P.A.Y.E</th>
                    <th>N.S.S.F</th>
                    <th>N.H.I.F</th>
                    <th>SHOPPING</th>
                    <th>ADVANC</th>
                    <th>HOUSING</th>
                    <th>OTHER DED</th>
                    <th>PENSION</th>
                    <th>TOTAL DED.</th>
                    <th>NET PAY</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((l) => {
                    const emp = employees.find(e => e.$id === l.employee_id) || null
                    const staffNo = emp?.employee_id || emp?.staff_no || l.employee_id || ''
                    const basic = Number(l.basic_salary || 0)
                    const hse = Number(l.housing_allowance || 0)
                    const sday = Number(l.holiday_pay || 0)
                    const absence = -Number(l.absence_deduction || 0) // negative like template
                    const standard = Number(l.standard_allowance || 0)
                    const otherEarn = standard + Number(l.overtime_pay || 0)
                    const totalEarn = basic + hse + sday + otherEarn + absence
                    const paye = Number(l.paye || 0)
                    const nssf = Number(l.nssf_employee || 0)
                    const nhif = Number(l.shif_employee || 0) // SHIF labeled as NHIF
                    const shopping = Number(l.shopping_amount || 0)
                    const advance = Number(l.advance_amount || 0)
                    const housing = Number(l.ahl_employee || 0) // AHL labeled as HOUSING
                    const otherDed = Number(l.other_deductions || 0)
                    const pension = 0
                    const totalDed = paye + nssf + nhif + shopping + advance + housing + otherDed + pension
                    const net = totalEarn - totalDed

                    return (
                      <tr key={l.employee_id}>
                        <td>{staffNo}</td>
                        <td>{l.name}</td>
                        <td className="text-right">{basic.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{hse.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{sday.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{absence.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{otherEarn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right strong">{totalEarn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{paye.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{nssf.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{nhif.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{shopping.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{advance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{housing.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{otherDed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{pension.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right strong">{totalDed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right strong success">{net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="strong">GRAND TOTAL:</td>
                    <td />
                    <td className="text-right strong">{totals.basic.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.hse.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.sday.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.absence.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.otherEarn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.totalEarn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.paye.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.nssf.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.nhif.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.shopping.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.advance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.housing.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.otherDed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.pension.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.totalDed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong success">{totals.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
