import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'

/**
 * Email payslip PDFs to each employee using the email on their employee record.
 * Requires SMTP configured under Settings (local / desktop API only).
 */
export async function sendPayslipsByEmail(companyId, period) {
  if (!isLocalDataSource()) {
    throw new Error('Email payslips are only available when using the local (desktop) database.')
  }
  const res = await localApiFetch('/api/payslips/send-email', {
    method: 'POST',
    body: JSON.stringify({ company_id: companyId, period })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'Failed to send payslip emails')
  }
  return data
}
