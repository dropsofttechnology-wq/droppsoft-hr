import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'

export const getBanks = async (filters = {}) => {
  try {
    if (isLocalDataSource()) {
      const params = new URLSearchParams()
      if (filters.status && filters.status !== 'all') params.set('status', filters.status)
      const res = await localApiFetch(`/api/banks?${params.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to fetch banks')
      }
      return await res.json()
    }
    const queries = [Query.limit(500)]

    if (filters.status && filters.status !== 'all') {
      queries.push(Query.equal('status', filters.status))
    }

    const res = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.BANKS,
      queries
    )
    return res.documents
  } catch (error) {
    console.error('Error fetching banks:', error)
    throw error
  }
}

export const createBank = async (data) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch('/api/banks', {
        method: 'POST',
        body: JSON.stringify({
          bank_name: data.bank_name,
          bank_code: data.bank_code || '',
          swift_code: data.swift_code || '',
          status: data.status || 'active'
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create bank')
      }
      return await res.json()
    }
    const now = new Date().toISOString()
    const payload = {
      bank_name: data.bank_name,
      bank_code: data.bank_code || '',
      swift_code: data.swift_code || '',
      status: data.status || 'active',
      created_at: now,
      updated_at: now
    }

    return await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.BANKS,
      'unique()',
      payload
    )
  } catch (error) {
    console.error('Error creating bank:', error)
    throw error
  }
}

export const updateBank = async (id, data) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/banks/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...data,
          updated_at: new Date().toISOString()
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update bank')
      }
      return await res.json()
    }
    const payload = {
      ...data,
      updated_at: new Date().toISOString()
    }
    return await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.BANKS,
      id,
      payload
    )
  } catch (error) {
    console.error('Error updating bank:', error)
    throw error
  }
}

export const deleteBank = async (id) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/banks/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to delete bank')
      }
      return
    }
    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.BANKS, id)
  } catch (error) {
    console.error('Error deleting bank:', error)
    throw error
  }
}
