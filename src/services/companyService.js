import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'

export const getCompanies = async () => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch('/api/companies')
      if (!res.ok) {
        throw new Error('Failed to load companies')
      }
      return await res.json()
    }
    // Try with status filter first, fallback to all if status attribute doesn't exist
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.COMPANIES,
        [
          Query.equal('status', 'active'),
          Query.limit(5000)
        ]
      )
      return response.documents
    } catch (statusError) {
      // If status attribute doesn't exist, fetch all companies
      if (statusError.message?.includes('Attribute not found') || statusError.message?.includes('status')) {
        console.warn('Status attribute not found, fetching all companies')
        const response = await databases.listDocuments(
          DATABASE_ID,
          COLLECTIONS.COMPANIES,
          [Query.limit(5000)]
        )
        return response.documents
      }
      throw statusError
    }
  } catch (error) {
    console.error('Error fetching companies:', error)
    throw error
  }
}

export const getCompany = async (companyId) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/companies/${encodeURIComponent(companyId)}`)
      if (!res.ok) {
        throw new Error('Failed to load company')
      }
      return await res.json()
    }
    const company = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.COMPANIES,
      companyId
    )
    return company
  } catch (error) {
    console.error('Error fetching company:', error)
    throw error
  }
}

export const createCompany = async (companyData) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch('/api/companies', {
        method: 'POST',
        body: JSON.stringify({
          name: companyData.name,
          registration_number: companyData.registration_number || '',
          tax_pin: companyData.tax_pin || '',
          address: companyData.address || '',
          phone: companyData.phone || '',
          email: companyData.email || '',
          logo_url: companyData.logo_url || ''
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create company')
      }
      return await res.json()
    }
    const now = new Date().toISOString()
    const company = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.COMPANIES,
      'unique()',
      {
        name: companyData.name,
        registration_number: companyData.registration_number || '',
        tax_pin: companyData.tax_pin || '',
        address: companyData.address || '',
        phone: companyData.phone || '',
        email: companyData.email || '',
        logo_url: companyData.logo_url || '',
        status: 'active',
        created_at: now,
        updated_at: now
      }
    )
    return company
  } catch (error) {
    console.error('Error creating company:', error)
    throw error
  }
}

export const updateCompany = async (companyId, companyData) => {
  try {
    if (isLocalDataSource()) {
      const updatedData = {
        ...companyData,
        updated_at: new Date().toISOString()
      }
      const res = await localApiFetch(`/api/companies/${encodeURIComponent(companyId)}`, {
        method: 'PUT',
        body: JSON.stringify(updatedData)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update company')
      }
      return await res.json()
    }
    const updatedData = {
      ...companyData,
      updated_at: new Date().toISOString()
    }
    const company = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.COMPANIES,
      companyId,
      updatedData
    )
    return company
  } catch (error) {
    console.error('Error updating company:', error)
    throw error
  }
}

export const deleteCompany = async (companyId) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/companies/${encodeURIComponent(companyId)}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to delete company')
      }
      return
    }
    await databases.deleteDocument(
      DATABASE_ID,
      COLLECTIONS.COMPANIES,
      companyId
    )
  } catch (error) {
    console.error('Error deleting company:', error)
    throw error
  }
}
