import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { getEmployees } from './employeeService'
import { getPayrollRunsForPeriod } from './payrollService'
import { getLeaveRequests } from './leaveService'
import { getCompanySettings } from '../utils/settingsHelper'
import { getEmployeeDeductionsForPeriod } from './employeeDeductionsService'
import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'
import { format, parseISO } from 'date-fns'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { isClockInOnTime } from '../utils/attendanceHelper'
import { PRINT_BRANDING_FOOTER_TEXT } from '../utils/printRequestForms'
import { roundNetPay, roundNSSFAmount } from '../utils/payrollCalc'
import {
  PAYROLL_LIST_TABLE_HEADERS,
  getPayrollListRowMetrics,
  formatPayrollListRowForPdf
} from '../utils/payrollListRowMetrics'
import {
  applyJsPdfDiagonalWatermarkOnCurrentPage,
  buildPdfWatermarkGeneratedLine,
  buildPdfWatermarkLogoStamp
} from '../utils/pdfWatermark'
import {
  DEFAULT_PDF_BRANDING,
  mergePdfBranding,
  pdfBrandingFromCompanySettings
} from '../../shared/pdfBranding.js'

export { DEFAULT_PDF_BRANDING, mergePdfBranding, pdfBrandingFromCompanySettings }

const listAllDocuments = async (collectionId, baseQueries = []) => {
  try {
    const limit = 100
    let offset = 0
    let all = []

    while (true) {
      const res = await databases.listDocuments(DATABASE_ID, collectionId, [
        ...baseQueries.filter(Boolean),
        Query.limit(limit),
        Query.offset(offset)
      ])
      all = all.concat(res.documents)
      if (res.documents.length < limit) break
      offset += limit
    }

    return all
  } catch (error) {
    console.error(`Error listing documents from ${collectionId}:`, error)
    throw new Error(`Failed to fetch data from ${collectionId}: ${error.message || error}`)
  }
}

const toCSV = (rows) => rows.map(r => r.map(v => {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}).join(',')).join('\r\n')

const splitName = (fullName = '') => {
  const parts = String(fullName).trim().split(/\s+/)
  if (parts.length === 0) return { surname: '', otherNames: '' }
  if (parts.length === 1) return { surname: parts[0], otherNames: '' }
  const surname = parts[parts.length - 1]
  const otherNames = parts.slice(0, parts.length - 1).join(' ')
  return { surname, otherNames }
}

export const fetchPayrollDataForPeriod = async (companyId, period) => {
  const [employees, runs] = await Promise.all([
    getEmployees(companyId, { status: 'active' }),
    getPayrollRunsForPeriod(companyId, period)
  ])

  const empById = new Map(employees.map(e => [e.$id, e]))
  return { employees, runs, empById }
}

export const fetchCompanyPayrollListDataForPeriod = async (companyId, period) => {
  const [{ employees, runs, empById }, s, deductions] = await Promise.all([
    fetchPayrollDataForPeriod(companyId, period),
    getCompanySettings(companyId, ['standard_allowance', 'housing_allowance', 'housing_allowance_type', 'personal_relief']).catch(() => ({})),
    getEmployeeDeductionsForPeriod(companyId, period).catch(() => [])
  ])

  const settings = {
    standard_allowance: parseFloat(s.standard_allowance) || 0,
    housing_allowance: parseFloat(s.housing_allowance) || 0,
    housing_allowance_type: s.housing_allowance_type || 'fixed',
    personal_relief: parseFloat(s.personal_relief) || 2400
  }

  const deductionsByEmployeeId = new Map(deductions.map(d => [d.employee_id, d]))

  return { employees, runs, empById, settings, deductionsByEmployeeId }
}

const money = (n) => {
  const num = Number(n || 0)
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Net pay / bank amounts: whole KES, aligned with payroll net_pay rounding. */
const moneyNet = (n) => {
  const v = roundNetPay(n)
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

/** NSSF and similar: whole KES, always shown with .00 */
const moneyWhole = (n) => {
  const v = roundNSSFAmount(n)
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Reserved space when logo is shown (banking/NSSF/P9/etc.): logo ~top center, text below logo band
const LOGO_HEADER_START_Y = 130   // First line of header text when logo present
const LOGO_TABLE_START_Y = 170   // Table / main content start when logo present
const LOGO_NEW_PAGE_START_Y = 150 // Content Y after new page when logo redrawn

/** Company payroll list PDF only: tighter header + slightly larger body font (see generateCompanyPayrollListPDF). */
const PAYROLL_LIST_BODY_FONT_PT = 7
const PAYROLL_LIST_CELL_PADDING_PT = 1

/** Landscape A4 inner width for tables (pt): same left/right margin as autoTable margin */
const PAYROLL_PDF_SIDE_MARGIN_PT = 20

/** Relative column weights: STAFF NO., NAME (wider), then 16 equal money columns */
const PAYROLL_LIST_COL_WEIGHTS = [1, 2.35, ...Array(16).fill(1)]

/**
 * Column styles for 18-column payroll list: widths sum to innerWidthPt; text left on 0–1, right on money cols.
 * @param {number} innerWidthPt - usable width (page width minus left and right margins)
 */
const buildPayrollListColumnStyles = (innerWidthPt) => {
  const weights = PAYROLL_LIST_COL_WEIGHTS
  const sum = weights.reduce((a, b) => a + b, 0)
  const styles = {}
  let used = 0
  for (let i = 0; i < 17; i++) {
    const w = Math.round(((weights[i] / sum) * innerWidthPt) * 100) / 100
    styles[i] = {
      cellWidth: w,
      halign: i <= 1 ? 'left' : 'right'
    }
    used += w
  }
  styles[17] = {
    cellWidth: Math.round((innerWidthPt - used) * 100) / 100,
    halign: 'right'
  }
  return styles
}

/**
 * Add company logo to PDF document (top left) - loads image and stores for reuse
 * @param {jsPDF} doc - The PDF document
 * @param {string} logoUrl - The logo URL
 * @returns {Promise<{width: number, height: number, img: Image}|null>} - Logo data for reuse
 */
const loadLogoForPDF = async (doc, logoUrl) => {
  if (!logoUrl) return null
  
  try {
    // Load image from URL
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    return await new Promise((resolve) => {
      img.onload = () => {
        try {
          const nw = img.naturalWidth || img.width
          const nh = img.naturalHeight || img.height
          if (!nw || !nh) {
            resolve(null)
            return
          }
          // Rasterize to PNG so jsPDF addImage never receives wrong format (JPEG as 'PNG' → black box)
          let canvas
          try {
            canvas = document.createElement('canvas')
            canvas.width = nw
            canvas.height = nh
            const ctx = canvas.getContext('2d')
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, nw, nh)
            ctx.drawImage(img, 0, 0)
          } catch (e) {
            console.warn('Logo canvas rasterize failed:', e)
            resolve(null)
            return
          }
          const pngDataUrl = canvas.toDataURL('image/png')

          // Calculate dimensions with max 100x100 for professional appearance
          const maxWidth = 100
          const maxHeight = 100
          let width = nw
          let height = nh
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height)
            width = width * ratio
            height = height * ratio
          } else if (width < 70 || height < 70) {
            const minSize = 70
            const ratio = Math.max(minSize / width, minSize / height)
            width = width * ratio
            height = height * ratio
            if (width > maxWidth || height > maxHeight) {
              const maxRatio = Math.min(maxWidth / width, maxHeight / height)
              width = width * maxRatio
              height = height * maxRatio
            }
          }
          
          resolve({ width, height, pngDataUrl })
        } catch (error) {
          console.warn('Failed to process logo image:', error)
          resolve(null)
        }
      }
      img.onerror = () => {
        console.warn('Failed to load logo image:', logoUrl)
        resolve(null)
      }
      img.src = logoUrl
    })
  } catch (error) {
    console.warn('Error loading logo for PDF:', error)
    return null
  }
}

/**
 * Add company logo to current page of PDF document (top left)
 * @param {jsPDF} doc - The PDF document
 * @param {object} logoData - Logo data from loadLogoForPDF
 */
const addLogoToCurrentPage = (doc, logoData) => {
  if (!logoData?.pngDataUrl) return
  
  try {
    doc.addImage(logoData.pngDataUrl, 'PNG', 40, 25, logoData.width, logoData.height)
  } catch (error) {
    console.warn('Failed to add logo to PDF page:', error)
  }
}

