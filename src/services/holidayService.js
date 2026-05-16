import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'

export const getHolidays = async (companyId, filters = {}) => {
  try {
    if (isLocalDataSource()) {
      const params = new URLSearchParams()
      params.set('company_id', companyId)
      if (filters.year) params.set('year', String(filters.year))
      if (filters.status && filters.status !== 'all') params.set('status', filters.status)
      if (filters.start_date && filters.end_date) {
        params.set('from', filters.start_date)
        params.set('to', filters.end_date)
      }
      const res = await localApiFetch(`/api/holidays?${params.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to fetch holidays')
      }
      const rows = await res.json()
      return rows.map((r) => ({ ...r, $id: r.id || r.$id }))
    }
    const queries = [
      Query.equal('company_id', companyId),
      Query.orderAsc('holiday_date'),
      Query.limit(5000)
    ]

    if (filters.year) {
      // Filter by year using date range
      const yearStart = `${filters.year}-01-01`
      const yearEnd = `${filters.year}-12-31`
      queries.push(Query.greaterThanEqual('holiday_date', yearStart))
      queries.push(Query.lessThanEqual('holiday_date', yearEnd))
    }
    if (filters.start_date && filters.end_date) {
      queries.push(Query.greaterThanEqual('holiday_date', String(filters.start_date)))
      queries.push(Query.lessThanEqual('holiday_date', String(filters.end_date)))
    }

    if (filters.status && filters.status !== 'all') {
      queries.push(Query.equal('status', filters.status))
    }

    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.HOLIDAYS,
      queries
    )
    return response.documents
  } catch (error) {
    console.error('Error fetching holidays:', error)
    throw error
  }
}

export const getHoliday = async (holidayId) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/holidays/${encodeURIComponent(holidayId)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to fetch holiday')
      }
      return await res.json()
    }
    const holiday = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.HOLIDAYS,
      holidayId
    )
    return holiday
  } catch (error) {
    console.error('Error fetching holiday:', error)
    throw error
  }
}

export const getHolidayByDate = async (companyId, date) => {
  try {
    if (isLocalDataSource()) {
      const params = new URLSearchParams()
      params.set('company_id', companyId)
      params.set('date', date)
      params.set('status', 'active')
      const res = await localApiFetch(`/api/holidays?${params.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to fetch holiday')
      }
      const rows = await res.json()
      return rows[0] || null
    }
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.HOLIDAYS,
      [
        Query.equal('company_id', companyId),
        Query.equal('holiday_date', date),
        Query.equal('status', 'active'),
        Query.limit(1)
      ]
    )
    return response.documents[0] || null
  } catch (error) {
    console.error('Error fetching holiday by date:', error)
    throw error
  }
}

export const isHoliday = async (companyId, date) => {
  try {
    const holiday = await getHolidayByDate(companyId, date)
    return holiday !== null
  } catch (error) {
    console.error('Error checking holiday:', error)
    return false
  }
}

export const createHoliday = async (holidayData) => {
  try {
    const now = new Date().toISOString()

    const existing = await getHolidayByDate(holidayData.company_id, holidayData.holiday_date)
    if (existing) {
      throw new Error('A holiday already exists for this date.')
    }

    const rateType = holidayData.rate_type || 'normal'
    const rateVal = rateType === 'normal' ? 100 : (parseFloat(holidayData.rate) || 100)

    if (isLocalDataSource()) {
      const res = await localApiFetch('/api/holidays', {
        method: 'POST',
        body: JSON.stringify({
          company_id: holidayData.company_id,
          holiday_date: holidayData.holiday_date,
          holiday_name: holidayData.holiday_name,
          rate_type: rateType,
          rate: rateVal,
          reporting_time: holidayData.reporting_time || '',
          closing_time: holidayData.closing_time || '',
          status: holidayData.status || 'active'
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create holiday')
      }
      return await res.json()
    }

    const holiday = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.HOLIDAYS,
      'unique()',
      {
        company_id: holidayData.company_id,
        holiday_date: holidayData.holiday_date,
        holiday_name: holidayData.holiday_name,
        rate_type: rateType,
        rate: rateVal,
        reporting_time: holidayData.reporting_time || null,
        closing_time: holidayData.closing_time || null,
        status: holidayData.status || 'active',
        created_at: now,
        updated_at: now
      }
    )
    return holiday
  } catch (error) {
    console.error('Error creating holiday:', error)
    throw error
  }
}

export const updateHoliday = async (holidayId, holidayData) => {
  try {
    const rateType = holidayData.rate_type || 'normal'
    const rate = rateType === 'normal' ? 100 : (parseFloat(holidayData.rate) || 100)

    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/holidays/${encodeURIComponent(holidayId)}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...holidayData,
          rate_type: rateType,
          rate,
          updated_at: new Date().toISOString()
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update holiday')
      }
      return await res.json()
    }

    const updateData = {
      ...holidayData,
      updated_at: new Date().toISOString()
    }
    updateData.rate_type = rateType
    updateData.rate = rate

    const holiday = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.HOLIDAYS,
      holidayId,
      updateData
    )
    return holiday
  } catch (error) {
    console.error('Error updating holiday:', error)
    throw error
  }
}

export const deleteHoliday = async (holidayId) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/holidays/${encodeURIComponent(holidayId)}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to delete holiday')
      }
      return
    }
    await databases.deleteDocument(
      DATABASE_ID,
      COLLECTIONS.HOLIDAYS,
      holidayId
    )
  } catch (error) {
    console.error('Error deleting holiday:', error)
    throw error
  }
}
