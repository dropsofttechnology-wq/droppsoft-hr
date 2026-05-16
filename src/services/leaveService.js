import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'
import { getEmployee } from './employeeService'
import {
  BALANCE_DEDUCTION,
  countsAgainstAnnualBalance,
  normalizeBalanceDeductionInput
} from '../utils/leaveBalanceDeduction.js'
import { getCompanySettingBoolean } from '../utils/settingsHelper'

/**
 * For ANNUAL leave pool, per-employee days/year (if set) overrides company leave type default.
 */
function resolveAnnualEntitlementDays(employee, fromLeaveTypeConfig) {
  if (!employee) return fromLeaveTypeConfig
  const o = employee.annual_leave_entitlement_days
  if (o != null && o !== '' && Number.isFinite(Number(o))) {
    return Math.max(0, Number(o))
  }
  return fromLeaveTypeConfig
}

// Leave Types
export const getLeaveTypes = async (companyId, activeOnly = true) => {
  try {
    if (isLocalDataSource()) {
      const params = new URLSearchParams()
      params.set('company_id', companyId)
      params.set('active_only', activeOnly ? '1' : '0')
      const res = await localApiFetch(`/api/leave-types?${params.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to fetch leave types')
      }
      return await res.json()
    }
    const queries = [
      Query.equal('company_id', companyId),
      Query.orderAsc('display_order'),
      Query.orderAsc('leave_name'),
      Query.limit(100)
    ]

    if (activeOnly) {
      queries.push(Query.equal('status', 'active'))
    }

    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.LEAVE_TYPES,
      queries
    )
    return response.documents
  } catch (error) {
    console.error('Error fetching leave types:', error)
    throw error
  }
}

export const getLeaveType = async (leaveTypeId) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/leave-types/${encodeURIComponent(leaveTypeId)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to fetch leave type')
      }
      return await res.json()
    }
    const leaveType = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.LEAVE_TYPES,
      leaveTypeId
    )
    return leaveType
  } catch (error) {
    console.error('Error fetching leave type:', error)
    throw error
  }
}

export const createLeaveType = async (leaveTypeData) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch('/api/leave-types', {
        method: 'POST',
        body: JSON.stringify({
          company_id: leaveTypeData.company_id,
          leave_code: leaveTypeData.leave_code.toUpperCase(),
          leave_name: leaveTypeData.leave_name,
          description: leaveTypeData.description || '',
          entitlement_days: parseFloat(leaveTypeData.entitlement_days) || 0,
          is_statutory: leaveTypeData.is_statutory || false,
          display_order: parseInt(leaveTypeData.display_order, 10) || 0,
          status: leaveTypeData.status || 'active',
          pay_percentage:
            leaveTypeData.pay_percentage != null
              ? Math.max(0, Math.min(100, Number(leaveTypeData.pay_percentage)))
              : undefined
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create leave type')
      }
      return await res.json()
    }
    const now = new Date().toISOString()
    const leaveType = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.LEAVE_TYPES,
      'unique()',
      {
        company_id: leaveTypeData.company_id,
        leave_code: leaveTypeData.leave_code.toUpperCase(),
        leave_name: leaveTypeData.leave_name,
        description: leaveTypeData.description || '',
        entitlement_days: parseFloat(leaveTypeData.entitlement_days) || 0,
        is_statutory: leaveTypeData.is_statutory || false,
        display_order: parseInt(leaveTypeData.display_order) || 0,
        status: leaveTypeData.status || 'active',
        created_at: now,
        updated_at: now
      }
    )
    return leaveType
  } catch (error) {
    console.error('Error creating leave type:', error)
    throw error
  }
}

export const updateLeaveType = async (leaveTypeId, leaveTypeData) => {
  try {
    if (isLocalDataSource()) {
      const updateData = { ...leaveTypeData, updated_at: new Date().toISOString() }
      if (updateData.leave_code) {
        updateData.leave_code = updateData.leave_code.toUpperCase()
      }
      if (updateData.entitlement_days != null) {
        updateData.entitlement_days = parseFloat(updateData.entitlement_days)
      }
      if (updateData.display_order != null) {
        updateData.display_order = parseInt(updateData.display_order, 10)
      }
      const res = await localApiFetch(`/api/leave-types/${encodeURIComponent(leaveTypeId)}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update leave type')
      }
      return await res.json()
    }
    const updateData = {
      ...leaveTypeData,
      updated_at: new Date().toISOString()
    }

    if (updateData.leave_code) {
      updateData.leave_code = updateData.leave_code.toUpperCase()
    }

    if (updateData.entitlement_days) {
      updateData.entitlement_days = parseFloat(updateData.entitlement_days)
    }

    if (updateData.display_order) {
      updateData.display_order = parseInt(updateData.display_order)
    }

    const leaveType = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.LEAVE_TYPES,
      leaveTypeId,
      updateData
    )
    return leaveType
  } catch (error) {
    console.error('Error updating leave type:', error)
    throw error
  }
}