/**
 * Add company logo to PDF document (top left) - adds to first page only
 * For multi-page documents, use loadLogoForPDF and addLogoToCurrentPage in didDrawPage
 * @param {jsPDF} doc - The PDF document
 * @param {string} logoUrl - The logo URL
 * @returns {Promise<{width: number, height: number, img: Image}|null>} - Logo data for reuse on other pages
 */
const addLogoToPDF = async (doc, logoUrl) => {
  const logoData = await loadLogoForPDF(doc, logoUrl)
  if (logoData) {
    addLogoToCurrentPage(doc, logoData)
  }
  return logoData
}

/** Faded logo PNG behind each quarter-page payslip (browser canvas). */
const buildPayslipWatermarkStamp = (pngDataUrl, maxWPt, maxHPt, opacity = 0.13) => {
  if (!pngDataUrl) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const nw = img.naturalWidth || img.width
        const nh = img.naturalHeight || img.height
        if (!nw || !nh) {
          resolve(null)
          return
        }
        const scale = Math.min(maxWPt / nw, maxHPt / nh)
        const w = nw * scale
        const h = nh * scale
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.globalAlpha = opacity
        ctx.drawImage(img, 0, 0, w, h)
        ctx.globalAlpha = 1
        resolve({ pngDataUrl: canvas.toDataURL('image/png'), width: w, height: h })
      } catch (e) {
        console.warn('Payslip watermark build failed:', e)
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = pngDataUrl
  })
}

/**
 * Add footer to PDF document with Dropsoft branding
 * @param {jsPDF} doc - The PDF document
 * @param {object} options - Footer options
 */
const addFooterToPDF = (doc, options = {}) => {
  const pageCount = doc.getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const footerText = options.footerText || PRINT_BRANDING_FOOTER_TEXT
  const lineHeight = 9
  const marginX = options.marginX != null ? options.marginX : 40

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(90, 90, 90)
    doc.setFontSize(7)

    const maxW = pageWidth - marginX * 2
    const lines = doc.splitTextToSize(footerText, maxW)
    let y = pageHeight - 14 - (lines.length - 1) * lineHeight
    lines.forEach((line) => {
      doc.text(line, pageWidth / 2, y, { align: 'center' })
      y += lineHeight
    })

    if (!options.hidePageNumber) {
      doc.setFontSize(7)
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - marginX, pageHeight - 12, { align: 'right' })
    }
    doc.setTextColor(0, 0, 0)
  }
}

/**
 * Diagonal watermark must be drawn AFTER page content, otherwise tables and fills hide it.
 * Returns a function — call once immediately before `doc.output('arraybuffer')`.
 */
const buildJsPdfWatermarkOverlay = async (
  doc,
  { companyName, companyLogoUrl, logoDataPreloaded = null, extraLines = [], opacityMul = 1 } = {}
) => {
  let logoData = logoDataPreloaded
  if (!logoData?.pngDataUrl) {
    logoData = await loadLogoForPDF(doc, companyLogoUrl)
  }
  if (!logoData?.pngDataUrl) {
    logoData = await loadLogoForPDF(doc, '/logo.png')
  }
  let logoStamp = null
  if (logoData?.pngDataUrl) {
    const pw = doc.internal.pageSize.getWidth()
    logoStamp = await buildPdfWatermarkLogoStamp(logoData.pngDataUrl, pw * 0.44, pw * 0.34, 0.15)
  }
  const wmOpts = {
    logoStamp,
    companyName,
    extraLines: [...extraLines, buildPdfWatermarkGeneratedLine()],
    opacityMul
  }
  return () => {
    const n = doc.getNumberOfPages()
    let prev = 1
    try {
      const info = doc.getCurrentPageInfo?.()
      if (info?.pageNumber) prev = info.pageNumber
    } catch (_) {
      /* ignore */
    }
    for (let i = 1; i <= n; i++) {
      doc.setPage(i)
      applyJsPdfDiagonalWatermarkOnCurrentPage(doc, wmOpts)
    }
    if (n > 0) doc.setPage(Math.min(Math.max(1, prev), n))
  }
}

/**
 * Company payroll list PDF (same layout as Reports).
 * `runs` may be DB payroll runs or Payroll page preview lines — same fields (employee_id, pay components, deductions).
 */
