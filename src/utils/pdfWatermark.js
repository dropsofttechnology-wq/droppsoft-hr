import { format } from 'date-fns'

/** Short system line on every PDF watermark stack */
export const PDF_WATERMARK_SYSTEM_LINE = 'Dropsoft HR'

/**
 * Faded raster logo for diagonal watermark (browser canvas).
 * @param {string} pngDataUrl
 * @param {number} maxWPt
 * @param {number} maxHPt
 * @param {number} opacity 0–1 (applied when rasterizing)
 */
export function buildPdfWatermarkLogoStamp(pngDataUrl, maxWPt, maxHPt, opacity = 0.12) {
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
        console.warn('Watermark logo stamp failed:', e)
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = pngDataUrl
  })
}

/**
 * Draw a diagonal logo + multi-line text watermark on the **current** jsPDF page.
 * Call after main content (overlay) so fills and tables do not cover it.
 *
 * @param {import('jspdf').jsPDF} doc
 * @param {object} opts
 * @param {{ pngDataUrl: string, width: number, height: number } | null} [opts.logoStamp]
 * @param {string} [opts.companyName]
 * @param {string[]} [opts.extraLines]
 * @param {number} [opts.angleDeg]
 * @param {number} [opts.opacityMul] multiplier for default opacities (e.g. 0.45 for dense payslip grids)
 */
export function applyJsPdfDiagonalWatermarkOnCurrentPage(doc, opts = {}) {
  const {
    logoStamp = null,
    companyName = '',
    extraLines = [],
    angleDeg = -32,
    opacityMul = 1
  } = opts

  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const cx = pw / 2
  const cy = ph * 0.46

  const name = String(companyName || '').trim()
  const lines = []
  if (name) lines.push(name.toUpperCase())
  for (const L of extraLines) {
    const s = String(L || '').trim()
    if (s) lines.push(s)
  }
  lines.push('CONFIDENTIAL')
  lines.push(PDF_WATERMARK_SYSTEM_LINE)

  const textBlock = lines.join('\n')
  const useGState = typeof doc.setGState === 'function' && typeof doc.GState === 'function'
  const setOp = (o) => {
    if (useGState) doc.setGState(new doc.GState({ opacity: Math.max(0.02, Math.min(1, o)) }))
  }

  try {
    if (logoStamp?.pngDataUrl) {
      const lw = logoStamp.width
      const lh = logoStamp.height
      const lx = cx - lw / 2
      const ly = cy - lh / 2 - 48
      setOp(Math.min(0.22, Math.max(0.06, 0.14 * opacityMul)))
      try {
        doc.addImage(logoStamp.pngDataUrl, 'PNG', lx, ly, lw, lh)
      } catch (_) {
        /* ignore */
      }
      setOp(1)
    }

    setOp(Math.min(0.38, Math.max(0.1, 0.2 * opacityMul)))
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(21)
    doc.setTextColor(175, 175, 175)
    doc.text(textBlock, cx, cy, {
      angle: angleDeg,
      align: 'center',
      baseline: 'middle',
      maxWidth: pw * 0.78,
      lineHeightFactor: 1.35
    })
    doc.setTextColor(0, 0, 0)
    setOp(1)
  } catch (e) {
    console.warn('applyJsPdfDiagonalWatermarkOnCurrentPage failed:', e)
    doc.setTextColor(0, 0, 0)
    if (useGState) doc.setGState(new doc.GState({ opacity: 1 }))
  }
}

export function applyJsPdfWatermarkToAllPages(doc, opts = {}) {
  const n = doc.getNumberOfPages()
  let prev = 1
  try {
    const info = doc.getCurrentPageInfo?.()
    if (info?.pageNumber) prev = info.pageNumber
  } catch {
    /* ignore */
  }
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    applyJsPdfDiagonalWatermarkOnCurrentPage(doc, opts)
  }
  doc.setPage(prev)
}

/**
 * Standard trailing line (timestamp) for watermark stacks.
 */
export function buildPdfWatermarkGeneratedLine() {
  return `Generated ${format(new Date(), 'dd MMM yyyy HH:mm')}`
}
