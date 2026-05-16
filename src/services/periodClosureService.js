import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'

export const isPeriodClosed = async (companyId, period) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(
        `/api/period-closures?company_id=${encodeURIComponent(companyId)}&period=${encodeURIComponent(period)}`
      )
      if (!res.ok) return null
      const data = await res.json()
      return data || null
    }
    const res = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.PERIOD_CLOSURES,
      [
        Query.equal('company_id', companyId),
        Query.equal('period', period),
        Query.limit(1)
      ]
    )
    // If a document exists for this period, it means the period is closed
    return res.documents.length > 0 ? res.documents[0] : null
  } catch (error) {
    console.error('Error checking period closure:', error)
    return null
  }
}

export const closePeriod = async (companyId, period, userId) => {
  try {
    const existing = await isPeriodClosed(companyId, period)
    if (existing) {
      return existing
    }

    if (isLocalDataSource()) {
      const res = await localApiFetch('/api/period-closures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          period,
          closed_by: userId || '',
          notes: `Period closed by user ${userId || 'N/A'}`
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to close period')
      }
      return await res.json()
    }

    const now = new Date().toISOString()
    // Note: status attribute may not exist in the database
    // The existence of a period_closures document itself indicates the period is closed
    const payload = {
      company_id: companyId,
      period,
      closed_by: userId || '',
      closed_at: now,
      notes: `Period closed by user ${userId || 'N/A'}`,
      created_at: now,
      updated_at: now
    }
    // Only include status if the attribute exists (will be ignored if it doesn't)
    // payload.status = 'closed'
    
    return await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.PERIOD_CLOSURES,
      'unique()',
      payload
    )
  } catch (error) {
    console.error('Error closing period:', error)
    throw error
  }
}