export const generateCompanyPayrollListPDF = async ({
  companyName,
  companyLogoUrl,
  period,
  runs,
  empById,
  settings,
  deductionsByEmployeeId: _deductionsByEmployeeId, // kept for API compatibility; amounts come from `runs` rows (matches Payroll table)
  pdfBranding: pdfBrandingIn = null
}) => {
  const pdfBranding = mergePdfBranding(pdfBrandingIn || {})
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const sideM = PAYROLL_PDF_SIDE_MARGIN_PT

  // Load logo once for reuse on all pages
  let logoData = await loadLogoForPDF(doc, companyLogoUrl)
  if (!logoData) {
    // Fallback so payslips still show a watermark when company logo URL is not set/reachable.
    logoData = await loadLogoForPDF(doc, '/logo.png')
  }

  const periodTitleWm = format(parseISO(`${period}-01`), 'MMMM yyyy').toUpperCase()
  const applyWatermarkOverlay = await buildJsPdfWatermarkOverlay(doc, {
    companyName,
    companyLogoUrl,
    logoDataPreloaded: logoData,
    extraLines: [`Company payroll list — ${periodTitleWm}`],
    opacityMul: pdfBranding.watermarkOpacityMul
  })

  // Helper to draw the logo at the top center of the page (letterhead)
  const drawPayrollLogoTopCenter = () => {
    if (!logoData || !pdfBranding.letterheadLogoEnabled) return
    try {
      const pageWidth = doc.internal.pageSize.getWidth()
      const x = (pageWidth - logoData.width) / 2
      const y = 12
      doc.addImage(logoData.pngDataUrl, 'PNG', x, y, logoData.width, logoData.height)
    } catch (error) {
      console.warn('Failed to add payroll logo to PDF page:', error)
    }
  }

  // Add logo to first page (top center)
  drawPayrollLogoTopCenter()

  const reportDate = format(new Date(), 'dd MMMM yyyy')
  const periodTitle = periodTitleWm
  const pageW0 = doc.internal.pageSize.getWidth()
  const hasLogo = !!(companyLogoUrl && pdfBranding.letterheadLogoEnabled)

  // Header: compact vertical rhythm — text sits below logo band (~115 pt); frees space for table on landscape A4
  const headerDateY = hasLogo ? 118 : 26
  const companyNameY = hasLogo ? 131 : 42
  const periodTitleY = hasLogo ? 152 : 62

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(reportDate, sideM, headerDateY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text(String(companyName || '').toUpperCase(), pageW0 / 2, companyNameY, { align: 'center' })

  doc.setFontSize(12)
  doc.text(`COMPANY PAYROLL LIST FOR ${periodTitle}`, pageW0 / 2, periodTitleY, { align: 'center' })

  // Full-width separator directly above table start
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.5)
  const headerSeparatorY = periodTitleY + 8
  doc.line(sideM, headerSeparatorY, pageW0 - sideM, headerSeparatorY)

  /** Main grid starts immediately below separator (no gap overlap with title block). */
  const tableStartY = headerSeparatorY + 5

  // Build rows (sorted by staff no)
  const rows = []
  let totals = {
    basic: 0,
    hse: 0,
    sday: 0,
    absence: 0,
    otherEarn: 0,
    totalEarn: 0,
    paye: 0,
    nssf: 0,
    shif: 0,
    shopping: 0,
    advance: 0,
    housingLevy: 0,
    otherDed: 0,
    pension: 0,
    totalDed: 0,
    net: 0
  }

  // Sort by STAFF NO. (handle both numeric and alphanumeric staff numbers)
  const sortedRuns = [...(runs || [])].sort((a, b) => {
    const ea = empById.get(a.employee_id)
    const eb = empById.get(b.employee_id)
    const sa = (ea?.employee_id || ea?.staff_no || '').toString().trim()
    const sb = (eb?.employee_id || eb?.staff_no || '').toString().trim()
    
    // Try numeric comparison first (for numeric staff numbers like "001", "002", "010")
    const numA = parseInt(sa, 10)
    const numB = parseInt(sb, 10)
    
    if (!isNaN(numA) && !isNaN(numB)) {
      // Both are numeric - compare as numbers
      return numA - numB
    }
    
    // If not both numeric, use string comparison
    return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' })
  })

  // Bank / payment breakdown (based on employee bank_name)
  const bankTotals = new Map()

  for (const run of sortedRuns) {
    const emp = empById.get(run.employee_id)
    if (!emp) continue

    const m = getPayrollListRowMetrics(run, emp, settings)
    const bankName = (emp.bank_name || '').trim() || 'CASH'
    bankTotals.set(bankName, (bankTotals.get(bankName) || 0) + m.net)

    rows.push(formatPayrollListRowForPdf(m))

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
    totals.housingLevy += m.housingLevy
    totals.otherDed += m.otherDed
    totals.pension += m.pension
    totals.totalDed += m.totalDed
    totals.net += m.net
  }

  const pageW = doc.internal.pageSize.getWidth()
  const innerTableW = pageW - sideM * 2
  const payrollColStyles = buildPayrollListColumnStyles(innerTableW)

  autoTable(doc, {
    startY: tableStartY,
    theme: 'grid',
    head: [PAYROLL_LIST_TABLE_HEADERS],
    body: rows,
    foot: [[
      'GRAND TOTAL:',
      '',
      money(totals.basic),
      money(totals.hse),
      money(totals.sday),
      money(totals.absence),
      money(totals.otherEarn),
      money(totals.totalEarn),
      money(totals.paye),
      moneyWhole(totals.nssf),
      money(totals.shif),
      money(totals.shopping),
      money(totals.advance),
      money(totals.housingLevy),
      money(totals.otherDed),
      money(totals.pension),
      money(totals.totalDed),
      moneyNet(totals.net)
    ]],
    styles: {
      fontSize: PAYROLL_LIST_BODY_FONT_PT,
      cellPadding: PAYROLL_LIST_CELL_PADDING_PT,
      overflow: 'linebreak',
      lineColor: [220, 220, 220],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: 0,
      fontStyle: 'bold',
      fontSize: PAYROLL_LIST_BODY_FONT_PT
    },
    footStyles: {
      fillColor: [250, 250, 250],
      textColor: 0,
      fontStyle: 'bold',
      fontSize: PAYROLL_LIST_BODY_FONT_PT
    },
    margin: { left: sideM, right: sideM },
    tableWidth: innerTableW,
    columnStyles: payrollColStyles,
    didDrawPage: (data) => {
      // Keep payroll logo on first page only.
      if (data.pageNumber === 1) {
        drawPayrollLogoTopCenter()
      }
      // Footer with page number - better positioning
      const pageCount = doc.getNumberOfPages()
      const pageNum = doc.getCurrentPageInfo().pageNumber
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(120, 120, 120)
      const pageText = `Page ${pageNum} of ${pageCount}`
      doc.text(pageText, pageW - sideM, doc.internal.pageSize.getHeight() - 15, { align: 'right' })
      doc.setTextColor(0, 0, 0) // Reset to black
    }
  })

  // Summary breakdown section - improved spacing
  let y2 = doc.lastAutoTable.finalY + 25
  const pageH = doc.internal.pageSize.getHeight()
  if (y2 > pageH - 200) {
    doc.addPage()
    y2 = hasLogo ? 124 : 48
  }
  
  // Add section header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('SUMMARY BREAKDOWN', sideM, y2 - 5)
  y2 += 5

  // Build summary rows matching template format
  // Banks first, then deductions, with amounts in TOTAL EARN. column position (index 7)
  const summaryRows = []
  
  // Add banks with net pay amounts in TOTAL EARN. column
  const sortedBanks = [...bankTotals.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  for (const [bank, amount] of sortedBanks) {
    const row = Array(18).fill('')
    row[0] = bank
    row[7] = moneyNet(amount) // Net by bank — whole KES, same as payroll net_pay
    summaryRows.push(row)
  }
  
  // Add empty row separator
  summaryRows.push(Array(18).fill(''))
  
  // Add deductions with amounts in TOTAL EARN. column
  const deductionItems = [
    ['ADVANCE', totals.advance],
    ['SHOPPING', totals.shopping],
    ['PAYE', totals.paye],
    ['NSSF', roundNSSFAmount(totals.nssf)],
    ['S.H.I.F', totals.shif],
    ['HOUSING (AHL)', totals.housingLevy],
    ['TOTAL EARN.', totals.totalEarn]
  ]
  
  for (const [label, amount] of deductionItems) {
    const row = Array(18).fill('')
    row[0] = label
    row[7] = money(amount) // Amount in TOTAL EARN. column
    summaryRows.push(row)
  }

  // Summary grid: same column widths as main table so amounts align with TOTAL EARN. / NET PAY columns
  const summaryColStyles = { ...payrollColStyles }
  summaryColStyles[0] = { ...summaryColStyles[0], fontStyle: 'bold' }
  summaryColStyles[7] = { ...summaryColStyles[7], fontStyle: 'bold' }

  autoTable(doc, {
    startY: y2,
    body: summaryRows,
    styles: {
      fontSize: PAYROLL_LIST_BODY_FONT_PT,
      cellPadding: PAYROLL_LIST_CELL_PADDING_PT,
      lineColor: [220, 220, 220],
      lineWidth: 0.1
    },
    margin: { left: sideM, right: sideM },
    tableWidth: innerTableW,
    columnStyles: summaryColStyles,
    theme: 'grid'
  })

  // Add footer with larger signature area
  let footerY = doc.lastAutoTable.finalY + 40
  if (footerY > pageH - 150) {
    doc.addPage()
    footerY = 50
  }

  // Add separator line before signatures
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.5)
  doc.line(sideM, footerY - 5, doc.internal.pageSize.getWidth() - sideM, footerY - 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Prepared by:', sideM, footerY + 8)
  doc.line(sideM + 65, footerY + 10, sideM + 220, footerY + 10)
  doc.text('Checked by:', sideM, footerY + 36)
  doc.line(sideM + 65, footerY + 38, sideM + 220, footerY + 38)
  doc.text('Manager sign 1:', sideM, footerY + 64)
  doc.line(sideM + 94, footerY + 66, sideM + 260, footerY + 66)
  doc.text('Manager sign 2:', sideM + 280, footerY + 64)
  doc.line(sideM + 374, footerY + 66, sideM + 520, footerY + 66)
  doc.text('Date:', sideM + 540, footerY + 64)
  doc.line(sideM + 570, footerY + 66, sideM + 680, footerY + 66)
  
  // Add date at bottom - better positioning
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(reportDate, sideM, doc.internal.pageSize.getHeight() - 25)
  doc.setTextColor(0, 0, 0) // Reset to black

  // Add footer to all pages
  addFooterToPDF(doc, { hidePageNumber: true, marginX: sideM }) // Hide page number since it's already added in didDrawPage

  if (applyWatermarkOverlay) applyWatermarkOverlay()
  const pdfBytes = doc.output('arraybuffer')
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

export const fetchPayrollDataForYear = async (companyId, year) => {
  const prefix = `${year}-` // e.g. "2026-"
  if (isLocalDataSource()) {
    const res = await localApiFetch(
      `/api/payroll/runs?company_id=${encodeURIComponent(companyId)}`
    )
    if (!res.ok) return []
    const all = await res.json()
    return all.filter((r) => String(r.period || '').startsWith(prefix))
  }
  const runs = await listAllDocuments(COLLECTIONS.PAYROLL_RUNS, [
    Query.equal('company_id', companyId),
    Query.startsWith('period', prefix)
  ])
  return runs
}

export const generateP10CSV = ({ runs, empById, period }) => {
  const header = [
    'EmployeeName',
    'KRAPIN',
    'Period',
    'GrossPay',
    'TaxablePay',
    'PAYE',
    'SHIF_Employee',
    'NSSF_Employee',
    'AHL_Employee',
    'NetPay'
  ]

  const rows = [header]
  for (const run of runs) {
    const emp = empById.get(run.employee_id)
    if (!emp) continue

    rows.push([
      emp.name || '',
      emp.kra_pin || '',
      period,
      run.gross_pay ?? 0,
      run.taxable_pay ?? 0,
      run.paye ?? 0,
      run.shif_employee ?? 0,
      roundNSSFAmount(run.nssf_employee ?? 0),
      run.ahl_employee ?? 0,
      run.net_pay ?? 0
    ])
  }

  return toCSV(rows)
}

export const generateNSSFCsv = ({ runs, empById }) => {
  const header = [
    'PayrollNumber',
    'Surname',
    'OtherNames',
    'IDNumber',
    'KRAPIN',
    'NSSFNumber',
    'GrossPay',
    'VoluntaryContributions'
  ]

  const rows = [header]
  for (const run of runs) {
    const emp = empById.get(run.employee_id)
    if (!emp) continue

    const { surname, otherNames } = splitName(emp.name || '')
    rows.push([
      emp.employee_id || emp.staff_no || '',
      surname,
      otherNames,
      emp.id_number || '',
      emp.kra_pin || '',
      emp.nssf_number || '',
      run.gross_pay ?? 0,
      0
    ])
  }

  return toCSV(rows)
}

export const generateSHIFCsv = ({ runs, empById, period }) => {
  const header = [
    'EmployeeName',
    'SHIFNumber',
    'KRAPIN',
    'Period',
    'GrossPay',
    'SHIF_Employee',
    'SHIF_Employer'
  ]

  const rows = [header]
  for (const run of runs) {
    const emp = empById.get(run.employee_id)
    if (!emp) continue
    rows.push([
      emp.name || '',
      emp.shif_number || '',
      emp.kra_pin || '',
      period,
      run.gross_pay ?? 0,
      run.shif_employee ?? 0,
      run.shif_employer ?? 0
    ])
  }

  return toCSV(rows)
}

export const generateAHLCsv = ({ runs, empById, period }) => {
  const header = [
    'EmployeeName',
    'KRAPIN',
    'Period',
    'GrossPay',
    'AHL_Employee',
    'AHL_Employer',
    'AHL_Total'
  ]

  const rows = [header]
  for (const run of runs) {
    const emp = empById.get(run.employee_id)
    if (!emp) continue
    const empAhl = Number(run.ahl_employee ?? 0)
    const empAhlEr = Number(run.ahl_employer ?? 0)
    rows.push([
      emp.name || '',
      emp.kra_pin || '',
      period,
      run.gross_pay ?? 0,
      empAhl,
      empAhlEr,
      empAhl + empAhlEr
    ])
  }

  return toCSV(rows)
}

export const generateP9Csv = ({ runs, employees, year }) => {
  // Group runs by employee
  const byEmp = new Map()
  for (const run of runs) {
    const list = byEmp.get(run.employee_id) || []
    list.push(run)
    byEmp.set(run.employee_id, list)
  }

  const empById = new Map(employees.map(e => [e.$id, e]))

  const header = [
    'EmployeeName',
    'KRAPIN',
    'Year',
    'TotalGross',
    'TotalTaxable',
    'TotalPAYE',
    'TotalSHIF',
    'TotalNSSF',
    'TotalAHL',
    'TotalNet'
  ]

  const rows = [header]

  for (const [employeeId, list] of byEmp.entries()) {
    const emp = empById.get(employeeId)
    if (!emp) continue

    let gross = 0
    let taxable = 0
    let paye = 0
    let shif = 0
    let nssf = 0
    let ahl = 0
    let net = 0

    for (const r of list) {
      gross += Number(r.gross_pay || 0)
      taxable += Number(r.taxable_pay || 0)
      paye += Number(r.paye || 0)
      shif += Number(r.shif_employee || 0)
      nssf += roundNSSFAmount(r.nssf_employee || 0)
      ahl += Number(r.ahl_employee || 0)
      net += Number(r.net_pay || 0)
    }

    rows.push([
      emp.name || '',
      emp.kra_pin || '',
      year,
      gross.toFixed(2),
      taxable.toFixed(2),
      paye.toFixed(2),
      shif.toFixed(2),
      nssf.toFixed(2),
      ahl.toFixed(2),
      net.toFixed(2)
    ])
  }

  return toCSV(rows)
}

/** PDF open password for one-employee payslip: letters and digits from ID Number (no spaces/symbols). */
export function payslipOpenPasswordFromEmployee(emp) {
  const raw = String(emp?.id_number ?? '').trim()
  return raw.replace(/[^0-9A-Za-z]/g, '')
}

// Payslips PDF — 4 per landscape page; payroll column titles + values (same order & figures as Payroll grid); NET SALARY bold at bottom of each slip.
export const generatePayslipsPDF = async ({
  companyName,
  companyTaxPin,
  companyLogoUrl,
  period,
  runs,
  empById,
  deductionsByEmployeeId,
  payrollSettings = null,
  pdfBranding: pdfBrandingIn = null,
  pdfUserPassword = null
}) => {
  const pdfBranding = mergePdfBranding(pdfBrandingIn || {})

  const runsWithEmp = (runs || []).filter((r) => empById.get(r.employee_id))
  const pwCandidate = pdfUserPassword != null ? String(pdfUserPassword).trim() : ''
  let encryptionOptions
  if (pwCandidate) {
    if (runsWithEmp.length !== 1) {
      console.warn('[generatePayslipsPDF] pdfUserPassword ignored: expected exactly one payslip row')
    } else {
      encryptionOptions = {
        userPassword: pwCandidate,
        ownerPassword: `${pwCandidate}::dropsoft-owner`,
        userPermissions: ['print']
      }
    }
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
    ...(encryptionOptions ? { encryption: encryptionOptions } : {})
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const payslipWidth = (pageWidth - 60) / 2
  const payslipHeight = (pageHeight - 60) / 2

  const [year, month] = String(period).split('-')
  const monthNames = [
    'JANUARY',
    'FEBRUARY',
    'MARCH',
    'APRIL',
    'MAY',
    'JUNE',
    'JULY',
    'AUGUST',
    'SEPTEMBER',
    'OCTOBER',
    'NOVEMBER',
    'DECEMBER'
  ]
  const mi = Math.max(0, Math.min(11, (parseInt(month, 10) || 1) - 1))
  const periodDisplay = `${monthNames[mi]} ${year || ''}`

  let logoData = await loadLogoForPDF(doc, companyLogoUrl)
  if (!logoData?.pngDataUrl) {
    logoData = await loadLogoForPDF(doc, '/logo.png')
  }

  const payslipWmMul = pdfBranding.watermarkOpacityMulPayslip ?? pdfBranding.watermarkOpacityMul

  const applyWatermarkOverlay = await buildJsPdfWatermarkOverlay(doc, {
    companyName,
    companyLogoUrl,
    logoDataPreloaded: logoData,
    extraLines: [`Payslips — ${periodDisplay}`],
    opacityMul: payslipWmMul
  })

  let wmStamp = null
  if (logoData?.pngDataUrl) {
    const rasterOp = Math.min(0.38, Math.max(0.16, 0.24 * (payslipWmMul / 0.52)))
    wmStamp = await buildPayslipWatermarkStamp(
      logoData.pngDataUrl,
      payslipWidth * 0.78,
      payslipHeight * 0.55,
      rasterOp
    )
  }

  const settings = {
    standard_allowance: parseFloat(payrollSettings?.standard_allowance) || 0,
    housing_allowance: parseFloat(payrollSettings?.housing_allowance) || 0,
    housing_allowance_type: payrollSettings?.housing_allowance_type || 'fixed'
  }

  const dedMap =
    deductionsByEmployeeId instanceof Map
      ? deductionsByEmployeeId
      : new Map()

  const sortedRuns = [...(runs || [])].sort((a, b) => {
    const ea = empById.get(a.employee_id)
    const eb = empById.get(b.employee_id)
    const sa = (ea?.employee_id || ea?.staff_no || '').toString().trim()
    const sb = (eb?.employee_id || eb?.staff_no || '').toString().trim()
    const numA = parseInt(sa, 10)
    const numB = parseInt(sb, 10)
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB
    return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' })
  })

  let payslipIndex = 0

  for (const run of sortedRuns) {
    const emp = empById.get(run.employee_id)
    if (!emp) continue

    if (payslipIndex > 0 && payslipIndex % 4 === 0) {
      doc.addPage()
    }

    const col = payslipIndex % 2
    const row = Math.floor((payslipIndex % 4) / 2)
    const x = 30 + col * (payslipWidth + 20)
    const y = 30 + row * (payslipHeight + 20)

    let headDy = 0
    if (pdfBranding.letterheadLogoEnabled && logoData?.pngDataUrl) {
      const maxLW = payslipWidth * 0.42
      const maxLH = 28
      const scale = Math.min(maxLW / logoData.width, maxLH / logoData.height, 1)
      const lw = logoData.width * scale
      const lh = logoData.height * scale
      const lx = x + (payslipWidth - lw) / 2
      const ly = y + 4
      try {
        doc.addImage(logoData.pngDataUrl, 'PNG', lx, ly, lw, lh)
        headDy = lh + 5
      } catch (e) {
        console.warn('Payslip letterhead logo failed:', e)
      }
    }

    if (wmStamp) {
      const wx = x + (payslipWidth - wmStamp.width) / 2
      const wy = y + (payslipHeight - wmStamp.height) / 2
      try {
        const stampDrawOp = Math.min(0.45, Math.max(0.16, 0.26 * (payslipWmMul / 0.52)))
        if (typeof doc.setGState === 'function' && typeof doc.GState === 'function') {
          doc.setGState(new doc.GState({ opacity: stampDrawOp }))
        }
        doc.addImage(wmStamp.pngDataUrl, 'PNG', wx, wy, wmStamp.width, wmStamp.height)
        if (typeof doc.setGState === 'function' && typeof doc.GState === 'function') {
          doc.setGState(new doc.GState({ opacity: 1 }))
        }
      } catch (e) {
        console.warn('Payslip watermark addImage failed:', e)
      }
    }

    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text(`${companyName} PIN: ${companyTaxPin || ''}`, x + 8, y + 12 + headDy)
    doc.text(`${periodDisplay} PAYSLIP`, x + 8, y + 22 + headDy)

    doc.setFont('helvetica', 'normal')
    const staffNo =
      String(emp.staff_no || emp.employee_id || '').trim() ||
      (emp.$id ? String(emp.$id).slice(-12) : '')
    doc.text(`NAME: ${emp.name || ''}  NO.: ${staffNo}`, x + 8, y + 32 + headDy)

    const deduction = dedMap.get(run.employee_id)
    const formatted = formatPayrollListRowForPdf(
      getPayrollListRowMetrics(run, emp, settings, deduction || {})
    )

    const padL = x + 8
    const amtR = x + payslipWidth - 10
    const rowLH = Math.min(
      10,
      Math.max(7.5, (payslipHeight - 52 - 38 - headDy) / 18)
    )
    let ty = y + 42 + headDy
    doc.setTextColor(0, 0, 0)

    /** Highlight payroll total lines: TOTAL EARN., TOTAL DED., NET PAY */
    const isTotalRow = (idx) => idx === 7 || idx === 16 || idx === 17

    for (let i = 0; i < PAYROLL_LIST_TABLE_HEADERS.length; i++) {
      if (isTotalRow(i)) {
        doc.setFillColor(232, 242, 255)
        doc.rect(x + 6, ty - rowLH + 2.5, payslipWidth - 12, rowLH - 1.2, 'F')
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(isTotalRow(i) ? 6.5 : 6)
      doc.setTextColor(isTotalRow(i) ? 15 : 0, isTotalRow(i) ? 35 : 0, isTotalRow(i) ? 70 : 0)
      doc.text(PAYROLL_LIST_TABLE_HEADERS[i], padL, ty, {
        maxWidth: payslipWidth - 72,
        lineBreak: false
      })
      doc.setFont('helvetica', isTotalRow(i) ? 'bold' : 'normal')
      doc.text(String(formatted[i] ?? ''), amtR, ty, { align: 'right' })
      doc.setTextColor(0, 0, 0)
      ty += rowLH
    }

    const netFooterY = y + payslipHeight - 26
    doc.setDrawColor(160, 160, 160)
    doc.setLineWidth(0.4)
    doc.line(x + 10, netFooterY - 12, x + payslipWidth - 10, netFooterY - 12)

    doc.setFillColor(212, 228, 255)
    doc.rect(x + 12, netFooterY - 15, payslipWidth - 24, 16, 'F')
    doc.setDrawColor(120, 150, 200)
    doc.setLineWidth(0.55)
    doc.rect(x + 12, netFooterY - 15, payslipWidth - 24, 16, 'S')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(12, 32, 72)
    doc.text(`NET SALARY: ${formatted[17] ?? ''}`, x + payslipWidth / 2, netFooterY, { align: 'center' })
    doc.setTextColor(0, 0, 0)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.text('SIGNATURE:', x + 10, y + payslipHeight - 8)
    doc.line(x + 54, y + payslipHeight - 7, x + payslipWidth - 14, y + payslipHeight - 7)

    payslipIndex++
  }

  addFooterToPDF(doc)

  if (applyWatermarkOverlay) applyWatermarkOverlay()
  const pdfBytes = doc.output('arraybuffer')
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

// Banking Report PDF Generator
export const generateBankingReportPDF = async ({
  companyName,
  companyLogoUrl,
  period,
  runs,
  empById,
  pdfBranding: pdfBrandingIn = null
}) => {
  const pdfBranding = mergePdfBranding(pdfBrandingIn || {})
  const useLetterhead = !!(companyLogoUrl && pdfBranding.letterheadLogoEnabled)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })

  const [year, month] = period.split('-')
  const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
  const bankingPeriodLine = `Banking report — ${monthNames[parseInt(month, 10) - 1]} ${year}`
  
  // Load logo once for reuse on all pages
  const logoData = await loadLogoForPDF(doc, companyLogoUrl)
  const applyWatermarkOverlay = await buildJsPdfWatermarkOverlay(doc, {
    companyName,
    companyLogoUrl,
    logoDataPreloaded: logoData,
    extraLines: [bankingPeriodLine],
    opacityMul: pdfBranding.watermarkOpacityMul
  })

  // Add logo to first page
  if (logoData && useLetterhead) {
    addLogoToCurrentPage(doc, logoData)
  }
  
  // Header - leave room for logo
  const headerY = useLetterhead ? LOGO_HEADER_START_Y : 40
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(companyName || 'COMPANY', 40, headerY)
  
  doc.setFontSize(12)
  const periodY = useLetterhead ? LOGO_HEADER_START_Y + 20 : 60
  doc.text(`BANKING REPORT FOR ${monthNames[parseInt(month, 10) - 1]} ${year}`, 40, periodY)
  
  // Group by bank + branch
  const bankGroups = new Map()
  for (const run of runs) {
    const emp = empById.get(run.employee_id)
    if (!emp) continue
    
    const bankName = String(emp.bank_name || 'CASH').trim() || 'CASH'
    const branch = String(emp.bank_branch || '').trim()
    const key = `${bankName}|||${branch}`
    if (!bankGroups.has(key)) {
      bankGroups.set(key, { bankName, branch, items: [] })
    }
    bankGroups.get(key).items.push({ emp, run })
  }
  
  const banks = [...bankGroups.values()].sort((a, b) =>
    `${a.bankName} ${a.branch}`.localeCompare(`${b.bankName} ${b.branch}`, undefined, { sensitivity: 'base' })
  )
  let bankIdx = 0
  let y = useLetterhead ? LOGO_TABLE_START_Y : 90

  for (const { bankName, branch, items } of banks) {
    if (bankIdx > 0) {
      doc.addPage()
      if (logoData && useLetterhead) {
        addLogoToCurrentPage(doc, logoData)
      }
      const hy = logoData ? LOGO_HEADER_START_Y : 40
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(companyName || 'COMPANY', 40, hy)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(`BANKING REPORT FOR ${monthNames[parseInt(month, 10) - 1]} ${year}`, 40, hy + 22)
      y = logoData ? LOGO_TABLE_START_Y : 90
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    const bankHeading = branch ? `${bankName} - ${branch}` : bankName
    doc.text(bankHeading, 40, y)
    y += 20
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Cheque Number:', 40, y)
    doc.line(125, y + 1, 300, y + 1)
    y += 16
    const sortedItems = [...items].sort((a, b) => {
      const staffA = String(a.emp.employee_id || a.emp.staff_no || '')
      const staffB = String(b.emp.employee_id || b.emp.staff_no || '')
      return staffA.localeCompare(staffB, undefined, { numeric: true, sensitivity: 'base' })
    })

    autoTable(doc, {
      startY: y,
      head: [['Staff No', 'Employee ID No', 'Name', 'Account', 'Net Pay']],
      body: sortedItems.map(({ emp, run }) => [
        emp.employee_id || emp.staff_no || '',
        emp.id_number || '',
        emp.name || '',
        emp.bank_account || '',
        moneyNet(run.net_pay)
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' },
      columnStyles: {
        4: { halign: 'right' }
      }
    })

    const bankTotal = sortedItems.reduce((sum, { run }) => sum + roundNetPay(run.net_pay), 0)
    y = doc.lastAutoTable.finalY + 10
    doc.setFont('helvetica', 'bold')
    doc.text(`Total: ${moneyNet(bankTotal)}`, 40, y)
    y += 22
    doc.setFont('helvetica', 'normal')
    doc.text('Manager Sign:', 40, y)
    doc.line(110, y + 1, 280, y + 1)
    doc.text('Date:', 320, y)
    doc.line(350, y + 1, 450, y + 1)
    bankIdx += 1
  }
  
  addFooterToPDF(doc)

  if (applyWatermarkOverlay) applyWatermarkOverlay()
  const pdfBytes = doc.output('arraybuffer')
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

// NSSF Report PDF Generator matching template
export const generateNSSFReportPDF = async ({
  companyName,
  companyLogoUrl,
  period,
  runs,
  empById,
  pdfBranding: pdfBrandingIn = null
}) => {
  const pdfBranding = mergePdfBranding(pdfBrandingIn || {})
  const useLetterhead = !!(companyLogoUrl && pdfBranding.letterheadLogoEnabled)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })

  const [year, month] = period.split('-')
  const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
  const nssfPeriodLine = `NSSF report — ${monthNames[parseInt(month, 10) - 1]} ${year}`
  
  // Load logo once for reuse on all pages
  const logoData = await loadLogoForPDF(doc, companyLogoUrl)
  const applyWatermarkOverlay = await buildJsPdfWatermarkOverlay(doc, {
    companyName,
    companyLogoUrl,
    logoDataPreloaded: logoData,
    extraLines: [nssfPeriodLine],
    opacityMul: pdfBranding.watermarkOpacityMul
  })

  // Add logo to first page
  if (logoData && useLetterhead) {
    addLogoToCurrentPage(doc, logoData)
  }

  // Header - leave room for logo
  const headerY = useLetterhead ? LOGO_HEADER_START_Y : 40
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(companyName || 'COMPANY', 40, headerY)

  doc.setFontSize(12)
  const periodY = useLetterhead ? LOGO_HEADER_START_Y + 20 : 60
  doc.text(`NSSF REPORT FOR ${monthNames[parseInt(month, 10) - 1]} ${year}`, 40, periodY)
  
  const rows = []
  let totalGross = 0
  let totalNSSF = 0
  
  for (const run of runs) {
    const emp = empById.get(run.employee_id)
    if (!emp) continue
    
    const { surname, otherNames } = splitName(emp.name || '')
    const gross = Number(run.gross_pay || 0)
    const nssf = roundNSSFAmount(run.nssf_employee || 0)
    
    rows.push([
      emp.employee_id || emp.staff_no || '',
      surname,
      otherNames,
      emp.id_number || '',
      emp.kra_pin || '',
      emp.nssf_number || '',
      money(gross),
      moneyWhole(nssf)
    ])
    
    totalGross += gross
    totalNSSF += nssf
  }
  
  // Add totals row
  rows.push([
    'TOTAL',
    '',
    '',
    '',
    '',
    '',
    money(totalGross),
    moneyWhole(totalNSSF)
  ])
  
  const tableStartY = useLetterhead ? LOGO_TABLE_START_Y : 80
  autoTable(doc, {
    startY: tableStartY,
    head: [['Payroll No', 'Surname', 'Other Names', 'ID Number', 'KRA PIN', 'NSSF Number', 'Gross Pay', 'NSSF Contribution']],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' },
    columnStyles: {
      6: { halign: 'right' },
      7: { halign: 'right' }
    },
    footStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' },
    didDrawPage: (data) => {
      // Add logo to each page
      if (logoData && useLetterhead) {
        addLogoToCurrentPage(doc, logoData)
      }
    }
  })
  
  // Add footer to all pages
  addFooterToPDF(doc)
  
  if (applyWatermarkOverlay) applyWatermarkOverlay()
  const pdfBytes = doc.output('arraybuffer')
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

// P9 Report PDF Generator matching template
export const generateP9ReportPDF = async ({
  companyName,
  companyLogoUrl,
  year,
  runs,
  employees,
  pdfBranding: pdfBrandingIn = null
}) => {
  const pdfBranding = mergePdfBranding(pdfBrandingIn || {})
  const useLetterhead = !!(companyLogoUrl && pdfBranding.letterheadLogoEnabled)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  
  // Load logo once for reuse on all pages
  const logoData = await loadLogoForPDF(doc, companyLogoUrl)
  const applyWatermarkOverlay = await buildJsPdfWatermarkOverlay(doc, {
    companyName,
    companyLogoUrl,
    logoDataPreloaded: logoData,
    extraLines: [`P9 tax card — ${year}`],
    opacityMul: pdfBranding.watermarkOpacityMul
  })

  // Add logo to first page
  if (logoData && useLetterhead) {
    addLogoToCurrentPage(doc, logoData)
  }
  
  // Header - leave room for logo
  const headerY = useLetterhead ? LOGO_HEADER_START_Y : 40
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(companyName || 'COMPANY', 40, headerY)
  doc.setFontSize(12)
  const periodY = useLetterhead ? LOGO_HEADER_START_Y + 20 : 60
  doc.text(`P9 TAX DEDUCTION CARD FOR YEAR ${year}`, 40, periodY)
  
  // Group runs by employee
  const byEmp = new Map()
  for (const run of runs) {
    const list = byEmp.get(run.employee_id) || []
    list.push(run)
    byEmp.set(run.employee_id, list)
  }
  
  const empById = new Map(employees.map(e => [e.$id, e]))
  const rows = []
  
  for (const [employeeId, list] of byEmp.entries()) {
    const emp = empById.get(employeeId)
    if (!emp) continue
    
    let gross = 0
    let taxable = 0
    let paye = 0
    let shif = 0
    let nssf = 0
    let ahl = 0
    let net = 0
    
    for (const r of list) {
      gross += Number(r.gross_pay || 0)
      taxable += Number(r.taxable_pay || 0)
      paye += Number(r.paye || 0)
      shif += Number(r.shif_employee || 0)
      nssf += roundNSSFAmount(r.nssf_employee || 0)
      ahl += Number(r.ahl_employee || 0)
      net += Number(r.net_pay || 0)
    }
    
    rows.push([
      emp.name || '',
      emp.kra_pin || '',
      year,
      money(gross),
      money(taxable),
      money(paye),
      money(shif),
      money(roundNSSFAmount(nssf)),
      money(ahl),
      money(net)
    ])
  }
  
  const tableStartY = useLetterhead ? LOGO_TABLE_START_Y : 80
  autoTable(doc, {
    startY: tableStartY,
    head: [['Employee Name', 'KRA PIN', 'Year', 'Total Gross', 'Total Taxable', 'Total PAYE', 'Total SHIF', 'Total NSSF', 'Total AHL', 'Total Net']],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' }
    },
    didDrawPage: (data) => {
      // Add logo to each page
      if (logoData && useLetterhead) {
        addLogoToCurrentPage(doc, logoData)
      }
    }
  })
  
  // Add footer to all pages
  addFooterToPDF(doc)
  
  if (applyWatermarkOverlay) applyWatermarkOverlay()
  const pdfBytes = doc.output('arraybuffer')
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

// Fetch attendance data for a period
//
// Data Processing: Attendance & Leave
// Dynamic Leave & Attendance (Today = report generation date):
// - Days Present: If on leave → count(ReportPeriodStart to min(LeaveStart-1, ReportPeriodEnd)). Else → count(ReportPeriodStart to min(ReportPeriodEnd, Today)). Minus absent.
// - Leave Remaining: DaysTaken = countDays(LeaveStart to Today); Remaining = max(0, TotalLeaveGranted - DaysTaken).
export const fetchAttendanceDataForPeriod = async (companyId, period) => {
  try {
    const [year, month] = period.split('-').map(Number)
    if (!year || !month || month < 1 || month > 12) {
      throw new Error(`Invalid period format: ${period}. Expected format: YYYY-MM`)
    }
    
    const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd')
    const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd')
    const today = format(new Date(), 'yyyy-MM-dd')
    const reportAsAtDate = today < startDate ? startDate : (today > endDate ? endDate : today)
    const todayDate = parseISO(today)
    const periodStartDate = parseISO(startDate)
    const periodEndDate = parseISO(endDate)
    const dayMs = 1000 * 60 * 60 * 24

    const [employees, attendanceRecords, leaveRequests, deductions] = await Promise.all([
      getEmployees(companyId, { status: 'active' }),
      isLocalDataSource()
        ? (async () => {
            const res = await localApiFetch(
              `/api/attendance/records?company_id=${encodeURIComponent(companyId)}&from=${encodeURIComponent(startDate)}&to=${encodeURIComponent(endDate)}`
            )
            if (!res.ok) return []
            return res.json()
          })()
        : listAllDocuments(COLLECTIONS.ATTENDANCE, [
            Query.equal('company_id', companyId),
            Query.greaterThanEqual('date', startDate),
            Query.lessThanEqual('date', endDate)
          ]),
      isLocalDataSource()
        ? (async () => {
            const all = await getLeaveRequests(companyId, { status: 'approved' })
            return all.filter(
              (leave) => leave.start_date <= endDate && leave.end_date >= startDate
            )
          })()
        : listAllDocuments(COLLECTIONS.LEAVE_REQUESTS, [
            Query.equal('company_id', companyId),
            Query.equal('status', 'approved'),
            Query.lessThanEqual('start_date', endDate),
            Query.greaterThanEqual('end_date', startDate)
          ]),
      getEmployeeDeductionsForPeriod(companyId, period).catch(() => [])
    ])

    const empById = new Map(employees.map(e => [e.$id, e]))
    const empByUserId = new Map(employees.map(e => [e.user_id || e.$id, e]))

    // Group attendance by employee and date
    const attendanceByEmployee = new Map()
    attendanceRecords.forEach(record => {
      const emp = empByUserId.get(record.user_id) || empById.get(record.user_id)
      if (!emp) return

      const empId = emp.$id
      if (!attendanceByEmployee.has(empId)) {
        attendanceByEmployee.set(empId, {
          employee: emp,
          records: [],
          dates: new Set(),
          leaveDays: 0
        })
      }

      const data = attendanceByEmployee.get(empId)
      data.records.push(record)
      data.dates.add(record.date)
    })

    const asAtDate = parseISO(reportAsAtDate)
    const leaveDaysByEmployee = new Map()
    const leaveDatesByEmployee = new Map()
    const leaveDatesUpToAsAtByEmployee = new Map()
    const remainingLeaveDaysByEmployee = new Map()
    const earliestLeaveStartInPeriodByEmployee = new Map()

    leaveRequests.forEach(leave => {
      const empId = leave.employee_id
      if (!empById.has(empId)) return

      const leaveStart = parseISO(leave.start_date)
      const leaveEnd = parseISO(leave.end_date)
      const totalLeaveDays = Math.floor((leaveEnd - leaveStart) / (1000 * 60 * 60 * 24)) + 1

      const overlapStart = leaveStart > periodStartDate ? leaveStart : periodStartDate
      const overlapEnd = leaveEnd < periodEndDate ? leaveEnd : periodEndDate

      if (overlapStart <= overlapEnd) {
        const existingEarliest = earliestLeaveStartInPeriodByEmployee.get(empId)
        if (!existingEarliest || leaveStart < existingEarliest) {
          earliestLeaveStartInPeriodByEmployee.set(empId, leaveStart)
        }
        const diffMs = overlapEnd.getTime() - overlapStart.getTime()
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
        const current = leaveDaysByEmployee.get(empId) || 0
        leaveDaysByEmployee.set(empId, current + days)

        const daySet = leaveDatesByEmployee.get(empId) || new Set()
        const daySetUpToAsAt = leaveDatesUpToAsAtByEmployee.get(empId) || new Set()
        for (let d = new Date(overlapStart); d <= overlapEnd; d.setDate(d.getDate() + 1)) {
          const dateStr = format(d, 'yyyy-MM-dd')
          daySet.add(dateStr)
          if (d <= asAtDate) daySetUpToAsAt.add(dateStr)
        }
        leaveDatesByEmployee.set(empId, daySet)
        leaveDatesUpToAsAtByEmployee.set(empId, daySetUpToAsAt)

        if (leaveEnd >= todayDate) {
          // CRITICAL: Fresh calculation from zero. No cached/stored values. Days Elapsed = every day from Leave Start to TODAY (inclusive). Remaining = TotalGrant - Days Elapsed.
          const daysElapsed = todayDate >= leaveStart
            ? Math.floor((todayDate.getTime() - leaveStart.getTime()) / dayMs) + 1
            : 0
          const remaining = Math.max(0, totalLeaveDays - daysElapsed)
          remainingLeaveDaysByEmployee.set(empId, remaining)
        }
      }
    })

    const absentDaysByEmployee = new Map((deductions || []).map(d => [d.employee_id, Math.max(0, parseInt(d.absent_days, 10) || 0)]))
    const periodEndOrToday = todayDate > periodEndDate ? periodEndDate : todayDate
    const daysInRange = Math.floor((periodEndOrToday.getTime() - periodStartDate.getTime()) / dayMs) + 1

    const daysPresentByEmployee = new Map()
    employees.forEach(emp => {
      const empId = emp.$id
      const absentD = absentDaysByEmployee.get(empId) || 0
      const earliestLeave = earliestLeaveStartInPeriodByEmployee.get(empId)
      let daysPresentInPeriod
      if (earliestLeave) {
        const lastDayPresent = new Date(earliestLeave.getTime())
        lastDayPresent.setDate(lastDayPresent.getDate() - 1)
        const lastDay = lastDayPresent > periodEndDate ? periodEndDate : lastDayPresent
        daysPresentInPeriod = lastDay >= periodStartDate
          ? Math.max(0, Math.floor((lastDay.getTime() - periodStartDate.getTime()) / dayMs) + 1)
          : 0
      } else {
        daysPresentInPeriod = daysInRange
      }
      daysPresentByEmployee.set(empId, Math.max(0, daysPresentInPeriod - absentD))
    })

    leaveDaysByEmployee.forEach((leaveDays, empId) => {
      const emp = empById.get(empId)
      if (!emp) return
      const leaveDatesUpToAsAt = leaveDatesUpToAsAtByEmployee.get(empId) || new Set()
      const remainingLeave = remainingLeaveDaysByEmployee.get(empId) || 0
      const daysPresentVal = daysPresentByEmployee.get(empId) ?? (daysInRange - (absentDaysByEmployee.get(empId) || 0))
      if (!attendanceByEmployee.has(empId)) {
        attendanceByEmployee.set(empId, {
          employee: emp,
          records: [],
          dates: new Set(),
          leaveDays,
          leaveDates: leaveDatesByEmployee.get(empId) || new Set(),
          leaveDatesUpToAsAt,
          remainingLeaveDays: remainingLeave,
          daysPresent: Math.max(0, daysPresentVal)
        })
      } else {
        const data = attendanceByEmployee.get(empId)
        data.leaveDays = leaveDays
        data.leaveDates = leaveDatesByEmployee.get(empId) || new Set()
        data.leaveDatesUpToAsAt = leaveDatesUpToAsAt
        data.remainingLeaveDays = remainingLeave
        data.daysPresent = Math.max(0, daysPresentVal)
      }
    })
    attendanceByEmployee.forEach((data, empId) => {
      if (!data.leaveDates) data.leaveDates = leaveDatesByEmployee.get(empId) || new Set()
      if (!data.leaveDatesUpToAsAt) data.leaveDatesUpToAsAt = leaveDatesUpToAsAtByEmployee.get(empId) || new Set()
      if (data.remainingLeaveDays == null) data.remainingLeaveDays = remainingLeaveDaysByEmployee.get(empId) || 0
      if (data.absentDays == null) data.absentDays = absentDaysByEmployee.get(empId) || 0
      if (data.daysPresent == null) data.daysPresent = Math.max(0, (daysPresentByEmployee.get(empId) ?? daysInRange) - (data.absentDays || 0))
    })

    employees.forEach((emp) => {
      if (!attendanceByEmployee.has(emp.$id)) {
        const absentD = absentDaysByEmployee.get(emp.$id) || 0
        attendanceByEmployee.set(emp.$id, {
          employee: emp,
          records: [],
          dates: new Set(),
          leaveDays: leaveDaysByEmployee.get(emp.$id) || 0,
          leaveDates: leaveDatesByEmployee.get(emp.$id) || new Set(),
          leaveDatesUpToAsAt: leaveDatesUpToAsAtByEmployee.get(emp.$id) || new Set(),
          remainingLeaveDays: remainingLeaveDaysByEmployee.get(emp.$id) || 0,
          absentDays: absentD,
          daysPresent: Math.max(0, (daysPresentByEmployee.get(emp.$id) ?? daysInRange) - absentD)
        })
      } else {
        const d = attendanceByEmployee.get(emp.$id)
        d.absentDays = absentDaysByEmployee.get(emp.$id) || 0
        if (d.leaveDatesUpToAsAt == null) d.leaveDatesUpToAsAt = leaveDatesUpToAsAtByEmployee.get(emp.$id) || new Set()
        if (d.remainingLeaveDays == null) d.remainingLeaveDays = remainingLeaveDaysByEmployee.get(emp.$id) || 0
        if (d.daysPresent == null) d.daysPresent = Math.max(0, (daysPresentByEmployee.get(emp.$id) ?? daysInRange) - (d.absentDays || 0))
      }
    })

    return {
      employees,
      attendanceRecords,
      attendanceByEmployee,
      period,
      startDate,
      endDate,
      reportAsAtDate,
      reportGenerationDate: today,
      daysInRange,
      today
    }
  } catch (error) {
    console.error('Error fetching attendance data for period:', error)
    throw new Error(`Failed to fetch attendance data: ${error.message || error}`)
  }
}

// Generate Attendance Report PDF
export const generateAttendanceReportPDF = async ({
  companyName,
  companyLogoUrl,
  period,
  attendanceByEmployee,
  startDate,
  endDate,
  reportAsAtDate,
  reportGenerationDate,
  daysInRange,
  reportingSettings = {},
  pdfBranding: pdfBrandingIn = null
}) => {
  const pdfBranding = mergePdfBranding(pdfBrandingIn || {})
  const useLetterhead = !!(companyLogoUrl && pdfBranding.letterheadLogoEnabled)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

  const logoData = await loadLogoForPDF(doc, companyLogoUrl)
  const applyWatermarkOverlay = await buildJsPdfWatermarkOverlay(doc, {
    companyName,
    companyLogoUrl,
    logoDataPreloaded: logoData,
    extraLines: [`Attendance report — ${period}`],
    opacityMul: pdfBranding.watermarkOpacityMul
  })
  if (logoData && useLetterhead) {
    addLogoToCurrentPage(doc, logoData)
  }

  const headerY = useLetterhead ? LOGO_HEADER_START_Y : 40
  doc.setFontSize(16)
  doc.setFont(undefined, 'bold')
  doc.text(companyName || 'Company', 40, headerY)
  
  doc.setFontSize(12)
  doc.setFont(undefined, 'normal')
  const reportY = useLetterhead ? LOGO_HEADER_START_Y + 20 : 60
  doc.text(`Monthly Attendance Report - ${period}`, 40, reportY)
  doc.text(`Period: ${startDate} to ${endDate}`, 40, reportY + 15)
  doc.text(`Leave balances calculated as at: ${reportGenerationDate || reportAsAtDate || endDate}`, 40, reportY + 30)

  const rows = []
  attendanceByEmployee.forEach(({ employee, records = [], daysPresent: daysPresentVal, remainingLeaveDays = 0, leaveDates = new Set(), absentDays = 0 }) => {
    const daysPresent = daysPresentVal != null ? Number(daysPresentVal) : 0
    let onTime = 0
    let late = 0
    const leaveSet = leaveDates instanceof Set ? leaveDates : new Set()
    records.forEach(r => {
      if (leaveSet.has(r.date)) return
      if (r.clock_in_time) {
        if (isClockInOnTime(r.clock_in_time, r.date, reportingSettings)) onTime++
        else late++
      }
    })
    rows.push([
      employee.name || 'N/A',
      employee.employee_id || employee.staff_no || 'N/A',
      employee.department || 'N/A',
      daysPresent.toString(),
      (remainingLeaveDays ?? 0).toString(),
      onTime.toString(),
      late.toString()
    ])
  })

  rows.sort((a, b) => (a[1] || a[0]).localeCompare(b[1] || b[0], undefined, { numeric: true }))

  // Add totals row
  const totalDays = rows.reduce((sum, row) => sum + parseInt(row[3] || 0), 0)
  const totalLeaveDays = rows.reduce((sum, row) => sum + parseInt(row[4] || 0), 0)
  const totalOnTime = rows.reduce((sum, row) => sum + parseInt(row[5] || 0), 0)
  const totalLate = rows.reduce((sum, row) => sum + parseInt(row[6] || 0), 0)

  const tableStartY = useLetterhead ? LOGO_TABLE_START_Y : 90
  autoTable(doc, {
    startY: tableStartY,
    head: [['Employee Name', 'Employee ID', 'Department', 'Days Present', 'Leave Days (remaining)', 'On Time', 'Late']],
    body: rows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' }
    },
    foot: [['TOTAL', '', '', totalDays.toString(), totalLeaveDays.toString(), totalOnTime.toString(), totalLate.toString()]],
    footStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' },
    didDrawPage: (data) => {
      // Logo only on first page for attendance report
      if (logoData && useLetterhead && data.pageNumber === 1) {
        addLogoToCurrentPage(doc, logoData)
      }
    }
  })

  addFooterToPDF(doc)

  if (applyWatermarkOverlay) applyWatermarkOverlay()
  const pdfBytes = doc.output('arraybuffer')
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

// Generate Attendance Report CSV
export const generateAttendanceReportCSV = ({
  period,
  attendanceByEmployee,
  startDate,
  endDate,
  reportAsAtDate,
  reportGenerationDate,
  daysInRange,
  reportingSettings = {}
}) => {
  const rangeDays = daysInRange != null ? daysInRange : (() => { const [y, m] = period.split('-').map(Number); return new Date(y, m, 0).getDate() })()

  const rows = [['Employee Name', 'Employee ID', 'Department', 'Days Present', 'Leave Days (remaining)', 'On Time', 'Late']]
  
  attendanceByEmployee.forEach(({ employee, records = [], daysPresent: daysPresentVal, remainingLeaveDays = 0, leaveDates = new Set(), absentDays = 0 }) => {
    const daysPresent = daysPresentVal != null ? Number(daysPresentVal) : 0
    let onTime = 0
    let late = 0
    const leaveSet = leaveDates instanceof Set ? leaveDates : new Set()
    records.forEach(r => {
      if (leaveSet.has(r.date)) return
      if (r.clock_in_time) {
        if (isClockInOnTime(r.clock_in_time, r.date, reportingSettings)) onTime++
        else late++
      }
    })
    rows.push([
      employee.name || 'N/A',
      employee.employee_id || employee.staff_no || 'N/A',
      employee.department || 'N/A',
      daysPresent.toString(),
      (remainingLeaveDays ?? 0).toString(),
      onTime.toString(),
      late.toString()
    ])
  })

  // Sort by employee number (skip header)
  const dataRows = rows.slice(1)
  dataRows.sort((a, b) => (a[1] || a[0]).localeCompare(b[1] || b[0], undefined, { numeric: true }))
  const sortedRows = [rows[0], ...dataRows]

  // Add totals
  const totalDays = dataRows.reduce((sum, row) => sum + parseInt(row[3] || 0), 0)
  const totalLeaveDays = dataRows.reduce((sum, row) => sum + parseInt(row[4] || 0), 0)
  const totalOnTime = dataRows.reduce((sum, row) => sum + parseInt(row[5] || 0), 0)
  const totalLate = dataRows.reduce((sum, row) => sum + parseInt(row[6] || 0), 0)
  sortedRows.push(['TOTAL', '', '', totalDays.toString(), totalLeaveDays.toString(), totalOnTime.toString(), totalLate.toString()])

  return toCSV(sortedRows)
}
