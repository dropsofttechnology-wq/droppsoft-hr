import PDFDocument from 'pdfkit'
import { format } from 'date-fns'
import {
  PAYROLL_LIST_TABLE_HEADERS,
  getPayrollListRowMetrics,
  formatPayrollListRowForPdf
} from '../../shared/payrollListRowMetrics.js'
import { mergePdfBranding } from '../../shared/pdfBranding.js'

/** Same relative weights as client jsPDF payroll list (reportService). */
const PAYROLL_COL_WEIGHTS = [1, 2.35, ...Array(16).fill(1)]

/** TOTAL EARN., TOTAL DED., NET PAY column indices — filled + bold in body row */
const PAYROLL_TOTAL_COL_INDEX = (i) => i === 7 || i === 16 || i === 17

function columnWidths(innerWPt) {
  const sum = PAYROLL_COL_WEIGHTS.reduce((a, b) => a + b, 0)
  const raw = PAYROLL_COL_WEIGHTS.map((w) => (w / sum) * innerWPt)
  const rounded = raw.map((w) => Math.round(w * 100) / 100)
  const drift = innerWPt - rounded.reduce((a, b) => a + b, 0)
  rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + drift) * 100) / 100
  return rounded
}

function drawPayrollListGrid(doc, leftX, topY, innerW, headers, rowCells) {
  const widths = columnWidths(innerW)
  const headH = 24
  const bodyH = 22
  const padX = 3
  const fsHead = 6.5
  const fsBody = 6.5

  doc.save()
  doc.lineWidth(0.35)
  doc.strokeColor('#dcdcdc')

  let x = leftX
  doc.font('Helvetica-Bold').fontSize(fsHead).fillColor('#000000')
  for (let i = 0; i < 18; i++) {
    if (PAYROLL_TOTAL_COL_INDEX(i)) {
      doc.fillColor('#dde8fb')
      doc.rect(x, topY, widths[i], headH).fill()
    }
    doc.strokeColor('#dcdcdc')
    doc.rect(x, topY, widths[i], headH).stroke()
    const align = i <= 1 ? 'left' : 'right'
    doc.fillColor('#000000')
    doc.text(headers[i], x + (align === 'left' ? padX : 0), topY + 7, {
      width: widths[i] - padX * 2,
      align,
      lineBreak: false
    })
    x += widths[i]
  }

  x = leftX
  const yBody = topY + headH
  doc.fontSize(fsBody).fillColor('#000000')
  for (let i = 0; i < 18; i++) {
    if (PAYROLL_TOTAL_COL_INDEX(i)) {
      doc.fillColor('#e8f0fe')
      doc.rect(x, yBody, widths[i], bodyH).fill()
    }
    doc.strokeColor('#c5d4ef')
    doc.rect(x, yBody, widths[i], bodyH).stroke()
    const align = i <= 1 ? 'left' : 'right'
    const txt = String(rowCells[i] ?? '')
    doc.fillColor(PAYROLL_TOTAL_COL_INDEX(i) ? '#0c2048' : '#000000')
    doc.font(PAYROLL_TOTAL_COL_INDEX(i) ? 'Helvetica-Bold' : 'Helvetica')
    doc.text(txt, x + (align === 'left' ? padX : 0), yBody + 7, {
      width: widths[i] - padX * 2,
      align,
      lineBreak: false
    })
    doc.fillColor('#000000')
    x += widths[i]
  }

  doc.restore()
}

/** Match client jsPDF watermark stack: company, period, confidential, system name. */
function drawPdfKitDiagonalTextWatermark(doc, { companyName, periodDisplay, opacityMul = 0.52 }) {
  const pw = doc.page.width
  const ph = doc.page.height
  const cx = pw / 2
  const cy = ph * 0.46
  const genLine = `Generated ${format(new Date(), 'dd MMM yyyy HH:mm')}`
  const om = Number(opacityMul) || 0.52
  const textOp = Math.min(0.3, Math.max(0.09, 0.2 * (om / 0.52)))
  doc.save()
  try {
    doc.opacity(textOp)
    doc.fillColor('#b0b0b0')
    doc.font('Helvetica-Bold').fontSize(26)
    doc.rotate(-32, { origin: [cx, cy] })
    const block =
      `${String(companyName || 'Company').toUpperCase()}\n` +
      `${periodDisplay}\n` +
      `${genLine}\n` +
      `CONFIDENTIAL\n` +
      `Dropsoft HR`
    doc.text(block, cx, cy, { align: 'center', lineGap: 4 })
  } catch (_) {
    /* optional */
  }
  doc.restore()
  doc.opacity(1)
  doc.fillColor('#000000')
}

/** Paint logo + diagonal text on top of page content (call before doc.end). */
function drawPdfKitWatermarkOverlay(doc, { pdfBranding, logoBuffer, companyName, periodDisplay }) {
  const pw = doc.page.width
  const ph = doc.page.height
  const mul = pdfBranding.watermarkOpacityMulPayslip ?? pdfBranding.watermarkOpacityMul
  if (logoBuffer && logoBuffer.length > 0) {
    doc.save()
    try {
      const bw = pw * 0.48
      const bh = ph * 0.48
      const op = 0.13 * Math.min(1.35, mul / 0.52)
      doc.opacity(Math.min(0.28, Math.max(0.06, op)))
      doc.image(logoBuffer, (pw - bw) / 2, (ph - bh) / 2, {
        fit: [bw, bh],
        align: 'center',
        valign: 'center'
      })
    } catch (_) {
      /* optional */
    }
    doc.restore()
    doc.opacity(1)
    doc.fillColor('#000000')
  }
  drawPdfKitDiagonalTextWatermark(doc, {
    companyName,
    periodDisplay,
    opacityMul: mul
  })
}

