import { useState, useEffect } from 'react'
import { generateQRCodeDataURL, getEmployeeQRToken } from '../services/qrService'
import { openPrintableForm, escapeHtml } from '../utils/printRequestForms'
import './EmployeeQRCode.css'

const EmployeeQRCode = ({ employee, onClose, companyLogoUrl }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    generateQR()
  }, [employee])

  const generateQR = async () => {
    try {
      setLoading(true)
      const qrToken = getEmployeeQRToken(employee)
      const dataURL = await generateQRCodeDataURL(qrToken)
      setQrCodeUrl(dataURL)
    } catch (error) {
      console.error('Error generating QR code:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadQR = () => {
    if (!qrCodeUrl) return

    const link = document.createElement('a')
    link.href = qrCodeUrl
    link.download = `${employee.name || 'employee'}-qr-code.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const printQR = () => {
    if (!qrCodeUrl) return
    const idLabel = employee.employee_id || employee.staff_no || 'N/A'
    openPrintableForm(
      `QR Code — ${employee.name || 'Employee'}`,
      `<div style="text-align:center">
        <h2 style="font-size:1.15rem;margin:0 0 10px">${escapeHtml(employee.name || '')}</h2>
        <p style="color:#444;margin:6px 0;font-size:11pt">Employee ID: ${escapeHtml(idLabel)}</p>
        <img src="${qrCodeUrl}" alt="QR Code" style="max-width:320px;margin:12px auto;display:block"/>
        <p style="color:#444;font-size:10pt">Scan this QR code at the attendance terminal</p>
      </div>`,
      { logoUrl: companyLogoUrl }
    )
  }

  return (
    <div className="qr-modal-overlay" onClick={onClose}>
      <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="qr-modal-header">
          <h2>Employee QR Code</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="qr-modal-body">
          <div className="employee-info">
            <h3>{employee.name}</h3>
            {employee.employee_id && <p>Employee ID: {employee.employee_id}</p>}
            {employee.staff_no && <p>Staff No: {employee.staff_no}</p>}
            {employee.department && <p>Department: {employee.department}</p>}
          </div>

          {loading ? (
            <div className="qr-loading">Generating QR code...</div>
          ) : qrCodeUrl ? (
            <div className="qr-code-container">
              <img src={qrCodeUrl} alt="QR Code" className="qr-code-image" />
              <p className="qr-instruction">Scan this code at the attendance terminal</p>
            </div>
          ) : (
            <div className="qr-error">Failed to generate QR code</div>
          )}
        </div>

        <div className="qr-modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          {qrCodeUrl && (
            <>
              <button className="btn-secondary" onClick={printQR}>
                Print
              </button>
              <button className="btn-primary" onClick={downloadQR}>
                Download
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default EmployeeQRCode
