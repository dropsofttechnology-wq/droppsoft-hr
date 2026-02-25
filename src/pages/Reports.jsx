import { useState } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import {
  fetchPayrollDataForPeriod,
  fetchPayrollDataForYear,
  generateP10CSV,
  generateNSSFCsv,
  generateSHIFCsv,
  generateAHLCsv,
  generateP9Csv
} from '../services/reportService'
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

const Reports = () => {
  const { currentCompany } = useCompany()
  const [reportType, setReportType] = useState('p10')
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleGenerate = async () => {
    if (!currentCompany) return
    setError('')
    setSuccess('')

    try {
      setLoading(true)

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

      const { runs, empById } = await fetchPayrollDataForPeriod(currentCompany.$id, period)
      if (!runs.length) {
        setError(`No payroll runs found for period ${period}.`)
        return
      }

      let csv = ''
      let filename = ''

      switch (reportType) {
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
      setSuccess(`Report ${reportType.toUpperCase()} generated for ${period}.`)
    } catch (e) {
      setError(e.message || 'Failed to generate report')
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

  const showMonthPicker = reportType !== 'p9'

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1>Reports</h1>
      </div>

      <div className="reports-filters">
        <div className="filter-group">
          <label>Report Type</label>
          <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
            <option value="p10">P10 Tax Returns (Simplified CSV)</option>
            <option value="p9">P9 Tax Deduction Cards (Annual CSV)</option>
            <option value="nssf">NSSF Contributions</option>
            <option value="shif">SHIF Remittance</option>
            <option value="ahl">AHL Report</option>
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

      <div className="reports-help">
        <h2>Available Reports</h2>
        <ul>
          <li>
            <strong>P10 Tax Returns</strong> – CSV with per-employee Gross, Taxable, PAYE, SHIF, NSSF, AHL, Net Pay for the
            selected month.
          </li>
          <li>
            <strong>P9 Tax Deduction Cards</strong> – Annual CSV summarising totals per employee for the selected year.
          </li>
          <li>
            <strong>NSSF Contributions</strong> – CSV formatted with surname, other names, ID, KRA PIN, NSSF number, gross
            pay.
          </li>
          <li>
            <strong>SHIF Remittance</strong> – CSV with SHIF numbers and contributions per employee.
          </li>
          <li>
            <strong>AHL Report</strong> – CSV with Affordable Housing Levy (employee + employer) per employee.
          </li>
        </ul>
      </div>
    </div>
  )
}

export default Reports