/**
 * One employee payslip PDF (A4 landscape): same 18 columns + headers as Payroll list.
 * @param {object} p
 * @param {Buffer | null} [p.logoBuffer] — company logo; letterhead and/or faint watermark
 * @param {object} [p.payrollSettings] — standard_allowance, housing_allowance, housing_allowance_type
 * @param {object} [p.pdfBranding] — optional overrides from Settings (mergePdfBranding)
 * @returns {Promise<Buffer>}
 */
export function buildPayslipPdfBuffer({
  companyName,
  companyTaxPin,
  period,
  run,
  emp,
  deduction = {},
  payrollSettings = {},
  logoBuffer = null,
  pdfPassword = '',
  pdfBranding: pdfBrandingIn = null
}) {
  return new Promise((resolve, reject) => {
    try {
      const pdfBranding = mergePdfBranding(pdfBrandingIn || {})
      const hasPassword = String(pdfPassword || '').trim().length > 0
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 36,
        ...(hasPassword
          ? {
              userPassword: String(pdfPassword).trim(),
              ownerPassword: `${String(pdfPassword).trim()}::dropsoft-owner`,
              permissions: {
                printing: 'highResolution',
                modifying: false,
                copying: false,
                annotating: false,
                fillingForms: false,
                contentAccessibility: true,
                documentAssembly: false
              }
            }
          : {})
      })
      const chunks = []
      doc.on('data', (c) => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const [yStr, mStr] = String(period).split('-')
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
      const mi = Math.max(0, Math.min(11, parseInt(mStr, 10) - 1))
      const periodDisplay = `${monthNames[mi]} ${yStr}`
      const periodTitleUpper = `${monthNames[mi]} ${yStr}`.toUpperCase()

      const pw = doc.page.width
      const ph = doc.page.height

      const margin = 36
      const innerW = pw - margin * 2
      let y = 42
      if (pdfBranding.letterheadLogoEnabled && logoBuffer && logoBuffer.length > 0) {
        try {
          const lhMax = 52
          const lwMax = innerW * 0.35
          doc.image(logoBuffer, margin + (innerW - lwMax) / 2, y, { fit: [lwMax, lhMax] })
          y += lhMax + 8
        } catch (_) {
          /* optional */
        }
      }

      doc.fontSize(10).font('Helvetica').fillColor('#444444')
      doc.text(format(new Date(), 'dd MMMM yyyy'), margin, y)
      doc.font('Helvetica-Bold').text(`PIN: ${companyTaxPin || ''}`, margin, y, {
        width: innerW,
        align: 'right'
      })
      y += 22

      doc.fontSize(17).font('Helvetica-Bold').fillColor('#000000')
      doc.text(String(companyName || 'Company').toUpperCase(), margin, y, {
        width: innerW,
        align: 'center'
      })
      y += 26

      doc.fontSize(12)
      doc.text(`INDIVIDUAL PAYSLIP FOR ${periodTitleUpper}`, margin, y, {
        width: innerW,
        align: 'center'
      })
      y += 14

      doc.moveTo(margin, y).lineTo(pw - margin, y).stroke('#c8c8c8')
      y += 10

      const settings = {
        standard_allowance: Number(payrollSettings.standard_allowance) || 0,
        housing_allowance: Number(payrollSettings.housing_allowance) || 0,
        housing_allowance_type: payrollSettings.housing_allowance_type || 'fixed'
      }

      const metrics = getPayrollListRowMetrics(run, emp, settings, deduction)
      const cells = formatPayrollListRowForPdf(metrics)

      drawPayrollListGrid(doc, margin, y, innerW, PAYROLL_LIST_TABLE_HEADERS, cells)

      const gridBottom = y + 24 + 22 + 8
      let netY = gridBottom + 8
      const netBoxW = Math.min(innerW * 0.58, 320)
      const netBoxX = margin + (innerW - netBoxW) / 2
      const netBoxH = 28
      doc.fillColor('#d4e4ff')
      doc.rect(netBoxX, netY, netBoxW, netBoxH).fill()
      doc.strokeColor('#6b8cce')
      doc.lineWidth(0.85)
      doc.rect(netBoxX, netY, netBoxW, netBoxH).stroke()
      doc.fillColor('#0c2048')
      doc.font('Helvetica-Bold').fontSize(14)
      doc.text(`NET SALARY: ${cells[17] ?? ''}`, netBoxX, netY + 18, {
        width: netBoxW,
        align: 'center',
        lineBreak: false
      })
      doc.fillColor('#000000')
      doc.lineWidth(0.35)

      let sigY = netY + netBoxH + 28
      if (sigY > ph - 52) sigY = ph - 44
      doc.font('Helvetica').fontSize(9).fillColor('#000000')
      doc.text('SIGNATURE:', margin, sigY)
      doc.moveTo(margin + 62, sigY + 12).lineTo(margin + 260, sigY + 12).stroke('#333333')

      drawPdfKitWatermarkOverlay(doc, {
        pdfBranding,
        logoBuffer,
        companyName,
        periodDisplay
      })

      doc.end()
    } catch (e) {
      reject(e)
    }
  })
}
