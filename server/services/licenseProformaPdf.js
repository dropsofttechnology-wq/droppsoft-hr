import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import PDFDocument from 'pdfkit'
import { BILLABLE_FEATURES, PAYMENT_DETAILS } from '../utils/licensePackages.js'

const featureLabel = (id) => BILLABLE_FEATURES.find((f) => f.id === id)?.label || id

/**
 * Prefer `public/logo-print.png` (opaque) when present; otherwise PNGs under `public/`.
 * Transparent PNGs often disappear on physical printers; we also paint a white plate behind the logo.
 * @returns {string | null}
 */
function resolveDropsoftLogoPath() {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const rp = process.resourcesPath
  const candidates = [
    path.join(here, '../../public/logo-print.png'),
    path.join(process.cwd(), 'public/logo-print.png'),
    rp && path.join(rp, 'app.asar', 'public', 'logo-print.png'),
    rp && path.join(rp, 'app.asar.unpacked', 'public', 'logo-print.png'),
    path.join(here, '../../public/logo.png'),
    path.join(here, '../../public/logo1.png'),
    path.join(here, '../../public/logo2.png'),
    path.join(process.cwd(), 'public/logo.png'),
    path.join(process.cwd(), 'public/logo1.png'),
    path.join(process.cwd(), 'public/logo2.png'),
    rp && path.join(rp, 'app.asar', 'public', 'logo.png'),
    rp && path.join(rp, 'app.asar', 'public', 'logo1.png'),
    rp && path.join(rp, 'app.asar.unpacked', 'public', 'logo.png')
  ].filter(Boolean)
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

/**
 * Embed logo with an opaque backing so soft-mask / transparent PNGs still print on office printers.
 * @param {object} doc PDFKit document
 */
function drawPrintSafeLogo(doc, logoPath, left, top, fitW, fitH) {
  const buf = fs.readFileSync(logoPath)
  doc.save()
  doc.fillColor('#ffffff').rect(left, top, fitW, fitH).fill()
  doc.image(buf, left, top, { fit: [fitW, fitH], valign: 'center' })
  doc.restore()
}

function formatKes(n) {
  const v = Number(n || 0)
  const abs = Math.abs(v).toLocaleString('en-KE')
  if (v < 0) return `-KES ${abs}`
  return `KES ${abs}`
}

/**
 * @param {object} order Mapped license order (referenceCode, companyName, quote, …)
 */
export function buildLicenseProformaPdfBuffer(order) {
  const quote = order.quote || {}
  const payment = quote.payment || PAYMENT_DETAILS

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4', info: { Title: `Proforma ${order.referenceCode}` } })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const left = 48
    const logoPath = resolveDropsoftLogoPath()
    const headerTop = 40
    const logoBox = { w: 104, h: 52 }
    let textLeft = left
    if (logoPath) {
      try {
        drawPrintSafeLogo(doc, logoPath, left, headerTop, logoBox.w, logoBox.h)
        textLeft = left + logoBox.w + 14
      } catch (_) {
        textLeft = left
      }
    }

    let y = headerTop + 2
    doc.fontSize(20).fillColor('#0c2048').font('Helvetica-Bold').text('PROFORMA INVOICE', textLeft, y)
    y += 28
    doc.fontSize(9).fillColor('#666').font('Helvetica').text('This document is not a tax invoice. For quotation and payment purposes only.', textLeft, y, {
      width: 595 - textLeft - 48
    })
    y += 22

    doc.fontSize(11).fillColor('#000').font('Helvetica-Bold').text(payment.legalName, textLeft, y)
    y += 16
    doc.font('Helvetica').fontSize(10).fillColor('#333').text('Dropsoft HR — software licence & renewal', textLeft, y, {
      width: 595 - textLeft - 48
    })
    y = Math.max(y + 28, headerTop + logoBox.h + 18)

    const col2 = 320
    doc.font('Helvetica-Bold').fontSize(10).text('Document no.', left, y)
    doc.font('Helvetica').text(String(order.referenceCode || ''), left + 90, y)
    doc.font('Helvetica-Bold').text('Date', col2, y)
    doc.font('Helvetica').text(String(order.createdAt || '').slice(0, 10), col2 + 50, y)
    y += 22
    doc.font('Helvetica-Bold').text('Status', left, y)
    doc.font('Helvetica').text(String(order.status || 'pending_payment').replace(/_/g, ' '), left + 90, y)
    y += 32

    doc.moveTo(left, y).lineTo(547, y).strokeColor('#c5d4ef').lineWidth(1).stroke()
    y += 14

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0c2048').text('Bill to', left, y)
    y += 18
    doc.font('Helvetica').fontSize(10).fillColor('#222')
    doc.text(String(order.companyName || ''), left, y)
    y += 14
    if (order.contactName) {
      doc.text(`Contact: ${order.contactName}`, left, y)
      y += 14
    }
    if (order.contactEmail) {
      doc.text(`Email: ${order.contactEmail}`, left, y)
      y += 14
    }
    if (order.contactPhone) {
      doc.text(`Phone: ${order.contactPhone}`, left, y)
      y += 14
    }
    y += 10

    doc.font('Helvetica-Bold').text('Licence summary', left, y)
    y += 16
    doc.font('Helvetica').fontSize(9).fillColor('#444')
    const pkg = quote.packageName || quote.packageId || '—'
    const cycle = quote.billingCycle || '—'
    const emp = quote.employeeCount != null ? String(quote.employeeCount) : '—'
    doc.text(`Plan: ${pkg}  ·  Billing: ${cycle}  ·  Employees: ${emp}`, left, y, { width: 500 })
    y += 14
    if (order.includeOnboarding !== undefined) {
      doc.text(
        `One-time lifetime licence included in quote: ${order.includeOnboarding && quote.onboardingKes > 0 ? 'Yes' : 'No'}`,
        left,
        y
      )
      y += 14
    }
    const inc = Array.isArray(quote.includedFeatures) ? quote.includedFeatures : []
    if (inc.length) {
      doc.text(`Modules in plan: ${inc.map(featureLabel).join(', ')}`, left, y, { width: 500 })
      y += 14
    }
    const add = Array.isArray(quote.addOnFeatures) ? quote.addOnFeatures : []
    if (add.length) {
      doc.text(`Additional modules: ${add.map(featureLabel).join(', ')}`, left, y, { width: 500 })
      y += 14
    }
    if (quote.discountPercent > 0) {
      doc.text(`Commercial discount: ${quote.discountPercent}% on renewal portion`, left, y)
      y += 14
    }
    if (quote.overageEmployees > 0) {
      doc.text(`Employee overage: ${quote.overageEmployees} above plan cap`, left, y)
      y += 14
    }
    if (order.deploymentId) {
      doc.fillColor('#666').text(`Deployment ID (for licence issuance): ${order.deploymentId}`, left, y, { width: 500 })
      y += 16
    }
    y += 8

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0c2048').text('Description', left, y)
    doc.text('Amount', 460, y, { width: 90, align: 'right' })
    y += 14
    doc.moveTo(left, y).lineTo(547, y).strokeColor('#c5d4ef').stroke()
    y += 10

    const lines = Array.isArray(quote.lineItems) ? quote.lineItems : []
    doc.font('Helvetica').fontSize(10)
    for (const line of lines) {
      const amt = Number(line.amountKes) || 0
      doc.fillColor(amt < 0 ? '#0d7a4d' : '#000')
      doc.text(String(line.label || ''), left, y, { width: 400 })
      doc.text(formatKes(line.amountKes), 440, y, { width: 100, align: 'right' })
      y += 22
      if (y > 620) {
        doc.addPage()
        y = 48
      }
    }

    y += 6
    doc.moveTo(left, y).lineTo(547, y).strokeColor('#0c2048').lineWidth(0.8).stroke()
    y += 12
    doc.fillColor('#0c2048').font('Helvetica-Bold').fontSize(12).text('Total due', left, y)
    doc.text(formatKes(order.totalDueKes ?? quote.totalDueKes), 420, y, { width: 120, align: 'right' })
    y += 28

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0c2048').text('Payment — remit to ' + payment.legalName, left, y)
    y += 16
    doc.font('Helvetica').fontSize(9).fillColor('#222')
    doc.text(`KCB account: ${payment.kcbAccount}`, left, y)
    y += 13
    doc.text(`M-Pesa paybill: ${payment.mpesaPaybill}  ·  Account: ${payment.mpesaAccount}`, left, y)
    y += 13
    doc.fillColor('#0c2048').font('Helvetica-Bold').text(`Reference / narration: ${order.referenceCode}`, left, y)
    y += 22

    doc.font('Helvetica').fontSize(8).fillColor('#555').text(
      'Share this proforma with Dropsoft Technologies Ltd together with proof of payment so your licence token can be issued. ' +
        'Activate the token under Settings → System maintenance.',
      left,
      y,
      { width: 500, align: 'left' }
    )

    doc.end()
  })
}
