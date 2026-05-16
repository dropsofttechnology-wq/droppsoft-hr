import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import { getEmployees } from '../services/employeeService'
import { listAttendanceRecords } from '../services/attendanceService'
import { getCompanySettings, getCompanySettingBoolean } from '../utils/settingsHelper'
import { isLocalDataSource } from '../config/dataSource'
import { sendPayslipsByEmail } from '../services/payslipEmailService'
import {
  buildLeaveTypePayMap,
  calculatePayrollLine,
  computeUnpaidLeaveDayEquivalents
} from '../utils/payrollCalc'
import { getPayrollListRowMetrics } from '../utils/payrollListRowMetrics'
import { getPayrollRunsForPeriod, savePayrollRunsForPeriod } from '../services/payrollService'
import { isPeriodClosed, closePeriod } from '../services/periodClosureService'
import { getEmployeeDeductionsForPeriod } from '../services/employeeDeductionsService'
import { getHolidays } from '../services/holidayService'
import { getLeaveRequests, getLeaveTypes } from '../services/leaveService'
import { logAudit } from '../services/auditService'
import {
  fetchCompanyPayrollListDataForPeriod,
  generateCompanyPayrollListPDF,
  pdfBrandingFromCompanySettings
} from '../services/reportService'
import ConfirmDialog from '../components/ConfirmDialog'
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
  const [confirmSave, setConfirmSave] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

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

    return listAttendanceRecords({
      companyId: currentCompany.$id,
      from: format(start, 'yyyy-MM-dd'),
      to: format(end, 'yyyy-MM-dd')
    })
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

  /** Same slice as payslips / company payroll PDF (`getPayrollListRowMetrics`). */
  const payrollGridSettings = useMemo(() => {
    if (!settings) return null
    return {
      standard_allowance: settings.standard_allowance,
      housing_allowance: settings.housing_allowance,
      housing_allowance_type: settings.housing_allowance_type
    }
  }, [settings])

  const totals = useMemo(() => {
    const empty = {
      basic: 0, hse: 0, sday: 0, absence: 0, otherEarn: 0, totalEarn: 0,
      paye: 0, nssf: 0, shif: 0, shopping: 0, advance: 0, housing: 0, otherDed: 0, pension: 0, totalDed: 0, net: 0
    }
    if (!preview.length || !payrollGridSettings) return empty

    const totals = { ...empty }

    preview.forEach((l) => {
      const emp = employees.find((e) => e.$id === l.employee_id) || {}
      const m = getPayrollListRowMetrics(l, emp, payrollGridSettings, {})
      totals.basic += m.basic
      totals.hse += m.hse
      totals.sday += m.sday
      totals.absence += m.absence
      totals.otherEarn += m.otherEarn
      totals.totalEarn += m.totalEarn
      totals.paye += m.paye
      totals.nssf += m.nssf
      totals.shif += m.shif
      totals.shopping += m.shopping
      totals.advance += m.advance
      totals.housing += m.housingLevy
      totals.otherDed += m.otherDed
      totals.pension += m.pension
      totals.totalDed += m.totalDed
      totals.net += m.net
    })

    return totals
  }, [preview, employees, payrollGridSettings])

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

      // Include previous month so unpaid leave spanning pay-date boundaries is loaded (deduction follows pay date rules).
      const periodMonthStart = parseISO(`${period}-01`)
      const leaveRangeStart = format(startOfMonth(subMonths(periodMonthStart, 1)), 'yyyy-MM-dd')
      const leaveRangeEnd = format(endOfMonth(periodMonthStart), 'yyyy-MM-dd')
      const [leaveTypesList, approvedLeaves] = await Promise.all([
        getLeaveTypes(currentCompany.$id, false),
        getLeaveRequests(currentCompany.$id, {
          status: 'approved',
          from: leaveRangeStart,
          to: leaveRangeEnd
        })
      ])
      const leaveTypePayMap = buildLeaveTypePayMap(leaveTypesList || [])

      // Holidays eligible for this payroll run based on pay-date window:
      // current month (day <= pay date) + previous month tail (day > pay date)
      const holidayMonthStart = parseISO(`${period}-01`)
      const holidayRangeStart = format(startOfMonth(subMonths(holidayMonthStart, 1)), 'yyyy-MM-dd')
      const holidayRangeEnd = format(endOfMonth(holidayMonthStart), 'yyyy-MM-dd')
      const holidaysInPeriod = await getHolidays(currentCompany.$id, {
        start_date: holidayRangeStart,
        end_date: holidayRangeEnd,
        status: 'active'
      }).catch(() => [])

      const lines = employees.map((emp) => {
        const userId = emp.user_id || emp.$id
        const records = attendanceByUserId.get(userId) || att.filter(r => r.user_id === userId)
        const employeeDeduction = deductionsByEmployeeId.get(emp.$id) || null
        const unpaidLeaveDayEquivalents = computeUnpaidLeaveDayEquivalents({
          employeeId: emp.$id,
          period,
          approvedLeaves: approvedLeaves || [],
          leaveTypePayMap,
          payDate: settings.pay_date != null ? Math.min(31, Math.max(1, Number(settings.pay_date))) : 25
        })
        return calculatePayrollLine({
          employee: emp,
          attendanceRecords: records,
          period,
          settings,
          employeeDeduction,
          holidaysInPeriod,
          unpaidLeaveDayEquivalents
        })
      })

      setPreview(lines)
      toast.success(`Payroll preview ready for ${period} (${lines.length} employees).`)
    } catch (e) {
      toast.error(e.message || 'Failed to generate payroll preview')
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
        toast.success('No saved payroll runs found for this period.')
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
        const standard = Number(settings?.standard_allowance || 0)
        let housingAllowance = run.housing_allowance
        if (housingAllowance === undefined || housingAllowance === null) {
          const raw = Number(settings?.housing_allowance || 0)
          const t = settings?.housing_allowance_type || 'fixed'
          if (t === 'percentage') {
            housingAllowance = (basic * raw) / 100
          } else if (t === 'percentage_gross') {
            const percentageDecimal = raw / 100
            if (percentageDecimal < 1) {
              const gross = (basic + standard) / (1 - percentageDecimal)
              housingAllowance = gross * percentageDecimal
            } else {
              housingAllowance = 0
            }
          } else {
            housingAllowance = raw
          }
        }
        const standardAllowance = run.standard_allowance ?? standard
        
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
          total_earn: run.total_earn,
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
      toast.success(`Loaded saved payroll for ${period}.`)
    } catch (e) {
      toast.error(e.message || 'Failed to load saved payroll runs')
    } finally {
      setLoading(false)
    }
  }

  const handleCloseMonth = async () => {
    if (!currentCompany || !user) return
    setConfirmClose(true)
  }

  const handleCloseMonthConfirm = async () => {
    if (!currentCompany || !user) return
    try {
      setClosingPeriod(true)
      setError('')
      const closed = await closePeriod(currentCompany.$id, period, user.$id || user.email || 'admin')
      setPeriodClosed(closed)
      await logAudit(user.$id, currentCompany.$id, 'period_closed', { entityType: 'period', entityId: period, details: period })
      setConfirmClose(false)
      toast.success(`Period ${period} has been closed.`)
    } catch (e) {
      toast.error(e.message || 'Failed to close period')
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

    setConfirmSave(true)
  }

  const handleSaveConfirm = async () => {
    if (!currentCompany || !preview.length || periodClosed) return
    try {
      setSaving(true)
      setError('')
      await savePayrollRunsForPeriod({
        companyId: currentCompany.$id,
        period,
        payrollLines: preview,
        overwrite: true
      })
      await logAudit(user?.$id, currentCompany.$id, 'payroll_saved', { entityType: 'payroll', entityId: period, details: period })
      setConfirmSave(false)
      toast.success(`Payroll saved for ${period}.`)

      if (isLocalDataSource()) {
        const autoEmail = await getCompanySettingBoolean(
          currentCompany.$id,
          'email_payslips_on_save',
          false
        )
        if (autoEmail) {
          try {
            const r = await sendPayslipsByEmail(currentCompany.$id, period)
            toast.success(
              `Payslip emails: ${r.sent} sent, ${r.skipped} skipped (no work email on file), ${r.failed} failed.`
            )
          } catch (err) {
            toast.error(err?.message || 'Payroll saved, but payslip email step failed.')
          }
        }
      }
    } catch (e) {
      toast.error(e.message || 'Failed to save payroll runs')
    } finally {
      setSaving(false)
    }
  }

  const safeFileName = (name) => String(name || 'Company').replace(/[/\\?%*:|"<>]/g, '_')

  /** Same payload as Reports → Company Payroll List: DB runs for this period (must match after Save). */
  const handleExportPayrollListPdfSaved = async () => {
    if (!currentCompany || !period) return
    try {
      setExportingPdf(true)
      setError('')
      const { runs, empById, settings: s, deductionsByEmployeeId } =
        await fetchCompanyPayrollListDataForPeriod(currentCompany.$id, period)
      if (!runs.length) {
        toast.error(
          'No saved payroll for this period. Click Save Payroll first, or use PDF · On screen after Preview.'
        )
        return
      }
      const pdfRaw = await getCompanySettings(currentCompany.$id, [
        'pdf_letterhead_logo_enabled',
        'pdf_watermark_opacity',
        'pdf_payslip_watermark_opacity'
      ]).catch(() => ({}))
      const blob = await generateCompanyPayrollListPDF({
        companyName: currentCompany.name || 'Company',
        companyLogoUrl: currentCompany.logo_url || '',
        period,
        runs,
        empById,
        settings: s,
        deductionsByEmployeeId,
        pdfBranding: pdfBrandingFromCompanySettings(pdfRaw)
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `PAYROLL_LIST_${safeFileName(currentCompany.name)}_${period}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('PDF from saved payroll — same as Reports → Company Payroll List.')
    } catch (e) {
      const msg = e.message || 'Failed to generate payroll list PDF'
      setError(msg)
      toast.error(msg)
    } finally {
      setExportingPdf(false)
    }
  }

  /** PDF built from the current grid (Preview / Load Saved). Matches screen; differs from Reports until you Save. */
  const handleExportPayrollListPdfOnScreen = async () => {
    if (!currentCompany || !settings || !preview.length) {
      toast.error('Run Preview or Load Saved first.')
      return
    }
    try {
      setExportingPdf(true)
      setError('')
      const empById = new Map(employees.map((e) => [e.$id, e]))
      const pdfSettings = {
        standard_allowance: num(settings.standard_allowance, 0),
        housing_allowance: num(settings.housing_allowance, 0),
        housing_allowance_type: settings.housing_allowance_type || 'fixed',
        personal_relief: num(settings.personal_relief, 2400)
      }
      const pdfRaw = await getCompanySettings(currentCompany.$id, [
        'pdf_letterhead_logo_enabled',
        'pdf_watermark_opacity',
        'pdf_payslip_watermark_opacity'
      ]).catch(() => ({}))
      const blob = await generateCompanyPayrollListPDF({
        companyName: currentCompany.name || 'Company',
        companyLogoUrl: currentCompany.logo_url || '',
        period,
        runs: preview,
        empById,
        settings: pdfSettings,
        deductionsByEmployeeId: new Map(),
        pdfBranding: pdfBrandingFromCompanySettings(pdfRaw)
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `PAYROLL_LIST_${safeFileName(currentCompany.name)}_${period}_on-screen.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('PDF from current table. Save payroll if this should match Reports.')
    } catch (e) {
      const msg = e.message || 'Failed to generate payroll list PDF'
      setError(msg)
      toast.error(msg)
    } finally {
      setExportingPdf(false)
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
      <div className="payroll-sticky-toolbar">
        <div className="page-header payroll-toolbar-header">
          <h1>Payroll</h1>
          <div className="payroll-actions">
            <button
              type="button"
              className="btn-secondary payroll-toolbar-btn"
              onClick={handleLoadSaved}
              disabled={loading || saving}
            >
              Load Saved
            </button>
            <button
              type="button"
              className="btn-secondary payroll-toolbar-btn"
              onClick={handlePreview}
              disabled={loading || saving}
            >
              Preview
            </button>
            <button
              type="button"
              className="btn-secondary payroll-toolbar-btn"
              onClick={handleExportPayrollListPdfSaved}
              disabled={loading || saving || exportingPdf}
              title="Uses payroll saved for this period — identical to Reports → Company Payroll List (PDF)."
            >
              {exportingPdf ? 'PDF…' : 'PDF · Saved (Reports)'}
            </button>
            <button
              type="button"
              className="btn-secondary payroll-toolbar-btn"
              onClick={handleExportPayrollListPdfOnScreen}
              disabled={loading || saving || exportingPdf || !preview.length}
              title="Exports exactly what the table shows. After Preview, may differ from Reports until you Save Payroll."
            >
              {exportingPdf ? 'PDF…' : 'PDF · On screen'}
            </button>
            <button
              type="button"
              className="btn-primary payroll-toolbar-btn payroll-toolbar-btn-primary"
              onClick={handleSave}
              disabled={saving || loading || !preview.length || !!periodClosed}
            >
              {saving ? 'Saving...' : 'Save Payroll'}
            </button>
            <button
              type="button"
              className="btn-secondary payroll-toolbar-btn"
              onClick={handleCloseMonth}
              disabled={loading || saving || !!periodClosed || closingPeriod}
            >
              {closingPeriod ? 'Closing...' : periodClosed ? 'Month Closed' : 'Close Month'}
            </button>
          </div>
        </div>

        <div className="payroll-filters payroll-toolbar-filters">
          <div className="filter-group">
            <label>Period</label>
            <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div className="filter-group">
            <button
              type="button"
              className="btn-secondary payroll-toolbar-btn"
              onClick={loadBaseData}
              disabled={loading || saving}
            >
              Refresh Employees/Settings
            </button>
          </div>
        </div>
      </div>

      <div className="payroll-info-box">
        <strong>📋 Important Calculation Notes:</strong>
        <ul>
          <li>
            <strong>Pre-tax absence / unpaid leave</strong> and <strong>SUN/HOLIDAY</strong> use one day-pay: <strong>(Basic + HSE allowance) ÷ 30</strong>.
            <br />
            <small>
              Manual <strong>absent days</strong> from deductions plus <strong>approved leave</strong> with pay below 100% (e.g. Unpaid = 0%).
              Unpaid leave is tied to <strong>pay date</strong>: days from day 1 through pay date count in this period&apos;s payroll; calendar days <em>after</em> pay date (and the tail of the previous month after pay date) count in the <strong>following</strong> period&apos;s payroll.
              <strong> Total earn</strong> and <strong>net pay</strong> use earnings after absence, then all deductions (statutory + PAYE + advance/shopping, etc.).
            </small>
          </li>
          <li>
            If you loaded saved payroll, click <strong>"Preview"</strong> to recalculate with the latest formula, then <strong>"Save Payroll"</strong> to update.
          </li>
          <li>
            <strong>PDF exports:</strong> <strong>PDF · Saved (Reports)</strong> matches <strong>Reports → Company Payroll List</strong> (database).{' '}
            <strong>PDF · On screen</strong> matches the grid; after <strong>Preview</strong> it can differ until you <strong>Save Payroll</strong>.
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
            <div className="summary-value success">KES {(totals.net || 0).toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })}</div>
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
                    <th>SUN/HOLIDAY</th>
                    <th>ABSENCE</th>
                    <th>OTHER EARNINGS</th>
                    <th>TOTAL EARN.</th>
                    <th>P.A.Y.E</th>
                    <th>N.S.S.F</th>
                    <th>S.H.I.F</th>
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
                    const emp = employees.find(e => e.$id === l.employee_id) || {}
                    const m = getPayrollListRowMetrics(l, emp, payrollGridSettings || {}, {})

                    return (
                      <tr key={l.employee_id}>
                        <td>{m.staffNo}</td>
                        <td>{m.name}</td>
                        <td className="text-right">{m.basic.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{m.hse.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{m.sday.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{m.absence.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{m.otherEarn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right strong">{m.totalEarn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{m.paye.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{m.nssf.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{m.shif.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{m.shopping.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{m.advance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{m.housingLevy.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{m.otherDed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right">{m.pension.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right strong">{m.totalDed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="text-right strong success">{m.net.toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })}</td>
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
                    <td className="text-right strong">{totals.shif.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.shopping.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.advance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.housing.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.otherDed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.pension.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong">{totals.totalDed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right strong success">{Math.round(totals.net).toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmSave}
        title="Save payroll"
        message={`Save payroll runs for ${period}? This will overwrite existing runs for this period.`}
        confirmLabel="Save"
        cancelLabel="Cancel"
        loading={saving}
        onConfirm={handleSaveConfirm}
        onCancel={() => setConfirmSave(false)}
      />
      <ConfirmDialog
        open={confirmClose}
        title="Close period"
        message={`Close period ${period}? This will lock further changes for this month.`}
        confirmLabel="Close period"
        cancelLabel="Cancel"
        loading={closingPeriod}
        onConfirm={handleCloseMonthConfirm}
        onCancel={() => setConfirmClose(false)}
      />
    </div>
  )
}

export default Payroll