export const deleteLeaveType = async (leaveTypeId) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/leave-types/${encodeURIComponent(leaveTypeId)}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to delete leave type')
      }
      return
    }
    await databases.deleteDocument(
      DATABASE_ID,
      COLLECTIONS.LEAVE_TYPES,
      leaveTypeId
    )
  } catch (error) {
    console.error('Error deleting leave type:', error)
    throw error
  }
}

// Leave Requests
export const getLeaveRequests = async (companyId, filters = {}) => {
  try {
    if (isLocalDataSource()) {
      const params = new URLSearchParams()
      params.set('company_id', companyId)
      if (filters.status && filters.status !== 'all') params.set('status', filters.status)
      if (filters.employee_id) params.set('employee_id', filters.employee_id)
      if (filters.from) params.set('from', String(filters.from))
      if (filters.to) params.set('to', String(filters.to))
      const res = await localApiFetch(`/api/leave/requests?${params.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to fetch leave requests')
      }
      let rows = await res.json()
      rows = rows.map((r) => ({ ...r, $id: r.$id || r.id }))
      if (filters.start_date && filters.end_date) {
        const a = String(filters.start_date)
        const b = String(filters.end_date)
        rows = rows.filter(
          (leave) => leave.start_date <= b && leave.end_date >= a
        )
      }
      return rows
    }
    const queries = [
      Query.equal('company_id', companyId),
      Query.orderDesc('created_at'),
      Query.limit(1000)
    ]

    if (filters.status && filters.status !== 'all') {
      queries.push(Query.equal('status', filters.status))
    }

    if (filters.employee_id) {
      queries.push(Query.equal('employee_id', filters.employee_id))
    }

    if (filters.leave_type) {
      queries.push(Query.equal('leave_type', filters.leave_type))
    }

    if (filters.start_date && filters.end_date) {
      queries.push(Query.greaterThanEqual('start_date', filters.start_date))
      queries.push(Query.lessThanEqual('end_date', filters.end_date))
    }

    // Overlap with [from, to] (any leave crossing this window)
    if (filters.from && filters.to) {
      queries.push(Query.lessThanEqual('start_date', filters.to))
      queries.push(Query.greaterThanEqual('end_date', filters.from))
    }

    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.LEAVE_REQUESTS,
      queries
    )
    return response.documents
  } catch (error) {
    console.error('Error fetching leave requests:', error)
    throw error
  }
}

export const getLeaveRequest = async (leaveRequestId) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/leave/requests/${encodeURIComponent(leaveRequestId)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to fetch leave request')
      }
      const row = await res.json()
      return { ...row, $id: row.$id || row.id }
    }
    const leaveRequest = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.LEAVE_REQUESTS,
      leaveRequestId
    )
    return leaveRequest
  } catch (error) {
    console.error('Error fetching leave request:', error)
    throw error
  }
}

export const createLeaveRequest = async (leaveRequestData) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch('/api/leave/requests', {
        method: 'POST',
        body: JSON.stringify(leaveRequestData)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create leave request')
      }
      const row = await res.json()
      return { ...row, $id: row.$id || row.id }
    }
    const now = new Date().toISOString()
    
    // Calculate days requested
    const start = new Date(leaveRequestData.start_date)
    const end = new Date(leaveRequestData.end_date)
    const daysRequested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1

    // Check for overlapping leave requests
    const existing = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.LEAVE_REQUESTS,
      [
        Query.equal('employee_id', leaveRequestData.employee_id),
        Query.equal('status', 'pending'),
        Query.lessThanEqual('start_date', leaveRequestData.end_date),
        Query.greaterThanEqual('end_date', leaveRequestData.start_date),
        Query.limit(1)
      ]
    )

    if (existing.documents.length > 0) {
      throw new Error('Leave request overlaps with existing pending or approved leave.')
    }

    const leaveCode = String(leaveRequestData.leave_type || '').toUpperCase()
    const payload = {
      company_id: leaveRequestData.company_id,
      employee_id: leaveRequestData.employee_id,
      leave_type: leaveCode,
      start_date: leaveRequestData.start_date,
      end_date: leaveRequestData.end_date,
      days_requested: daysRequested,
      reason: leaveRequestData.reason || '',
      status: 'pending',
      created_at: now,
      updated_at: now
    }
    // Optional Appwrite attribute — add `balance_deduction` (string) to the collection to sync with desktop behaviour
    const bd = normalizeBalanceDeductionInput(leaveRequestData.balance_deduction, leaveCode)
    payload.balance_deduction = bd

    const leaveRequest = await databases.createDocument(DATABASE_ID, COLLECTIONS.LEAVE_REQUESTS, 'unique()', payload)
    return leaveRequest
  } catch (error) {
    console.error('Error creating leave request:', error)
    throw error
  }
}

export const updateLeaveRequest = async (leaveRequestId, leaveRequestData) => {
  try {
    const current = await getLeaveRequest(leaveRequestId)

    const updateData = {
      ...leaveRequestData,
      updated_at: new Date().toISOString()
    }

    // Recalculate days if dates changed
    if (updateData.start_date && updateData.end_date) {
      const start = new Date(updateData.start_date)
      const end = new Date(updateData.end_date)
      updateData.days_requested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
    }

    if (updateData.leave_type) {
      updateData.leave_type = updateData.leave_type.toUpperCase()
    }

    const merged = { ...current, ...updateData }
    const ltMerged = String(merged.leave_type || '').toUpperCase()
    const st = String(merged.status || '').toLowerCase()
    const daysVal = Number(merged.days_requested)
    if ((st === 'pending' || st === 'approved') && !Number.isNaN(daysVal)) {
      const employee = await getEmployee(merged.employee_id)
      const types = await getLeaveTypes(merged.company_id, true)
      await assertAnnualPoolAllowsBooking({
        companyId: merged.company_id,
        employeeId: merged.employee_id,
        leaveType: ltMerged,
        balanceDeduction: merged.balance_deduction,
        daysRequested: daysVal,
        leaveTypes: types,
        employee,
        excludeRequestIds: st === 'approved' ? [leaveRequestId] : []
      })
    }

    if (isLocalDataSource()) {
      const payload = { ...updateData }
      delete payload.updated_at
      delete payload.$id
      delete payload.$collectionId
      delete payload.$databaseId
      const res = await localApiFetch(`/api/leave/requests/${encodeURIComponent(leaveRequestId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update leave request')
      }
      const row = await res.json()
      return { ...row, $id: row.$id || row.id }
    }

    const leaveRequest = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.LEAVE_REQUESTS,
      leaveRequestId,
      updateData
    )
    return leaveRequest
  } catch (error) {
    console.error('Error updating leave request:', error)
    throw error
  }
}

export const approveLeaveRequest = async (leaveRequestId, approvedBy) => {
  try {
    const existing = await getLeaveRequest(leaveRequestId)
    if (existing && String(existing.status || '').toLowerCase() === 'pending') {
      const employee = await getEmployee(existing.employee_id)
      const types = await getLeaveTypes(existing.company_id, true)
      await assertAnnualPoolAllowsBooking({
        companyId: existing.company_id,
        employeeId: existing.employee_id,
        leaveType: existing.leave_type,
        balanceDeduction: existing.balance_deduction,
        daysRequested: Number(existing.days_requested) || 0,
        leaveTypes: types,
        employee,
        excludeRequestIds: []
      })
    }

    if (isLocalDataSource()) {
      void approvedBy
      const res = await localApiFetch(`/api/leave/requests/${encodeURIComponent(leaveRequestId)}/approve`, {
        method: 'POST',
        body: JSON.stringify({ decision: 'approved' })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to approve leave request')
      }
      return await res.json()
    }
    const now = new Date().toISOString()
    const leaveRequest = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.LEAVE_REQUESTS,
      leaveRequestId,
      {
        status: 'approved',
        approved_by: approvedBy,
        approved_at: now,
        updated_at: now
      }
    )
    return leaveRequest
  } catch (error) {
    console.error('Error approving leave request:', error)
    throw error
  }
}

export const rejectLeaveRequest = async (leaveRequestId, rejectedBy, rejectionReason = '') => {
  try {
    if (isLocalDataSource()) {
      void rejectedBy
      void rejectionReason
      const res = await localApiFetch(`/api/leave/requests/${encodeURIComponent(leaveRequestId)}/approve`, {
        method: 'POST',
        body: JSON.stringify({ decision: 'rejected' })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to reject leave request')
      }
      return await res.json()
    }
    const now = new Date().toISOString()
    const leaveRequest = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.LEAVE_REQUESTS,
      leaveRequestId,
      {
        status: 'rejected',
        rejected_by: rejectedBy,
        rejected_at: now,
        rejection_reason: rejectionReason,
        updated_at: now
      }
    )
    return leaveRequest
  } catch (error) {
    console.error('Error rejecting leave request:', error)
    throw error
  }
}

/** Deactivate approved leave when the role has leave_request_deactivate permission. */
export const deactivateLeaveRequest = async (leaveRequestId) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/leave/requests/${encodeURIComponent(leaveRequestId)}/deactivate`, {
        method: 'POST'
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to deactivate leave request')
      }
      return await res.json()
    }
    throw new Error('Deactivate leave is only supported for local data source')
  } catch (error) {
    console.error('Error deactivating leave request:', error)
    throw error
  }
}

export const deleteLeaveRequest = async (leaveRequestId) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/leave/requests/${encodeURIComponent(leaveRequestId)}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to delete leave request')
      }
      return
    }
    await databases.deleteDocument(
      DATABASE_ID,
      COLLECTIONS.LEAVE_REQUESTS,
      leaveRequestId
    )
  } catch (error) {
    console.error('Error deleting leave request:', error)
    throw error
  }
}

/**
 * Find and delete duplicate approved leave (same employee, start_date, end_date).
 * Keeps the first occurrence (oldest by created_at), deletes the rest.
 * @param {string} companyId
 * @returns {{ deleted: number, ids: string[] }}
 */
export const deleteDuplicateApprovedLeave = async (companyId) => {
  const deleted = []
  const list = await getLeaveRequests(companyId, { status: 'approved' })
  const key = (doc) => `${doc.employee_id}|${doc.start_date}|${doc.end_date}`
  const byKey = new Map()
  list.forEach((doc) => {
    const k = key(doc)
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k).push(doc)
  })
  for (const [, docs] of byKey) {
    if (docs.length <= 1) continue
    const sorted = [...docs].sort((a, b) => (a.created_at || a.$id).localeCompare(b.created_at || b.$id))
    for (let i = 1; i < sorted.length; i++) {
      const id = sorted[i].$id || sorted[i].id
      await deleteLeaveRequest(id)
      deleted.push(id)
    }
  }
  return { deleted: deleted.length, ids: deleted }
}

/**
 * When approving or editing leave, pass `excludeRequestIds` so the request being changed is not counted as "used".
 * @param {object} [opts] Optional { employee, leaveTypes, excludeRequestIds } to avoid extra API calls from Leave Request page.
 */
export const calculateLeaveBalance = async (employeeId, leaveType, companyId, opts = {}) => {
  try {
    const excludeSet = new Set((opts.excludeRequestIds || []).map((id) => String(id)))

    if (isLocalDataSource()) {
      const employee = opts.employee || (await getEmployee(employeeId))
      if (!employee) {
        return {
          current_year: { accrued: 0, used: 0, available: 0 },
          next_year: { accrued: 0, used: 0, available: 0 }
        }
      }
      const leaveTypes = opts.leaveTypes || (await getLeaveTypes(companyId, true))
      const leaveTypeData = leaveTypes.find((lt) => lt.leave_code === leaveType.toUpperCase())
      const baseEnt =
        leaveTypeData?.entitlement_days != null
          ? Number(leaveTypeData.entitlement_days)
          : leaveTypeData?.days_allowed != null
            ? Number(leaveTypeData.days_allowed)
            : 21
      const ltUpper = leaveType.toUpperCase()
      const entitlement = ltUpper === 'ANNUAL' ? resolveAnnualEntitlementDays(employee, baseEnt) : baseEnt

      const today = new Date()
      const currentYear = today.getFullYear()
      const nextYear = currentYear + 1

      if (!employee.contract_start_date) {
        return {
          current_year: { accrued: 0, used: 0, available: 0 },
          next_year: { accrued: entitlement, used: 0, available: entitlement }
        }
      }

      const contractDate = new Date(employee.contract_start_date)
      const monthsWorked =
        (today.getFullYear() - contractDate.getFullYear()) * 12 + (today.getMonth() - contractDate.getMonth())
      const accrued = ltUpper === 'ANNUAL' ? entitlement : (entitlement / 12) * monthsWorked

      const approved = await getLeaveRequests(companyId, { status: 'approved', employee_id: employeeId })
      const inCalendarYear = (req, y) =>
        req.start_date >= `${y}-01-01` && req.start_date <= `${y}-12-31`

      const reqId = (req) => String(req.$id || req.id || '')

      const usedCurrentDays =
        ltUpper === 'ANNUAL'
          ? approved
              .filter(
                (req) =>
                  !excludeSet.has(reqId(req)) &&
                  inCalendarYear(req, currentYear) &&
                  countsAgainstAnnualBalance(req)
              )
              .reduce((sum, req) => sum + (parseFloat(req.days_requested) || 0), 0)
          : approved
              .filter(
                (req) =>
                  !excludeSet.has(reqId(req)) &&
                  String(req.leave_type).toUpperCase() === ltUpper &&
                  inCalendarYear(req, currentYear)
              )
              .reduce((sum, req) => sum + (parseFloat(req.days_requested) || 0), 0)

      const usedNextDays =
        ltUpper === 'ANNUAL'
          ? approved
              .filter(
                (req) =>
                  !excludeSet.has(reqId(req)) &&
                  inCalendarYear(req, nextYear) &&
                  countsAgainstAnnualBalance(req)
              )
              .reduce((sum, req) => sum + (parseFloat(req.days_requested) || 0), 0)
          : approved
              .filter(
                (req) =>
                  !excludeSet.has(reqId(req)) &&
                  String(req.leave_type).toUpperCase() === ltUpper &&
                  inCalendarYear(req, nextYear)
              )
              .reduce((sum, req) => sum + (parseFloat(req.days_requested) || 0), 0)

      return {
        current_year: {
          accrued: Math.round(accrued * 100) / 100,
          used: Math.round(usedCurrentDays * 100) / 100,
          available: Math.max(0, Math.round((accrued - usedCurrentDays) * 100) / 100)
        },
        next_year: {
          accrued: entitlement,
          used: Math.round(usedNextDays * 100) / 100,
          available: Math.max(0, Math.round((entitlement - usedNextDays) * 100) / 100)
        }
      }
    }

    // Get employee contract start date
    let empDoc = opts.employee && String(opts.employee.$id) === String(employeeId) ? opts.employee : null
    if (!empDoc) {
      const employee = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.EMPLOYEES,
        [
          Query.equal('$id', employeeId),
          Query.limit(1)
        ]
      )
      empDoc = employee.documents[0] || null
    }

    if (!empDoc) {
      return {
        current_year: { accrued: 0, used: 0, available: 0 },
        next_year: { accrued: 0, used: 0, available: 0 }
      }
    }

    const leaveTypesAw = opts.leaveTypes?.length ? opts.leaveTypes : await getLeaveTypes(companyId, true)
    const leaveTypeDataAw = leaveTypesAw.find((lt) => lt.leave_code === leaveType.toUpperCase())
    const baseEntAw = leaveTypeDataAw?.entitlement_days || 21
    const ltU = leaveType.toUpperCase()
    const entitlement =
      ltU === 'ANNUAL' ? resolveAnnualEntitlementDays(empDoc, baseEntAw) : baseEntAw

    const contractStart = empDoc.contract_start_date
    if (!contractStart) {
      return {
        current_year: { accrued: 0, used: 0, available: 0 },
        next_year: { accrued: entitlement, used: 0, available: entitlement }
      }
    }

    const today = new Date()
    const currentYear = today.getFullYear()
    const nextYear = currentYear + 1

    // Calculate months of service
    const contractDate = new Date(contractStart)
    const monthsWorked = (today.getFullYear() - contractDate.getFullYear()) * 12 + 
                         (today.getMonth() - contractDate.getMonth())

    // Annual leave uses full yearly entitlement; other leave types remain accrual-based.
    const accrued = ltU === 'ANNUAL' ? entitlement : (entitlement / 12) * monthsWorked

    // Calculate used leave for current year
    const currentYearStart = `${currentYear}-01-01`
    const currentYearEnd = `${currentYear}-12-31`

    const nextYearStart = `${nextYear}-01-01`
    const nextYearEnd = `${nextYear}-12-31`

    const mapDoc = (d) => ({
      leave_type: d.leave_type,
      balance_deduction: d.balance_deduction,
      status: d.status,
      days_requested: d.days_requested,
      start_date: d.start_date
    })

    let usedCurrentDays
    let usedNextDays

    if (ltU === 'ANNUAL') {
      const usedCurrent = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.LEAVE_REQUESTS,
        [
          Query.equal('employee_id', employeeId),
          Query.equal('status', 'approved'),
          Query.greaterThanEqual('start_date', currentYearStart),
          Query.lessThanEqual('start_date', currentYearEnd),
          Query.limit(500)
        ]
      )
      usedCurrentDays = usedCurrent.documents
        .filter((d) => !excludeSet.has(String(d.$id)))
        .map(mapDoc)
        .filter(countsAgainstAnnualBalance)
        .reduce((sum, req) => sum + (parseFloat(req.days_requested) || 0), 0)

      const usedNext = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.LEAVE_REQUESTS,
        [
          Query.equal('employee_id', employeeId),
          Query.equal('status', 'approved'),
          Query.greaterThanEqual('start_date', nextYearStart),
          Query.lessThanEqual('start_date', nextYearEnd),
          Query.limit(500)
        ]
      )
      usedNextDays = usedNext.documents
        .filter((d) => !excludeSet.has(String(d.$id)))
        .map(mapDoc)
        .filter(countsAgainstAnnualBalance)
        .reduce((sum, req) => sum + (parseFloat(req.days_requested) || 0), 0)
    } else {
      const usedCurrent = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.LEAVE_REQUESTS,
        [
          Query.equal('employee_id', employeeId),
          Query.equal('leave_type', ltU),
          Query.equal('status', 'approved'),
          Query.greaterThanEqual('start_date', currentYearStart),
          Query.lessThanEqual('start_date', currentYearEnd)
        ]
      )

      usedCurrentDays = usedCurrent.documents
        .filter((d) => !excludeSet.has(String(d.$id)))
        .reduce((sum, req) => sum + (parseFloat(req.days_requested) || 0), 0)

      const usedNext = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.LEAVE_REQUESTS,
        [
          Query.equal('employee_id', employeeId),
          Query.equal('leave_type', ltU),
          Query.equal('status', 'approved'),
          Query.greaterThanEqual('start_date', nextYearStart),
          Query.lessThanEqual('start_date', nextYearEnd)
        ]
      )

      usedNextDays = usedNext.documents
        .filter((d) => !excludeSet.has(String(d.$id)))
        .reduce((sum, req) => sum + (parseFloat(req.days_requested) || 0), 0)
    }

    return {
      current_year: {
        accrued: Math.round(accrued * 100) / 100,
        used: Math.round(usedCurrentDays * 100) / 100,
        available: Math.max(0, Math.round((accrued - usedCurrentDays) * 100) / 100)
      },
      next_year: {
        accrued: entitlement,
        used: Math.round(usedNextDays * 100) / 100,
        available: Math.max(0, Math.round((entitlement - usedNextDays) * 100) / 100)
      }
    }
  } catch (error) {
    console.error('Error calculating leave balance:', error)
    return {
      current_year: { accrued: 0, used: 0, available: 0 },
      next_year: { accrued: 0, used: 0, available: 0 }
    }
  }
}

/**
 * Ensures requested days do not exceed the annual pool (respects company annual_leave_rollover).
 * @param {object} p
 * @param {string[]} [p.excludeRequestIds] Approved request IDs to omit from "used" (e.g. when editing an approved row).
 */
export async function assertAnnualPoolAllowsBooking({
  companyId,
  employeeId,
  leaveType,
  balanceDeduction,
  daysRequested,
  leaveTypes,
  employee,
  excludeRequestIds = []
}) {
  const lt = String(leaveType || '').toUpperCase()
  const bd = normalizeBalanceDeductionInput(balanceDeduction, lt)
  const usesPool =
    (lt === 'ANNUAL' && bd === BALANCE_DEDUCTION.ANNUAL_BALANCE) ||
    (lt === 'UNPAID' && bd === BALANCE_DEDUCTION.ANNUAL_BALANCE)
  if (!usesPool) return

  const annualLeaveRollover = await getCompanySettingBoolean(companyId, 'annual_leave_rollover', true)
  const balance = await calculateLeaveBalance(employeeId, 'ANNUAL', companyId, {
    employee,
    leaveTypes,
    excludeRequestIds
  })
  const cy = balance.current_year.available
  const ny = balance.next_year.available
  const maxDays = annualLeaveRollover ? cy + ny : cy
  const dr = Number(daysRequested) || 0
  if (dr > maxDays + 1e-6) {
    throw new Error(
      `Annual leave balance insufficient: ${dr.toFixed(1)} day(s) requested but only ${maxDays.toFixed(1)} available${
        annualLeaveRollover ? '' : ' (this calendar year only; rollover is off in company settings)'
      }.`
    )
  }
}
