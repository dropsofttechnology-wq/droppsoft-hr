import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'

export const getCompanies = async () => {
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
  } catch (error) {
    console.error('Error fetching companies:', error)
    throw error
  }
}

export const getCompany = async (companyId) => {
  try {
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
        status: 'active',
        created_at: new Date().toISOString()
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
    const company = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.COMPANIES,
      companyId,
      companyData
    )
    return company
  } catch (error) {
    console.error('Error updating company:', error)
    throw error
  }
}

export const deleteCompany = async (companyId) => {
  try {
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
