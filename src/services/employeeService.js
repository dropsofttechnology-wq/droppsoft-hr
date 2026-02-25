import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'

export const getEmployees = async (companyId, filters = {}) => {
  try {
    const queries = [
      Query.equal('company_id', companyId),
      Query.limit(5000)
    ]

    if (filters.status && filters.status !== 'all') {
      queries.push(Query.equal('status', filters.status))
    }

    if (filters.search) {
      queries.push(Query.search('name', filters.search))
    }

    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.EMPLOYEES,
      queries
    )
    return response.documents
  } catch (error) {
    console.error('Error fetching employees:', error)
    throw error
  }
}

export const getEmployee = async (employeeId) => {
  try {
    const employee = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.EMPLOYEES,
      employeeId
    )
    return employee
  } catch (error) {
    console.error('Error fetching employee:', error)
    throw error
  }
}

export const createEmployee = async (employeeData) => {
  try {
    const employee = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.EMPLOYEES,
      'unique()',
      {
        user_id: employeeData.user_id || '',
        company_id: employeeData.company_id,
        employee_id: employeeData.employee_id || '',
        staff_no: employeeData.staff_no || '',
        name: employeeData.name,
        id_number: employeeData.id_number || '',
        kra_pin: employeeData.kra_pin || '',
        nssf_number: employeeData.nssf_number || '',
        shif_number: employeeData.shif_number || '',
        department: employeeData.department || '',
        position: employeeData.position || '',
        basic_salary: parseFloat(employeeData.basic_salary) || 0,
        phone: employeeData.phone || '',
        email: employeeData.email || '',
        bank_account: employeeData.bank_account || '',
        bank_name: employeeData.bank_name || '',
        bank_branch: employeeData.bank_branch || '',
        contract_start_date: employeeData.contract_start_date || '',
        contract_end_date: employeeData.contract_end_date || '',
        status: employeeData.status || 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    )
    return employee
  } catch (error) {
    console.error('Error creating employee:', error)
    throw error
  }
}

export const updateEmployee = async (employeeId, employeeData) => {
  try {
    const updateData = {
      ...employeeData,
      updated_at: new Date().toISOString()
    }

    // Ensure numeric fields are properly converted
    if (updateData.basic_salary) {
      updateData.basic_salary = parseFloat(updateData.basic_salary)
    }

    const employee = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.EMPLOYEES,
      employeeId,
      updateData
    )
    return employee
  } catch (error) {
    console.error('Error updating employee:', error)
    throw error
  }
}

export const deleteEmployee = async (employeeId) => {
  try {
    await databases.deleteDocument(
      DATABASE_ID,
      COLLECTIONS.EMPLOYEES,
      employeeId
    )
  } catch (error) {
    console.error('Error deleting employee:', error)
    throw error
  }
}

export const getEmployeeByUserId = async (userId) => {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.EMPLOYEES,
      [
        Query.equal('user_id', userId),
        Query.limit(1)
      ]
    )
    return response.documents[0] || null
  } catch (error) {
    console.error('Error fetching employee by user ID:', error)
    throw error
  }
}
