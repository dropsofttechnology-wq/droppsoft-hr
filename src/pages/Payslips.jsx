import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useCompany } from '../contexts/CompanyContext'
import { isLocalDataSource } from '../config/dataSource'
import { fetchPayrollDataForPeriod } from '../services/reportService'
import { getEmployeeDeductionsForPeriod } from '../services/employeeDeductionsService'
import { getCompanySettings } from '../utils/settingsHelper'
import {
  generatePayslipsPDF,
  payslipOpenPasswordFromEmployee,
  pdfBrandingFromCompanySettings
} from '../services/reportService'
import { sendPayslipsByEmail } from '../services/payslipEmailService'
import './Payslips.css'

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const safeFilePart = (s) => String(s || 'emp').replace(/[/\\?%*:|"<>]/g, '_')

const Payslips = () => {
  const { currentCompany } = useCompany()
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [loading, setLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [runs, setRuns] = useState([])
  const [empById, setEmpById] = useState(() => new Map())
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadRuns() {
      if (!currentCompany?.$id || !period) {
        setRuns([])
        setEmpById(new Map())
        setSelectedEmployeeId('')
        return
      }
      try {
        const data = await fetchPayrollDataForPeriod(currentCompany.$id, period)
        if (cancelled) return
        setRuns(data.runs || [])
        setEmpById(data.empById instanceof Map ? data.empById : new Map())
        setSelectedEmployeeId('')
      } catch {
        if (!cancelled) {
          setRuns([])
          setEmpById(new Map())
        }
      }
    }
    loadRuns()
    return () => {
      cancelled = true
    }
  }, [currentCompany, period])

  const employeeOptions = useMemo(() => {
    const list = []
    for (const run of runs) {
      const emp = empById.get(run.employee_id)
      if (!emp) continue
      const label = `${emp.employee_id || emp.staff_no || ''} — ${emp.name || ''}`.trim()
      list.push({ id: run.employee_id, label: label || run.employee_id })
    }
    list.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }))
    return list
  }, [runs, empById])

  const loadPdfContext = async () => {
    const deductions = await getEmployeeDeductionsForPeriod(currentCompany.$id, period)
    const deductionsByEmployeeId = new Map(deductions.map((d) => [d.employee_id, d]))
    const payrollSettings = await getCompanySettings(currentCompany.$id, [
      'standard_allowance',
      'housing_allowance',
      'housing_allowance_type'
    ]).catch(() => ({}))
    const pdfRaw = await getCompanySettings(currentCompany.$id, [
      'pdf_letterhead_logo_enabled',
      'pdf_watermark_opacity',
      'pdf_payslip_watermark_opacity'
    ]).catch(() => ({}))
    const pdfBranding = pdfBrandingFromCompanySettings(pdfRaw)
    return { deductionsByEmployeeId, payrollSettings, pdfBranding }
  }

  const handleGenerate = async () => {
    if (!currentCompany) {
      setError('Please select a company first.')
      return
    }

    setError('')
    setSuccess('')

    try {
      setLoading(true)

      if (!runs.length) {
        setError(`No payroll runs found for period ${period}. Please save payroll first.`)
        return
      }

      const { deductionsByEmployeeId, payrollSettings, pdfBranding } = await loadPdfContext()

      const pdfBlob = await generatePayslipsPDF({
        companyName: currentCompany.name || 'Company',
        companyTaxPin: currentCompany.tax_pin || '',
        companyLogoUrl: currentCompany.logo_url || '',
        period,
        runs,
        empById,
        deductionsByEmployeeId,
        payrollSettings,
        pdfBranding
      })

      downloadBlob(pdfBlob, `PAYSLIPS_${currentCompany.name || 'Company'}_${period}.pdf`)
      setSuccess(`Payslips PDF generated for ${period}.`)
    } catch (e) {
      setError(e.message || 'Failed to generate payslips')
    } finally {
      setLoading(false)
    }
  }

  const handleSinglePayslip = async (mode) => {
    if (!currentCompany) return
    if (!selectedEmployeeId) {
      toast.error('Choose an employee first.')
      return
    }
    const run = runs.find((r) => r.employee_id === selectedEmployeeId)
    const emp = empById.get(selectedEmployeeId)
    if (!run || !emp) {
      toast.error('No payroll row for this employee in the selected period.')
      return
    }
    const openPassword = payslipOpenPasswordFromEmployee(emp)
    if (!openPassword) {
      toast.error(
        'ID Number has no letters or digits to use as the PDF password. Update the employee record first.'
      )
      return
    }
    setError('')
    setSuccess('')
    try {
      setLoading(true)
      const { deductionsByEmployeeId, payrollSettings, pdfBranding } = await loadPdfContext()
      const pdfBlob = await generatePayslipsPDF({
        companyName: currentCompany.name || 'Company',
        companyTaxPin: currentCompany.tax_pin || '',
        companyLogoUrl: currentCompany.logo_url || '',
        period,
        runs: [run],
        empById,
        deductionsByEmployeeId,
        payrollSettings,
        pdfBranding,
        pdfUserPassword: openPassword
      })
      const base = `PAYSLIP_${safeFilePart(emp.employee_id || emp.staff_no)}_${period}`
      if (mode === 'preview') {
        const url = URL.createObjectURL(pdfBlob)
        window.open(url, '_blank', 'noopener,noreferrer')
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
        toast.success(
          'Preview opened. The PDF is password-protected — use the ID Number (letters and numbers only, as stored) to open it.'
        )
      } else {
        downloadBlob(pdfBlob, `${base}.pdf`)
        toast.success(
          'Password-protected payslip downloaded. Open with the ID Number (letters and numbers only, as stored).'
        )
      }
    } catch (e) {
      toast.error(e.message || 'Failed to generate payslip')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailEmployees = async () => {
    if (!currentCompany) {
      setError('Please select a company first.')
      return
    }
    setError('')
    setSuccess('')
    try {
      setEmailLoading(true)
      const r = await sendPayslipsByEmail(currentCompany.$id, period)
      setSuccess(
        `Email: ${r.sent} sent, ${r.skipped} skipped (no valid work email), ${r.failed} failed.`
      )
      if (r.errors?.length) {
        toast.error(`${r.failed} message(s) failed. First error: ${r.errors[0].message}`)
      } else {
        toast.success('Payslip emails processed.')
      }
    } catch (e) {
      setError(e.message || 'Failed to send payslip emails')
      toast.error(e.message || 'Failed to send payslip emails')
    } finally {
      setEmailLoading(false)
    }
  }

  if (!currentCompany) {
    return (
      <div className="payslips-page">
        <div className="alert alert-warning">Please select a company first.</div>
      </div>
    )
  }

  return (
    <div className="payslips-page">
      <div className="page-header">
        <h1>Payslips</h1>
      </div>

      <p className="page-description">
        Generate payslips PDF for all employees (four payslips per page; payroll column labels and figures match the
        Payroll grid), preview or download one employee (that PDF is password-protected; password is the employee&apos;s{' '}
        <strong>ID Number</strong>, letters and digits only), or email payslips when using the desktop
        app with SMTP under Settings. Emailed payslips use each employee&apos;s national <strong>ID Number</strong> as
        the PDF password.
      </p>

      <div className="payslips-filters">
        <div className="filter-group">
          <label>Period</label>
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>

        <div className="filter-group">
          <label>Employee (preview / one PDF)</label>
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            disabled={!employeeOptions.length}
          >
            <option value="">— Select —</option>
            {employeeOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group payslips-actions">
          <button className="btn-primary" onClick={handleGenerate} disabled={loading || emailLoading}>
            {loading ? 'Generating...' : 'Generate Payslips PDF'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleSinglePayslip('preview')}
            disabled={loading || emailLoading || !selectedEmployeeId}
          >
            Preview one payslip
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleSinglePayslip('download')}
            disabled={loading || emailLoading || !selectedEmployeeId}
          >
            Download one payslip
          </button>
          {isLocalDataSource() && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleEmailEmployees}
              disabled={loading || emailLoading}
              title="Requires SMTP under Settings → Payslip email; uses employee Email field"
            >
              {emailLoading ? 'Sending…' : 'Email payslips to employees'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="payslips-help">
        <h2>Payslip format &amp; branding</h2>
        <p>
          Four payslips per landscape page when generating for everyone. Single preview/download uses one slip per page
          region (same layout). Letterhead logo and watermark follow{' '}
          <strong>Settings → PDF &amp; reports (branding)</strong> and the logo stored under{' '}
          <strong>Companies</strong>.
        </p>
        <ul>
          <li>Optional letterhead logo and diagonal watermark (configurable)</li>
          <li>
            NET SALARY repeated in bold at the bottom of each slip (same value as NET PAY in the payroll row)
          </li>
          <li>Company name, PIN, period, employee name and staff number</li>
          <li>Signature line</li>
          <li>
            Preview / download one payslip: PDF is encrypted; open with ID Number, alphanumeric only (e.g.{' '}
            <code>12-345678A</code> → password <code>12345678A</code>)
          </li>
        </ul>
        <p>
          <strong>Note:</strong> Save payroll for the selected period first. For automatic email after each save, enable
          it under <strong>Settings → Payslip email (SMTP)</strong>. Email delivery requires a valid <strong>Email</strong>{' '}
          and national <strong>ID Number</strong> on each profile (that number is the attachment password).
        </p>
      </div>
    </div>
  )
}

export default Payslips
