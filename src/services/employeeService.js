import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'
import { sortEmployeesByEmployeeId } from '../utils/employeeSort.js'
import { ensureBulkImportCatalogFromRows } from './bulkImportCatalog.js'

const normalizeEmployeeList = (documents) =>
  sortEmployeesByEmployeeId(Array.isArray(documents) ? documents : [])

export const getEmployees = async (companyId, filters = {}) => {
  try {
    if (isLocalDataSource()) {
      const params = new URLSearchParams()
      params.set('company_id', companyId)
      if (filters.status && filters.status !== 'all') params.set('status', filters.status)
      if (filters.search) params.set('search', filters.search)
      const res = await localApiFetch(`/api/employees?${params.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to fetch employees')
      }
      const data = await res.json()
      return normalizeEmployeeList(data)
    }
    const queries = [
      Query.equal('company_id', companyId),
      Query.limit(5000)
    ]

    // Try with status filter first, fallback if status attribute doesn't exist
    if (filters.status && filters.status !== 'all') {
      try {
        queries.push(Query.equal('status', filters.status))
        const response = await databases.listDocuments(
          DATABASE_ID,
          COLLECTIONS.EMPLOYEES,
          queries
        )
        return normalizeEmployeeList(response.documents)
      } catch (statusError) {
        // If status attribute doesn't exist, fetch all employees
        if (statusError.message?.includes('Attribute not found') || statusError.message?.includes('status')) {
          console.warn('Status attribute not found, fetching all employees')
          queries.pop() // Remove status query
          const response = await databases.listDocuments(
            DATABASE_ID,
            COLLECTIONS.EMPLOYEES,
            queries
          )
          // Filter client-side if needed
          if (filters.status && filters.status !== 'all') {
            return normalizeEmployeeList(
              response.documents.filter((emp) => emp.status === filters.status || !emp.status)
            )
          }
          return normalizeEmployeeList(response.documents)
        }
        throw statusError
      }
    }

    if (filters.search) {
      queries.push(Query.search('name', filters.search))
    }

    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.EMPLOYEES,
      queries
    )
    return normalizeEmployeeList(response.documents)
  } catch (error) {
    console.error('Error fetching employees:', error)
    throw error
  }
}

export const getEmployee = async (employeeId) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/employees/${encodeURIComponent(employeeId)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to fetch employee')
      }
      return await res.json()
    }
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
    if (isLocalDataSource()) {
      const res = await localApiFetch('/api/employees', {
        method: 'POST',
        body: JSON.stringify(employeeData)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create employee')
      }
      return await res.json()
    }
    const now = new Date().toISOString()
    const employeePayload = {
      user_id: employeeData.user_id || '',
      // Role is managed from the HR app (admin / employee / manager, etc.)
      role: employeeData.role || 'employee',
      gender: employeeData.gender || '',
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
      created_at: now,
      updated_at: now
    }

    // Only add status if it exists in schema (will be added by fix script)
    // Try with status first, fallback without it
    try {
      employeePayload.status = employeeData.status || 'active'
      return await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.EMPLOYEES,
        'unique()',
        employeePayload
      )
    } catch (statusError) {
      if (statusError.message?.includes('Unknown attribute') && statusError.message?.includes('status')) {
        // Status attribute doesn't exist, create without it
        delete employeePayload.status
        return await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.EMPLOYEES,
          'unique()',
          employeePayload
        )
      }
      throw statusError
    }
  } catch (error) {
    console.error('Error creating employee:', error)
    throw error
  }
}

export const updateEmployee = async (employeeId, employeeData) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/employees/${encodeURIComponent(employeeId)}`, {
        method: 'PUT',
        body: JSON.stringify(employeeData)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update employee')
      }
      return await res.json()
    }
    const updateData = {
      ...employeeData,
      updated_at: new Date().toISOString()
    }

    if (updateData.basic_salary !== undefined && updateData.basic_salary !== null && updateData.basic_salary !== '') {
      const n = parseFloat(updateData.basic_salary)
      updateData.basic_salary = Number.isFinite(n) ? n : 0
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
    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/employees/${encodeURIComponent(employeeId)}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to delete employee')
      }
      return await res.json()
    }
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
    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/employees/by-user/${encodeURIComponent(userId)}`)
      if (!res.ok) {
        throw new Error('Failed to load employee')
      }
      return (await res.json()) || null
    }
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

/**
 * Normalizes one CSV row into the shape expected by create/update (no stray keys).
 */
function buildBulkEmployeePayload(raw, companyId) {
  const o = raw && typeof raw === 'object' ? raw : {}
  let basic = 0
  const bs = o.basic_salary
  if (bs !== null && bs !== undefined && bs !== '') {
    if (typeof bs === 'number' && Number.isFinite(bs)) {
      basic = bs
    } else {
      const s = String(bs)
        .replace(/,/g, '')
        .replace(/^\s*KES\s*/i, '')
        .replace(/\s/g, '')
      const n = parseFloat(s)
      basic = Number.isFinite(n) ? n : 0
    }
  }

  return {
    user_id: o.user_id != null ? String(o.user_id).trim() : '',
    company_id: companyId,
    name: String(o.name ?? '').trim(),
    status: (o.status && String(o.status).trim()) || 'active',
    role: (o.role && String(o.role).trim()) || 'employee',
    gender: o.gender != null ? String(o.gender).trim() : '',
    employee_id: o.employee_id != null ? String(o.employee_id).trim() : '',
    staff_no: o.staff_no != null ? String(o.staff_no).trim() : '',
    id_number: o.id_number != null ? String(o.id_number).trim() : '',
    kra_pin: o.kra_pin != null ? String(o.kra_pin).trim() : '',
    nssf_number: o.nssf_number != null ? String(o.nssf_number).trim() : '',
    shif_number: o.shif_number != null ? String(o.shif_number).trim() : '',
    department: o.department != null ? String(o.department).trim() : '',
    position: o.position != null ? String(o.position).trim() : '',
    basic_salary: basic,
    phone: o.phone != null ? String(o.phone).trim() : '',
    email: o.email != null ? String(o.email).trim() : '',
    bank_account: o.bank_account != null ? String(o.bank_account).trim() : '',
    bank_name: o.bank_name != null ? String(o.bank_name).trim() : '',
    bank_branch: o.bank_branch != null ? String(o.bank_branch).trim() : '',
    contract_start_date:
      o.contract_start_date != null ? String(o.contract_start_date).trim().slice(0, 10) : '',
    contract_end_date:
      o.contract_end_date != null ? String(o.contract_end_date).trim().slice(0, 10) : ''
  }
}

function normEmpMatchKey(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
}

function employeeDocId(emp) {
  return emp?.$id || emp?.id || ''
}

/**
 * Lookup maps for upsert: Employee ID and Staff No. (case-insensitive, trimmed) within one company.
 */
function buildUpsertLookupMaps(employees) {
  const byEmployeeId = new Map()
  const byStaffNo = new Map()
  for (const e of employees) {
    const ek = normEmpMatchKey(e.employee_id)
    const sk = normEmpMatchKey(e.staff_no)
    if (ek) byEmployeeId.set(ek, e)
    if (sk) byStaffNo.set(sk, e)
  }
  return { byEmployeeId, byStaffNo }
}

function findExistingForBulkUpsert(row, maps) {
  const csvEid = normEmpMatchKey(row.employee_id)
  const csvSid = normEmpMatchKey(row.staff_no)
  if (csvEid) {
    const hit = maps.byEmployeeId.get(csvEid)
    if (hit) return hit
  }
  if (csvSid) {
    const hit = maps.byStaffNo.get(csvSid)
    if (hit) return hit
  }
  return null
}

function removeEmployeeKeysFromMaps(maps, doc) {
  if (!doc) return
  const id = employeeDocId(doc)
  if (!id) return
  const ek = normEmpMatchKey(doc.employee_id)
  const sk = normEmpMatchKey(doc.staff_no)
  if (ek && employeeDocId(maps.byEmployeeId.get(ek)) === id) {
    maps.byEmployeeId.delete(ek)
  }
  if (sk && employeeDocId(maps.byStaffNo.get(sk)) === id) {
    maps.byStaffNo.delete(sk)
  }
}

function putEmployeeKeysInMaps(maps, doc) {
  const ek = normEmpMatchKey(doc.employee_id)
  const sk = normEmpMatchKey(doc.staff_no)
  if (ek) maps.byEmployeeId.set(ek, doc)
  if (sk) maps.byStaffNo.set(sk, doc)
}

function refreshUpsertMaps(maps, previousDoc, nextDoc) {
  removeEmployeeKeysFromMaps(maps, previousDoc)
  putEmployeeKeysInMaps(maps, nextDoc)
}

/**
 * Bulk-import CSV rows: creates new employees, or updates when Employee ID or Staff No. matches an existing record in this company.
 */
export const bulkCreateEmployees = async (employeesData, companyId, onProgress) => {
  const results = {
    success: [],
    errors: [],
    total: employeesData.length,
    catalogSummary: null
  }

  try {
    results.catalogSummary = await ensureBulkImportCatalogFromRows(companyId, employeesData)
  } catch (e) {
    results.catalogSummary = {
      banksCreated: 0,
      departmentsCount: 0,
      bankBranchesCount: 0,
      rolesCount: 0,
      warnings: [e.message || String(e)]
    }
  }

  let existingList = []
  try {
    existingList = await getEmployees(companyId, { status: 'all' })
  } catch (e) {
    console.warn('bulkCreateEmployees: could not preload employees for upsert', e)
  }

  const maps = buildUpsertLookupMaps(existingList)

  const report = () => {
    if (onProgress) {
      const created = results.success.filter((r) => r.action === 'created').length
      const updated = results.success.filter((r) => r.action === 'updated').length
      onProgress({
        processed: results.success.length + results.errors.length,
        total: employeesData.length,
        success: results.success.length,
        errors: results.errors.length,
        created,
        updated
      })
    }
  }

  for (let i = 0; i < employeesData.length; i++) {
    const employeeData = employeesData[i]

    try {
      const employeePayload = buildBulkEmployeePayload(employeeData, companyId)

      if (!employeePayload.name) {
        throw new Error('Name is required')
      }

      const existing = findExistingForBulkUpsert(employeePayload, maps)

      if (existing) {
        const empId = existing.$id || existing.id
        if (!empId) {
          throw new Error('Cannot update employee: missing record id')
        }
        const updated = await updateEmployee(empId, {
          ...employeePayload,
          user_id: existing.user_id || employeePayload.user_id || ''
        })
        refreshUpsertMaps(maps, existing, updated)
        results.success.push({
          row: i + 2,
          employee: updated,
          name: employeeData.name || 'Unknown',
          action: 'updated'
        })
      } else {
        const created = await createEmployee(employeePayload)
        refreshUpsertMaps(maps, null, created)
        results.success.push({
          row: i + 2,
          employee: created,
          name: employeeData.name || 'Unknown',
          action: 'created'
        })
      }

      report()
    } catch (error) {
      results.errors.push({
        row: i + 2,
        employee: employeeData,
        name: employeeData.name || 'Unknown',
        error: error.message || 'Unknown error'
      })

      report()
    }
  }

  return results
}
