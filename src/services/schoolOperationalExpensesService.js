import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'

function assertLocal() {
  if (!isLocalDataSource()) {
    throw new Error('Operational expenses are available in desktop / local API mode only.')
  }
}

function qs(params) {
  const u = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') u.set(k, String(v))
  })
  const s = u.toString()
  return s ? `?${s}` : ''
}

export async function getExpenseCategories(companyId) {
  assertLocal()
  const res = await localApiFetch(`/api/school/expense-categories${qs({ company_id: companyId })}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load categories')
  }
  return res.json()
}

export async function createExpenseCategory(companyId, payload) {
  assertLocal()
  const res = await localApiFetch('/api/school/expense-categories', {
    method: 'POST',
    body: JSON.stringify({ company_id: companyId, ...payload })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create category')
  }
  return res.json()
}

export async function updateExpenseCategory(id, payload) {
  assertLocal()
  const res = await localApiFetch(`/api/school/expense-categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to update category')
  }
  return res.json()
}

export async function deleteExpenseCategory(id) {
  assertLocal()
  const res = await localApiFetch(`/api/school/expense-categories/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to delete category')
  }
}

export async function getExpenseSuppliers(companyId) {
  assertLocal()
  const res = await localApiFetch(`/api/school/expense-suppliers${qs({ company_id: companyId })}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load suppliers')
  }
  return res.json()
}

export async function createExpenseSupplier(companyId, payload) {
  assertLocal()
  const res = await localApiFetch('/api/school/expense-suppliers', {
    method: 'POST',
    body: JSON.stringify({ company_id: companyId, ...payload })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create supplier')
  }
  return res.json()
}

export async function updateExpenseSupplier(id, payload) {
  assertLocal()
  const res = await localApiFetch(`/api/school/expense-suppliers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to update supplier')
  }
  return res.json()
}

export async function deleteExpenseSupplier(id) {
  assertLocal()
  const res = await localApiFetch(`/api/school/expense-suppliers/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to delete supplier')
  }
}

export async function getOperationalExpenses(companyId, filters = {}) {
  assertLocal()
  const res = await localApiFetch(
    `/api/school/operational-expenses${qs({
      company_id: companyId,
      status: filters.status,
      from: filters.from,
      to: filters.to
    })}`
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load expenses')
  }
  return res.json()
}

/**
 * @param {string} companyId
 * @param {string} [month] YYYY-MM for paid total (defaults server-side to current month)
 */
export async function getOperationalExpensesSummary(companyId, month) {
  assertLocal()
  const params = { company_id: companyId }
  if (month) params.month = month
  const res = await localApiFetch(`/api/school/operational-expenses/summary${qs(params)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load expense summary')
  }
  return res.json()
}

export async function createOperationalExpense(companyId, payload) {
  assertLocal()
  const res = await localApiFetch('/api/school/operational-expenses', {
    method: 'POST',
    body: JSON.stringify({ company_id: companyId, ...payload })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create expense')
  }
  return res.json()
}

export async function updateOperationalExpense(id, payload) {
  assertLocal()
  const res = await localApiFetch(`/api/school/operational-expenses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to update expense')
  }
  return res.json()
}

export async function deleteOperationalExpense(id) {
  assertLocal()
  const res = await localApiFetch(`/api/school/operational-expenses/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to delete expense')
  }
}

export async function approveOperationalExpense(id) {
  assertLocal()
  const res = await localApiFetch(`/api/school/operational-expenses/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({})
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to approve')
  }
  return res.json()
}

export async function rejectOperationalExpense(id, rejectedReason) {
  assertLocal()
  const res = await localApiFetch(`/api/school/operational-expenses/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ rejected_reason: rejectedReason })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to reject')
  }
  return res.json()
}

export async function markOperationalExpensePaid(id, paidOn, paymentMethod) {
  assertLocal()
  const res = await localApiFetch(`/api/school/operational-expenses/${encodeURIComponent(id)}/mark-paid`, {
    method: 'POST',
    body: JSON.stringify({ paid_on: paidOn, payment_method: paymentMethod || undefined })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to mark paid')
  }
  return res.json()
}

export async function voidOperationalExpense(id, voidReason) {
  assertLocal()
  const res = await localApiFetch(`/api/school/operational-expenses/${encodeURIComponent(id)}/void`, {
    method: 'POST',
    body: JSON.stringify({ void_reason: voidReason })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to void')
  }
  return res.json()
}
