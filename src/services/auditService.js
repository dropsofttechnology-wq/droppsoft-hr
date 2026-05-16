import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'

/**
 * Log an audit event. Safe to call even if audit_log collection is missing (fails silently).
 * @param {string} userId - User who performed the action
 * @param {string} [companyId] - Company context
 * @param {string} action - Action code (e.g. 'payroll_saved', 'employee_deleted', 'leave_approved')
 * @param {{ entityType?: string, entityId?: string, details?: string }} [options] - Optional entity and details
 */
export const logAudit = async (userId, companyId, action, options = {}) => {
  try {
    if (isLocalDataSource()) {
      const detailsStr = options.details != null ? String(options.details) : ''
      const res = await localApiFetch('/api/audit/logs', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId || 'anonymous',
          company_id: companyId || '',
          action: String(action).slice(0, 100),
          entity_type: (options.entityType || '').slice(0, 100),
          entity_id: (options.entityId || '').slice(0, 255),
          new_value: detailsStr.length > 5000 ? detailsStr.slice(0, 5000) : detailsStr
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.warn('Audit log write failed (non-blocking):', err.error || res.status)
      }
      return
    }
    const payload = {
      user_id: userId || 'anonymous',
      company_id: companyId || '',
      action: String(action).slice(0, 100),
      entity_type: (options.entityType || '').slice(0, 100),
      entity_id: (options.entityId || '').slice(0, 255),
      created_at: new Date().toISOString()
    }
    const detailsStr = options.details != null ? String(options.details) : ''
    if (detailsStr.length > 5000) {
      payload.new_value = detailsStr.slice(0, 5000)
    } else if (detailsStr) {
      payload.new_value = detailsStr
    }
    await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.AUDIT_LOG,
      'unique()',
      payload
    )
  } catch (error) {
    console.warn('Audit log write failed (non-blocking):', error.message)
  }
}

/**
 * Fetch recent audit log entries for a company (for admin view).
 */
export const getAuditLogs = async (companyId, { limit = 100, offset = 0 } = {}) => {
  if (isLocalDataSource()) {
    const params = new URLSearchParams()
    params.set('company_id', companyId)
    params.set('limit', String(Math.min(limit, 500)))
    params.set('offset', String(offset))
    const res = await localApiFetch(`/api/audit/logs?${params.toString()}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to load audit logs')
    }
    return await res.json()
  }
  const res = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.AUDIT_LOG,
    [
      Query.equal('company_id', companyId),
      Query.orderDesc('created_at'),
      Query.limit(Math.min(limit, 500)),
      Query.offset(offset)
    ]
  )
  return res.documents
}
