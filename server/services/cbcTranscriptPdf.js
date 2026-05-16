import PDFDocument from 'pdfkit'
import { cbcLevelMeta } from '../utils/cbcPerformanceLevels.js'
import { printTranscriptHtmlToPdfBuffer } from './electronPdfBridge.js'

/**
 * @param {Awaited<ReturnType<import('./cbcTranscriptData.js').loadCbcTranscript>>} transcript
 * @param {{ schoolName?: string }} opts
 * @returns {Promise<Buffer>}
 */
export function buildCbcTranscriptPdfBuffer(transcript, { schoolName = 'School' } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.font('Helvetica-Bold').fontSize(16).text("Learner's Progress Report", { align: 'center' })
    doc.moveDown(0.35)
    doc.font('Helvetica').fontSize(11).fillColor('#334155')
    doc.text(schoolName, { align: 'center' })
    doc.moveDown(0.5)
    doc.fontSize(10).fillColor('#0f172a')
    doc.text(`${transcript.legal_name} · ${transcript.student_number} · ${transcript.class_label || '—'}`, {
      align: 'center'
    })
    doc.text(`${transcript.academic_year_label} — ${transcript.term_name}`, { align: 'center' })
    doc.moveDown(0.35)
    doc.fontSize(8).fillColor('#64748b').text('Kenyan CBC: EE (4) · ME (3) · AE (2) · BE (1)', { align: 'center' })
    doc.moveDown(1)

    if (!transcript.learning_areas?.length) {
      doc.fontSize(10).fillColor('#64748b').text('No assessments recorded for this term.', { align: 'center' })
      doc.end()
      return
    }

    for (const area of transcript.learning_areas) {
      const title = area.average_level != null ? `${area.subject_name} (avg ${area.average_level})` : area.subject_name
      if (doc.y > 700) doc.addPage()
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(title)
      doc.moveDown(0.25)

      const colW = [220, 80, 180]
      const startX = doc.page.margins.left
      let y = doc.y
      const rowH = 16

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569')
      ;['Strand', 'Level', 'Remarks'].forEach((h, i) => {
        doc.text(h, startX + colW.slice(0, i).reduce((a, b) => a + b, 0), y, {
          width: colW[i],
          lineBreak: false
        })
      })
      y += rowH
      doc.font('Helvetica').fontSize(8).fillColor('#0f172a')

      for (const st of area.strands) {
        if (y > 740) {
          doc.addPage()
          y = doc.page.margins.top
        }
        const meta = cbcLevelMeta(st.performance_level)
        const levelText = meta ? `${meta.abbreviation} (${st.performance_level})` : String(st.performance_level)
        doc.text(st.strand_name, startX, y, { width: colW[0], lineBreak: false })
        doc.text(levelText, startX + colW[0], y, { width: colW[1], lineBreak: false })
        doc.text(String(st.teacher_remarks || '—').slice(0, 120), startX + colW[0] + colW[1], y, {
          width: colW[2],
          lineBreak: false
        })
        y += rowH
      }
      doc.y = y + 10
    }

    doc.end()
  })
}

/**
 * Prefer Chromium print-to-PDF when the app runs inside Electron; otherwise PDFKit.
 * @param {Awaited<ReturnType<import('./cbcTranscriptData.js').loadCbcTranscript>>} transcript
 * @param {{ schoolName?: string }} opts
 * @returns {Promise<Buffer>}
 */
export async function buildCbcTranscriptPdfBufferPreferred(transcript, { schoolName = 'School' } = {}) {
  const html = buildCbcTranscriptHtml(transcript, { schoolName })
  try {
    const electronBuf = await printTranscriptHtmlToPdfBuffer(html)
    if (electronBuf && Buffer.isBuffer(electronBuf) && electronBuf.length > 0) return electronBuf
  } catch (e) {
    console.warn('[cbc-pdf] Electron printToPDF failed, using PDFKit:', e?.message || e)
  }
  return buildCbcTranscriptPdfBuffer(transcript, { schoolName })
}

/**
 * HTML for optional preview / future headless print (matches on-screen report).
 * @param {Awaited<ReturnType<import('./cbcTranscriptData.js').loadCbcTranscript>>} transcript
 * @param {{ schoolName?: string }} opts
 */
export function buildCbcTranscriptHtml(transcript, { schoolName = 'School' } = {}) {
  const areasHtml = (transcript.learning_areas || [])
    .map((area) => {
      const rows = area.strands
        .map((st) => {
          const meta = cbcLevelMeta(st.performance_level)
          const level = meta ? `${meta.abbreviation} (${st.performance_level})` : st.performance_level
          return `<tr><td>${escapeHtml(st.strand_name)}</td><td>${escapeHtml(level)}</td><td>${escapeHtml(st.teacher_remarks || '—')}</td></tr>`
        })
        .join('')
      const title =
        area.average_level != null
          ? `${escapeHtml(area.subject_name)} · avg ${area.average_level}`
          : escapeHtml(area.subject_name)
      return `<section><h3>${title}</h3><table><thead><tr><th>Strand</th><th>Level</th><th>Remarks</th></tr></thead><tbody>${rows}</tbody></table></section>`
    })
    .join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Segoe UI,Arial,sans-serif;color:#0f172a;padding:24px}
    h1{text-align:center;font-size:20px} h2{text-align:center;font-size:14px;color:#64748b;font-weight:normal}
    h3{border-bottom:2px solid #0f172a;padding-bottom:4px;font-size:14px}
    table{width:100%;border-collapse:collapse;margin:8px 0 20px;font-size:12px}
    th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
    th{background:#f8fafc}
  </style></head><body>
    <h1>Learner's Progress Report</h1>
    <h2>${escapeHtml(schoolName)}</h2>
    <p style="text-align:center">${escapeHtml(transcript.legal_name)} · ${escapeHtml(transcript.student_number)} · ${escapeHtml(transcript.class_label || '—')}<br>${escapeHtml(transcript.academic_year_label)} — ${escapeHtml(transcript.term_name)}</p>
    <p style="text-align:center;font-size:11px;color:#64748b">Kenyan CBC: EE (4) · ME (3) · AE (2) · BE (1)</p>
    ${areasHtml || '<p>No assessments recorded for this term.</p>'}
  </body></html>`
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
