import { useState } from 'react'
import toast from 'react-hot-toast'
import { useCompany } from '../contexts/CompanyContext'
import {
  fetchPayrollDataForPeriod,
  fetchPayrollDataForYear,
  generateP10CSV,
  generateNSSFCsv,
  generateSHIFCsv,
  generateAHLCsv,
  generateP9Csv,
  fetchCompanyPayrollListDataForPeriod,
  generateCompanyPayrollListPDF,
  generatePayslipsPDF,
  generateBankingReportPDF,
  generateNSSFReportPDF,
  generateP9ReportPDF,
  fetchAttendanceDataForPeriod,
  generateAttendanceReportPDF,
  generateAttendanceReportCSV,
  pdfBrandingFromCompanySettings
} from '../services/reportService'
import { getCompanySettings } from '../utils/settingsHelper'
import { fetchCompanyDataForExport, downloadCompanyDataJSON, downloadCompanyDataCSV } from '../services/exportService'
import { getAuditLogs } from '../services/auditService'
import { getEmployeeDeductionsForPeriod } from '../services/employeeDeductionsService'
import { getShoppingRequests } from '../services/shoppingService'
import { getEmployees } from '../services/employeeService'
import './Reports.css'

const downloadFile = (content, filename, mime = 'text/csv;charset=utf-8;') => {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

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

const csvEscape = (value) => {
  const raw = value == null ? '' : String(value)
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`
  return raw
}

const Reports = () => {
  const { currentCompany } = useCompany()
  const [reportType, setReportType] = useState('p10')
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)

  const handleGenerate = async () => {
    if (!currentCompany) {
      setError('Please select a company first.')
      return
    }
    setError('')
    setSuccess('')

    try {
      setLoading(true)
      const pdfSettingsRaw = await getCompanySettings(currentCompany.$id, [
        'pdf_letterhead_logo_enabled',
        'pdf_watermark_opacity',
        'pdf_payslip_watermark_opacity'
      ]).catch(() => ({}))
      const pdfBranding = pdfBrandingFromCompanySettings(pdfSettingsRaw)
      console.log(`Generating ${reportType} report for period ${period || year}...`)

      if (reportType === 'company_payroll_pdf') {
        const { runs, empById, settings, deductionsByEmployeeId } =
          await fetchCompanyPayrollListDataForPeriod(currentCompany.$id, period)
        if (!runs.length) {
          setError(
            `No payroll runs found for period ${period}. ` +
            `Please process payroll for this period first by going to the Payroll page and clicking "Save Payroll".`
          )
          return
        }
        const pdfBlob = await generateCompanyPayrollListPDF({
          companyName: currentCompany.name || 'Company',
          companyLogoUrl: currentCompany.logo_url || '',
          period,
          runs,
          empById,
          settings,
          deductionsByEmployeeId,
          pdfBranding
        })
        downloadBlob(pdfBlob, `PAYROLL_LIST_${currentCompany.name || 'Company'}_${period}.pdf`)
        toast.success(`Payroll list PDF generated for ${period}.`)
        return
      }

      if (reportType === 'payslips_pdf') {
        const { runs, empById } = await fetchPayrollDataForPeriod(currentCompany.$id, period)
        if (!runs.length) {
          setError(
            `No payroll runs found for period ${period}. ` +
            `Please process payroll for this period first by going to the Payroll page and clicking "Save Payroll".`
          )
          return
        }
        const deductions = await getEmployeeDeductionsForPeriod(currentCompany.$id, period)
        const deductionsByEmployeeId = new Map(deductions.map(d => [d.employee_id, d]))
        const payrollSettings = await getCompanySettings(currentCompany.$id, [
          'standard_allowance',
          'housing_allowance',
          'housing_allowance_type'
        ]).catch(() => ({}))
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
        toast.success(`Payslips PDF generated for ${period}.`)
        return
      }

      if (reportType === 'banking_pdf') {
        const { runs, empById } = await fetchPayrollDataForPeriod(currentCompany.$id, period)
        if (!runs.length) {
          setError(
            `No payroll runs found for period ${period}. ` +
            `Please process payroll for this period first by going to the Payroll page and clicking "Save Payroll".`
          )
          return
        }
        const pdfBlob = await generateBankingReportPDF({
          companyName: currentCompany.name || 'Company',
          companyLogoUrl: currentCompany.logo_url || '',
          period,
          runs,
          empById,
          pdfBranding
        })
        downloadBlob(pdfBlob, `BANKING_${currentCompany.name || 'Company'}_${period}.pdf`)
        toast.success(`Banking report PDF generated for ${period}.`)
        return
      }

      if (reportType === 'nssf_pdf') {
        const { runs, empById } = await fetchPayrollDataForPeriod(currentCompany.$id, period)
        if (!runs.length) {
          setError(
            `No payroll runs found for period ${period}. ` +
            `Please process payroll for this period first by going to the Payroll page and clicking "Save Payroll".`
          )
          return
        }
        const pdfBlob = await generateNSSFReportPDF({
          companyName: currentCompany.name || 'Company',
          companyLogoUrl: currentCompany.logo_url || '',
          period,
          runs,
          empById,
          pdfBranding
        })
        downloadBlob(pdfBlob, `NSSF_${currentCompany.name || 'Company'}_${period}.pdf`)
        toast.success(`NSSF report PDF generated for ${period}.`)
        return
      }

      if (reportType === 'p9') {
        const runs = await fetchPayrollDataForYear(currentCompany.$id, year)
        if (!runs.length) {
          setError(`No payroll runs found for year ${year}.`)
          return
        }
        // We need employees for names/PINs
        const { employees } = await fetchPayrollDataForPeriod(currentCompany.$id, `${year}-01`) // getEmployees via helper
        const csv = generateP9Csv({ runs, employees, year })
        downloadFile(csv, `P9_${currentCompany.name || 'Company'}_${year}.csv`)
        setSuccess(`P9 report generated for ${year}.`)
        return
      }

      if (reportType === 'p9_pdf') {
        const runs = await fetchPayrollDataForYear(currentCompany.$id, year)
        if (!runs.length) {
          setError(`No payroll runs found for year ${year}.`)
          return
        }
        const { employees } = await fetchPayrollDataForPeriod(currentCompany.$id, `${year}-01`)
        const pdfBlob = await generateP9ReportPDF({
          companyName: currentCompany.name || 'Company',
          companyLogoUrl: currentCompany.logo_url || '',
          year,
          runs,
          employees,
          pdfBranding
        })
        downloadBlob(pdfBlob, `P9_${currentCompany.name || 'Company'}_${year}.pdf`)
        toast.success(`P9 report PDF generated for ${year}.`)
        return
      }

      if (reportType === 'attendance_pdf') {
        const { attendanceByEmployee, startDate, endDate, reportAsAtDate, reportGenerationDate, daysInRange } =
          await fetchAttendanceDataForPeriod(currentCompany.$id, period)
        if (attendanceByEmployee.size === 0) {
          setError(`No attendance records found for period ${period}.`)
          return
        }
        const reportingSettings = await getCompanySettings(currentCompany.$id, ['official_reporting_time', 'reporting_grace_minutes'])
        const pdfBlob = await generateAttendanceReportPDF({
          companyName: currentCompany.name || 'Company',
          companyLogoUrl: currentCompany.logo_url || '',
          period,
          attendanceByEmployee,
          startDate,
          endDate,
          reportAsAtDate,
          reportGenerationDate,
          daysInRange,
          reportingSettings: reportingSettings || {},
          pdfBranding
        })
        downloadBlob(pdfBlob, `ATTENDANCE_${currentCompany.name || 'Company'}_${period}.pdf`)
        toast.success(`Attendance report PDF generated for ${period}.`)
        return
      }

      if (reportType === 'attendance_csv') {
        const { attendanceByEmployee, startDate, endDate, reportAsAtDate, reportGenerationDate, daysInRange } =
          await fetchAttendanceDataForPeriod(currentCompany.$id, period)
        if (attendanceByEmployee.size === 0) {
          setError(`No attendance records found for period ${period}.`)
          return
        }
        const reportingSettings = await getCompanySettings(currentCompany.$id, ['official_reporting_time', 'reporting_grace_minutes'])
        const csv = generateAttendanceReportCSV({
          period,
          attendanceByEmployee,
          startDate,
          endDate,
          reportAsAtDate,
          reportGenerationDate,
          daysInRange,
          reportingSettings: reportingSettings || {}
        })
        downloadFile(csv, `ATTENDANCE_${currentCompany.name || 'Company'}_${period}.csv`)
        toast.success(`Attendance report CSV generated for ${period}.`)
        return
      }

      if (reportType === 'company_export_json') {
        const data = await fetchCompanyDataForExport(currentCompany.$id, { monthsBack: 12 })
        downloadCompanyDataJSON(data, currentCompany.name)
        toast.success('Company data (JSON) downloaded.')
        return
      }

      if (reportType === 'company_export_csv') {
        const data = await fetchCompanyDataForExport(currentCompany.$id, { monthsBack: 12 })
        downloadCompanyDataCSV(data, currentCompany.name)
        toast.success('Company data (CSV) downloaded.')
        return
      }

      if (reportType === 'shopping_details_csv') {
        const [rows, employees] = await Promise.all([
          getShoppingRequests(currentCompany.$id, { status: 'all' }),
          getEmployees(currentCompany.$id, {}).catch(() => [])
        ])
        const employeeById = new Map((employees || []).map((e) => [String(e.$id), e]))
        const inPeriod = (rows || []).filter((r) => {
          const d = String(r.application_date || r.created_at || '').slice(0, 7)
          return d === period
        })
        if (!inPeriod.length) {
          setError(`No shopping requests found for period ${period}.`)
          return
        }
        const headers = [
          'request_id',
          'employee_name',
          'department',
          'item_breakdown',
          'amount',
          'status',
          'application_date',
          'for_period',
          'installment_count',
          'approved_by',
          'approved_at',
          'rejected_at',
          'rejection_reason'
        ]
        const lines = [headers.join(',')]
        for (const row of inPeriod) {
          const emp = employeeById.get(String(row.employee_id))
          lines.push(
            [
              row.$id || row.id,
              emp?.name || emp?.full_name || row.employee_name || '',
              emp?.department || '',
              Array.isArray(row.item_lines) && row.item_lines.length
                ? row.item_lines
                    .map((line) => {
                      const qty = Number(line?.qty) || 0
                      const unitPrice = Number(line?.unit_price) || 0
                      return `${line?.item_code || ''} x${qty} @ ${unitPrice}`
                    })
                    .join(' | ')
                : '',
              Number(row.amount || 0).toFixed(2),
              row.status || '',
              row.application_date || row.created_at || '',
              row.for_period || '',
              Number(row.installment_count || 0),
              row.approver_name || row.approved_by || '',
              row.approved_at || '',
              row.rejected_at || '',
              row.rejection_reason || ''
            ]
              .map(csvEscape)
              .join(',')
          )
        }
        downloadFile(lines.join('\n'), `SHOPPING_DETAILS_${currentCompany.name || 'Company'}_${period}.csv`)
        toast.success(`Shopping details report generated for ${period}.`)
        return
      }

      const { runs, empById } = await fetchPayrollDataForPeriod(currentCompany.$id, period)
      if (!runs.length) {
        setError(
          `No payroll runs found for period ${period}. ` +
          `Please process payroll for this period first by going to the Payroll page and clicking "Save Payroll".`
        )
        return
      }

      let csv = ''
      let filename = ''

      switch (reportType) {
        case 'company_payroll_pdf':
          // handled above
          break
        case 'p10':
          csv = generateP10CSV({ runs, empById, period })
          filename = `P10_${currentCompany.name || 'Company'}_${period}.csv`
          break
        case 'nssf':
          csv = generateNSSFCsv({ runs, empById })
          filename = `NSSF_${currentCompany.name || 'Company'}_${period}.csv`
          break
        case 'shif':
          csv = generateSHIFCsv({ runs, empById, period })
          filename = `SHIF_${currentCompany.name || 'Company'}_${period}.csv`
          break
        case 'ahl':
          csv = generateAHLCsv({ runs, empById, period })
          filename = `AHL_${currentCompany.name || 'Company'}_${period}.csv`
          break
        default:
          throw new Error('Unsupported report type')
      }

      downloadFile(csv, filename)
      toast.success(`Report ${reportType.toUpperCase()} generated for ${period}.`)
    } catch (e) {
      console.error('Report generation error:', e)
      const errorMessage = e.message || 'Failed to generate report'
      toast.error(`Error: ${errorMessage}. Please check the browser console for details.`)
    } finally {
      setLoading(false)
    }
  }

  if (!currentCompany) {
    return (
      <div className="reports-page">
        <div className="alert alert-warning">Please select a company first.</div>
      </div>
    )
  }

  const showMonthPicker = !['p9', 'p9_pdf', 'company_export_json', 'company_export_csv'].includes(reportType)

  const handleLoadAuditLog = async () => {
    if (!currentCompany) return
    setAuditLoading(true)
    try {
      const logs = await getAuditLogs(currentCompany.$id, { limit: 200 })
      setAuditLogs(logs)
      if (logs.length === 0) toast.success('No audit entries found.')
      else toast.success(`Loaded ${logs.length} audit entries.`)
    } catch (e) {
      toast.error(e.message || 'Failed to load audit log')
    } finally {
      setAuditLoading(false)
    }
  }

  const downloadAuditLogCSV = () => {
    if (auditLogs.length === 0) return
    const headers = ['created_at', 'user_id', 'action', 'entity_type', 'entity_id', 'new_value']
    const escape = (v) => {
      if (v == null) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rows = [headers.join(','), ...auditLogs.map(r => headers.map(h => escape(r[h])).join(','))]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_log_${currentCompany?.name || 'company'}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Audit log CSV downloaded.')
  }

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1>Reports</h1>
      </div>

      <div className="reports-filters">
        <div className="filter-group">
          <label>Report Type</label>
          <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
            <option value="company_payroll_pdf">Company Payroll List (PDF)</option>
            <option value="payslips_pdf">Payslips (PDF - 4 per page, payroll columns)</option>
            <option value="banking_pdf">Banking Report (PDF)</option>
            <option value="nssf_pdf">NSSF Report (PDF)</option>
            <option value="p9_pdf">P9 Tax Deduction Card (PDF)</option>
            <option value="attendance_pdf">Monthly Attendance Report (PDF)</option>
            <option value="attendance_csv">Monthly Attendance Report (CSV)</option>
            <option value="shopping_details_csv">Shopping Details (CSV)</option>
            <option value="p10">P10 Tax Returns (CSV)</option>
            <option value="p9">P9 Tax Deduction Cards (CSV)</option>
            <option value="nssf">NSSF Contributions (CSV)</option>
            <option value="shif">SHIF Remittance (CSV)</option>
            <option value="ahl">AHL Report (CSV)</option>
            <option value="company_export_json">Export company data (JSON)</option>
            <option value="company_export_csv">Export company data (CSV)</option>
          </select>
        </div>

        {showMonthPicker ? (
          <div className="filter-group">
            <label>Period</label>
            <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
        ) : (
          <div className="filter-group">
            <label>Year</label>
            <input
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </div>
        )}

        <div className="filter-group">
          <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating...' : 'Generate & Download'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="reports-info" style={{ marginTop: '1.5rem' }}>
        <h3>Audit log</h3>
        <p>View and download recent actions (payroll saved, employee changes, leave approved, etc.).</p>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button type="button" className="btn-secondary" onClick={handleLoadAuditLog} disabled={auditLoading}>
            {auditLoading ? 'Loading...' : 'Load audit log'}
          </button>
          {auditLogs.length > 0 && (
            <button type="button" className="btn-primary" onClick={downloadAuditLogCSV}>Download audit log (CSV)</button>
          )}
        </div>
        {auditLogs.length > 0 && (
          <div className="reports-table-container" style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
            <table className="reports-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>Action</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>Entity</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.$id}>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>{log.created_at ? new Date(log.created_at).toLocaleString() : '-'}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>{log.action || '-'}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>{log.entity_type || '-'} {log.entity_id ? `(${log.entity_id})` : ''}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e2e8f0', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.new_value || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="reports-info">
        <div className="info-box">
          <strong>📋 Important:</strong>
          <ul>
            <li>
              <strong>Payroll Reports</strong> (Company Payroll List, Payslips, Banking, NSSF, P9, P10, SHIF, AHL) 
              require payroll to be processed first. Go to the <strong>Payroll</strong> page, select the period, 
              review the calculations, and click <strong>"Save Payroll"</strong> before generating these reports.
            </li>
            <li>
              <strong>Attendance Reports</strong> work independently and can be generated as soon as attendance 
              data exists for the selected period.
            </li>
          </ul>
        </div>
      </div>

      <div className="reports-help">
        <h2>Available Reports</h2>
        <ul>
          <li>
            <strong>Company Payroll List (PDF)</strong> – PDF formatted like your sample payroll list (Staff No, Basic, HSE Allow,
            Absence, Shopping, Advance, statutory deductions, totals).
          </li>
          <li>
            <strong>Payslips (PDF)</strong> – Four slips per landscape page; payroll column headings and figures match the Payroll grid, with NET SALARY emphasised at the bottom of each slip.
          </li>
          <li>
            <strong>Banking Report (PDF)</strong> – PDF grouped by bank with employee payment details.
          </li>
          <li>
            <strong>NSSF Report (PDF)</strong> – PDF with Payroll No, Surname, Other Names, ID, KRA PIN, NSSF Number, Gross Pay, NSSF Contribution.
          </li>
          <li>
            <strong>P9 Tax Deduction Card (PDF)</strong> – Annual PDF summarising totals per employee for the selected year.
          </li>
          <li>
            <strong>P10 Tax Returns (CSV)</strong> – CSV with per-employee Gross, Taxable, PAYE, SHIF, NSSF, AHL, Net Pay for the
            selected month.
          </li>
          <li>
            <strong>P9 Tax Deduction Cards (CSV)</strong> – Annual CSV summarising totals per employee for the selected year.
          </li>
          <li>
            <strong>NSSF Contributions (CSV)</strong> – CSV formatted with surname, other names, ID, KRA PIN, NSSF number, gross
            pay.
          </li>
          <li>
            <strong>SHIF Remittance (CSV)</strong> – CSV with SHIF numbers and contributions per employee.
          </li>
          <li>
            <strong>AHL Report (CSV)</strong> – CSV with Affordable Housing Levy (employee + employer) per employee.
          </li>
          <li>
            <strong>Monthly Attendance Report (PDF/CSV)</strong> – Monthly attendance summary showing days present per employee for the selected period.
          </li>
            <li>
              <strong>Shopping Details (CSV)</strong> – Monthly register of shopping requests with amount, employee, department, status, and approval trail.
            </li>
        </ul>
      </div>
    </div>
  )
}

export default Reports
