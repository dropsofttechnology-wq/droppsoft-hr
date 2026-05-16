import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'

function normalizeRow(row) {
  if (!row) return row
  return { ...row, $id: row.$id || row.id }
}

export async function getSalaryAdvanceRequests(companyId, filters = {}) {
  if (!isLocalDataSource()) {
    throw new Error('Salary advance requests require local data source')
  }
  const params = new URLSearchParams()
  params.set('company_id', companyId)
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters.employee_id) params.set('employee_id', filters.employee_id)
  const res = await localApiFetch(`/api/salary-advance/requests?${params.toString()}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load salary advance requests')
  }
  const rows = await res.json()
  return rows.map(normalizeRow)
}

export async function createSalaryAdvanceRequest(data) {
  if (!isLocalDataSource()) {
    throw new Error('Salary advance requests require local data source')
  }
  const res = await localApiFetch('/api/salary-advance/requests', {
    method: 'POST',
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to submit request')
  }
  const row = await res.json()
  return normalizeRow(row)
}

export async function approveSalaryAdvanceRequest(requestId, decision = 'approved', options = {}) {
  if (!isLocalDataSource()) {
    throw new Error('Salary advance requests require local data source')
  }
  const body = { decision, ...options }
  const res = await localApiFetch(`/api/salary-advance/requests/${encodeURIComponent(requestId)}/approve`, {
    method: 'POST',
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to update request')
  }
  const row = await res.json()
  return normalizeRow(row)
}

/** Deactivate approved advance when the role has salary_advance_deactivate permission. */
export async function deactivateSalaryAdvanceRequest(requestId) {
  if (!isLocalDataSource()) {
    throw new Error('Salary advance requests require local data source')
  }
  const res = await localApiFetch(
    `/api/salary-advance/requests/${encodeURIComponent(requestId)}/deactivate`,
    { method: 'POST' }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to deactivate request')
  }
  const row = await res.json()
  return normalizeRow(row)
}

export async function deleteSalaryAdvanceRequest(requestId) {
  if (!isLocalDataSource()) {
    throw new Error('Salary advance requests require local data source')
  }
  const res = await localApiFetch(`/api/salary-advance/requests/${encodeURIComponent(requestId)}`, {
    method: 'DELETE'
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to delete request')
  }
}

/** Update pending request fields, or edit approved advance (reverses & reposts payroll when amount/instalments/months change). */
export async function updateSalaryAdvanceRequest(requestId, data = {}) {
  if (!isLocalDataSource()) {
    throw new Error('Salary advance requests require local data source')
  }
  const res = await localApiFetch(`/api/salary-advance/requests/${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to update request')
  }
  const row = await res.json()
  return normalizeRow(row)
}
