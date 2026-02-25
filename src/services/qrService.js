/**
 * QR Code Generation Service
 * Generates QR codes for employees for attendance scanning
 */

export const generateQRCode = (employeeId, staffNo) => {
  // Generate QR token from employee ID or staff number
  // Format: EMP-{employeeId}-{timestamp} or use staff_no directly
  const qrToken = staffNo || `EMP-${employeeId}`
  return qrToken
}

export const generateQRCodeDataURL = async (text) => {
  // Use a QR code library to generate data URL
  // For now, return a placeholder - you can use qrcode library
  try {
    // Dynamic import of qrcode library if available
    const QRCode = await import('qrcode')
    const dataURL = await QRCode.toDataURL(text, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })
    return dataURL
  } catch (error) {
    console.error('QR code generation error:', error)
    // Fallback: return a simple text representation
    return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><text>${text}</text></svg>`
  }
}

export const getEmployeeQRToken = (employee) => {
  // Return the QR token for an employee
  // Priority: staff_no > employee_id > employee.$id
  return employee.staff_no || employee.employee_id || employee.$id
}
