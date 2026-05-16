import { useState, useEffect, useCallback } from 'react'
import QRCode from 'qrcode'
import { buildStudentQrPayload } from '../../utils/studentQr'

/**
 * Small QR preview + print badge for one student (fee ledger roster).
 * @param {{ student: { $id: string, student_number?: string, legal_name?: string } }} props
 */
export default function FeeLedgerStudentQrCell({ student }) {
  const [dataUrl, setDataUrl] = useState('')
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    let cancelled = false
    const payload = buildStudentQrPayload(student.$id)
    setBusy(true)
    QRCode.toDataURL(payload, { width: 112, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setDataUrl('')
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [student.$id])

  const handlePrint = useCallback(() => {
    if (!dataUrl) return
    const num = String(student.student_number || '').trim()
    const name = String(student.legal_name || '').trim()
    const w = window.open('', '_blank', 'width=420,height=560')
    if (!w) return
    const title = `Student QR — ${num || name || 'Learner'}`
    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title.replace(/</g, '')}</title>
<style>
  body{font-family:system-ui,Segoe UI,sans-serif;text-align:center;padding:24px;margin:0}
  h1{font-size:1rem;margin:0 0 8px}
  p{margin:4px 0;color:#334155;font-size:0.9rem}
  img{width:200px;height:200px;image-rendering:pixelated;margin:16px auto;display:block}
  .hint{font-size:0.75rem;color:#64748b;margin-top:16px}
</style></head><body>
  <h1>Learner ID badge</h1>
  <p><strong>${num.replace(/</g, '')}</strong></p>
  <p>${name.replace(/</g, '')}</p>
  <img src="${dataUrl}" alt="Student QR" />
  <p class="hint">Scan to open this student in Dropsoft HR.</p>
</body></html>`)
    w.document.close()
    w.focus()
    requestAnimationFrame(() => {
      w.print()
      w.close()
    })
  }, [dataUrl, student.legal_name, student.student_number])

  return (
    <div className="fee-ledger-student-qr-cell">
      {busy ? (
        <span className="fee-ledger-student-qr-cell__loading">…</span>
      ) : dataUrl ? (
        <img className="fee-ledger-student-qr-cell__thumb" src={dataUrl} alt="" width={40} height={40} />
      ) : (
        <span className="fee-ledger-student-qr-cell__err">—</span>
      )}
      <button
        type="button"
        className="fee-ledger-student-qr-cell__print"
        onClick={handlePrint}
        disabled={!dataUrl}
      >
        Print QR
      </button>
    </div>
  )
}
