import { Query } from 'appwrite'
import { account, databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'

function assertDatabase() {
  if (!DATABASE_ID) {
    throw new Error('Appwrite database is not configured (set VITE_APPWRITE_DATABASE_ID).')
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

function parseAttachmentIds(body) {
  const raw = body?.attachment_ids
  if (!raw) return null
  if (!Array.isArray(raw)) return '[]'
  const ids = raw.map((x) => String(x).trim()).filter(Boolean)
  return JSON.stringify(ids.slice(0, 50))
}

function mapOperationalExpenseDoc(doc) {
  let attachment_ids = []
  try {
    const raw = doc.attachment_ids_json
    const p = raw ? JSON.parse(String(raw)) : []
    attachment_ids = Array.isArray(p) ? p : []
  } catch {
    attachment_ids = []
  }
  return {
    id: doc.$id,
    $id: doc.$id,
    company_id: doc.company_id,
    category_id: doc.category_id,
    supplier_id: doc.supplier_id || '',
    description: doc.description,
    amount: doc.amount != null ? Number(doc.amount) : 0,
    currency: doc.currency || '',
    tax_amount: doc.tax_amount != null && doc.tax_amount !== '' ? Number(doc.tax_amount) : null,
    incurred_on: doc.incurred_on,
    paid_on: doc.paid_on || '',
    payment_method: doc.payment_method || '',
    reference: doc.reference || '',
    status: doc.status || 'draft',
    linked_employee_id: doc.linked_employee_id || '',
    attachment_ids,
    void_reason: doc.void_reason || '',
    notes: doc.notes || '',
    rejected_reason: doc.rejected_reason || '',
    created_by: doc.created_by || '',
    approved_by: doc.approved_by || '',
    approved_at: doc.approved_at || '',
    created_at: doc.created_at,
    updated_at: doc.updated_at
  }
}

function mapCategoryDoc(doc) {
  const raw = doc.is_active
  const n = Number(raw)
  const active = !(
    raw === false ||
    raw === '0' ||
    String(raw).toLowerCase() === 'false' ||
    (Number.isFinite(n) && n === 0)
  )
  return {
    id: doc.$id,
    $id: doc.$id,
    company_id: doc.company_id,
    name: doc.name,
    code: doc.code || '',
    parent_id: doc.parent_id || '',
    is_active: active,
    created_at: doc.created_at,
    updated_at: doc.updated_at
  }
}

function mapSupplierDoc(doc) {
  return {
    id: doc.$id,
    $id: doc.$id,
    company_id: doc.company_id,
    name: doc.name,
    tax_id: doc.tax_id || '',
    phone: doc.phone || '',
    email: doc.email || '',
    notes: doc.notes || '',
    created_at: doc.created_at,
    updated_at: doc.updated_at
  }
}

async function currentUser() {
  return account.get()
}

async function assertNotSelfApprover(expenseDoc) {
  const user = await currentUser()
  const role = String(user.prefs?.role || '').toLowerCase()
  if (role === 'super_admin') return
  const creator = String(expenseDoc.created_by || '')
  if (creator && creator === String(user.$id)) {
    throw new Error('You cannot approve an expense you created (maker–checker).')
  }
}

async function countExpensesByStatus(companyId, status) {
  const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.OPERATIONAL_EXPENSES, [
    Query.equal('company_id', companyId),
    Query.equal('status', status),
    Query.limit(1)
  ])
  return res.total
}

export async function getExpenseCategories(companyId) {
  if (isLocalDataSource()) {
    const res = await localApiFetch(`/api/school/expense-categories${qs({ company_id: companyId })}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to load categories')
    }
    return res.json()
  }
  assertDatabase()
  const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.EXPENSE_CATEGORIES, [
    Query.equal('company_id', companyId),
    Query.limit(5000),
    Query.orderAsc('name')
  ])
  return response.documents.map(mapCategoryDoc)
}

export async function createExpenseCategory(companyId, payload) {
  if (isLocalDataSource()) {
    const res = await localApiFetch('/api/school/expense-categories', {
      method: 'POST',
      body: JSON.stringify({ ...payload, company_id: companyId })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to create category')
    }
    return res.json()
  }
  assertDatabase()
  const now = new Date().toISOString()
  const doc = await databases.createDocument(DATABASE_ID, COLLECTIONS.EXPENSE_CATEGORIES, 'unique()', {
    company_id: companyId,
    name: String(payload.name || '').trim(),
    code: payload.code != null ? String(payload.code).trim() : '',
    parent_id: payload.parent_id != null ? String(payload.parent_id).trim() : '',
    is_active: payload.is_active === false ? 0 : 1,
    created_at: now,
    updated_at: now
  })
  return mapCategoryDoc(doc)
}

export async function updateExpenseCategory(companyId, id, payload) {
  if (isLocalDataSource()) {
    const res = await localApiFetch(`/api/school/expense-categories/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...payload, company_id: companyId })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to update category')
    }
    return res.json()
  }
  assertDatabase()
  const now = new Date().toISOString()
  const data = { updated_at: now }
  if (payload.name != null) data.name = String(payload.name).trim()
  if (payload.code !== undefined) data.code = String(payload.code || '').trim()
  if (payload.parent_id !== undefined) data.parent_id = String(payload.parent_id || '').trim()
  if (payload.is_active !== undefined) data.is_active = payload.is_active === false ? 0 : 1
  const doc = await databases.updateDocument(DATABASE_ID, COLLECTIONS.EXPENSE_CATEGORIES, id, data)
  return mapCategoryDoc(doc)
}

export async function deleteExpenseCategory(companyId, id) {
  if (isLocalDataSource()) {
    const res = await localApiFetch(
      `/api/school/expense-categories/${encodeURIComponent(id)}${qs({ company_id: companyId })}`,
      { method: 'DELETE' }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to delete category')
    }
    return
  }
  assertDatabase()
  const used = await databases.listDocuments(DATABASE_ID, COLLECTIONS.OPERATIONAL_EXPENSES, [
    Query.equal('company_id', companyId),
    Query.equal('category_id', id),
    Query.limit(1)
  ])
  if (used.total > 0) {
    throw new Error('Category is used by expenses; reassign or delete those expenses first.')
  }
  const child = await databases.listDocuments(DATABASE_ID, COLLECTIONS.EXPENSE_CATEGORIES, [
    Query.equal('company_id', companyId),
    Query.equal('parent_id', id),
    Query.limit(1)
  ])
  if (child.total > 0) {
    throw new Error('Category has child categories; remove or reassign them first.')
  }
  await databases.deleteDocument(DATABASE_ID, COLLECTIONS.EXPENSE_CATEGORIES, id)
}

export async function getExpenseSuppliers(companyId) {
  if (isLocalDataSource()) {
    const res = await localApiFetch(`/api/school/expense-suppliers${qs({ company_id: companyId })}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to load suppliers')
    }
    return res.json()
  }
  assertDatabase()
  const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.EXPENSE_SUPPLIERS, [
    Query.equal('company_id', companyId),
    Query.limit(5000),
    Query.orderAsc('name')
  ])
  return response.documents.map(mapSupplierDoc)
}

export async function createExpenseSupplier(companyId, payload) {
  if (isLocalDataSource()) {
    const res = await localApiFetch('/api/school/expense-suppliers', {
      method: 'POST',
      body: JSON.stringify({ ...payload, company_id: companyId })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to create supplier')
    }
    return res.json()
  }
  assertDatabase()
  const now = new Date().toISOString()
  const doc = await databases.createDocument(DATABASE_ID, COLLECTIONS.EXPENSE_SUPPLIERS, 'unique()', {
    company_id: companyId,
    name: String(payload.name || '').trim(),
    tax_id: payload.tax_id != null ? String(payload.tax_id).trim() : '',
    phone: payload.phone != null ? String(payload.phone).trim() : '',
    email: payload.email != null ? String(payload.email).trim() : '',
    notes: payload.notes != null ? String(payload.notes).trim() : '',
    created_at: now,
    updated_at: now
  })
  return mapSupplierDoc(doc)
}

export async function updateExpenseSupplier(companyId, id, payload) {
  if (isLocalDataSource()) {
    const res = await localApiFetch(`/api/school/expense-suppliers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...payload, company_id: companyId })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to update supplier')
    }
    return res.json()
  }
  assertDatabase()
  const now = new Date().toISOString()
  const data = { updated_at: now }
  if (payload.name != null) data.name = String(payload.name).trim()
  if (payload.tax_id !== undefined) data.tax_id = String(payload.tax_id || '').trim()
  if (payload.phone !== undefined) data.phone = String(payload.phone || '').trim()
  if (payload.email !== undefined) data.email = String(payload.email || '').trim()
  if (payload.notes !== undefined) data.notes = String(payload.notes || '').trim()
  const doc = await databases.updateDocument(DATABASE_ID, COLLECTIONS.EXPENSE_SUPPLIERS, id, data)
  return mapSupplierDoc(doc)
}

export async function deleteExpenseSupplier(companyId, id) {
  if (isLocalDataSource()) {
    const res = await localApiFetch(
      `/api/school/expense-suppliers/${encodeURIComponent(id)}${qs({ company_id: companyId })}`,
      { method: 'DELETE' }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to delete supplier')
    }
    return
  }
  assertDatabase()
  const used = await databases.listDocuments(DATABASE_ID, COLLECTIONS.OPERATIONAL_EXPENSES, [
    Query.equal('company_id', companyId),
    Query.equal('supplier_id', id),
    Query.limit(1)
  ])
  if (used.total > 0) {
    throw new Error('Supplier is referenced by expenses; remove supplier from those first.')
  }
  await databases.deleteDocument(DATABASE_ID, COLLECTIONS.EXPENSE_SUPPLIERS, id)
}

export async function getOperationalExpenses(companyId, filters = {}) {
  if (isLocalDataSource()) {
    const res = await localApiFetch(
      `/api/school/operational-expenses${qs({
        company_id: companyId,
        status: filters.status,
        from: filters.from,
        to: filters.to,
        q: filters.q,
        limit: filters.limit,
        offset: filters.offset
      })}`
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to load expenses')
    }
    const data = await res.json()
    if (Array.isArray(data)) {
      const items = data
      return { items, total: items.length, limit: items.length, offset: 0 }
    }
    const items = Array.isArray(data.items) ? data.items : []
    return {
      items,
      total: Number(data.total) || 0,
      limit: data.limit != null ? Number(data.limit) : undefined,
      offset: data.offset != null ? Number(data.offset) : 0
    }
  }
  assertDatabase()
  const queries = [Query.equal('company_id', companyId), Query.orderDesc('incurred_on')]
  if (filters.status) queries.push(Query.equal('status', filters.status))
  const from = filters.from ? String(filters.from).trim() : ''
  const to = filters.to ? String(filters.to).trim() : ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) queries.push(Query.greaterThanEqual('incurred_on', from))
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) queries.push(Query.lessThanEqual('incurred_on', to))
  const qSearch = filters.q != null ? String(filters.q).trim() : ''
  if (qSearch) {
    queries.push(
      Query.or([
        Query.contains('description', qSearch),
        Query.contains('reference', qSearch),
        Query.contains('notes', qSearch),
        Query.contains('status', qSearch),
        Query.equal('$id', qSearch)
      ])
    )
  }
  const hasLimit = filters.limit !== undefined && filters.limit !== null && filters.limit !== ''
  if (hasLimit) {
    const limit = Math.min(Math.max(parseInt(String(filters.limit), 10) || 25, 1), 200)
    const offset = Math.min(Math.max(parseInt(String(filters.offset ?? 0), 10) || 0, 0), 500000)
    queries.push(Query.limit(limit))
    queries.push(Query.offset(offset))
  } else {
    queries.push(Query.limit(5000))
  }
  const res = await databases.listDocuments(DATABASE_ID, COLLECTIONS.OPERATIONAL_EXPENSES, queries)
  const items = res.documents.map(mapOperationalExpenseDoc)
  if (!hasLimit) {
    return { items, total: items.length, limit: items.length, offset: 0 }
  }
  return {
    items,
    total: res.total,
    limit: parseInt(String(filters.limit), 10) || 25,
    offset: parseInt(String(filters.offset ?? 0), 10) || 0
  }
}

export async function getOperationalExpense(id, companyId) {
  if (isLocalDataSource()) {
    const res = await localApiFetch(
      `/api/school/operational-expenses/${encodeURIComponent(id)}${qs({ company_id: companyId })}`
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to load expense')
    }
    return res.json()
  }
  assertDatabase()
  const doc = await databases.getDocument(DATABASE_ID, COLLECTIONS.OPERATIONAL_EXPENSES, id)
  if (String(doc.company_id) !== String(companyId)) {
    throw new Error('Expense not found')
  }
  return mapOperationalExpenseDoc(doc)
}

export async function getOperationalExpensesSummary(companyId, month) {
  if (isLocalDataSource()) {
    const params = { company_id: companyId }
    if (month) params.month = month
    const res = await localApiFetch(`/api/school/operational-expenses/summary${qs(params)}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to load expense summary')
    }
    return res.json()
  }
  assertDatabase()
  let m = String(month || '').trim().slice(0, 7)
  if (!m || !/^\d{4}-\d{2}$/.test(m)) {
    const d = new Date()
    m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const draft_count = await countExpensesByStatus(companyId, 'draft')
  const approved_count = await countExpensesByStatus(companyId, 'approved')
  const paidResp = await databases.listDocuments(DATABASE_ID, COLLECTIONS.OPERATIONAL_EXPENSES, [
    Query.equal('company_id', companyId),
    Query.equal('status', 'paid'),
    Query.limit(5000)
  ])
  let paid_month_total = 0
  for (const doc of paidResp.documents) {
    const po = String(doc.paid_on || '').slice(0, 7)
    if (po === m) paid_month_total += Number(doc.amount) || 0
  }
  return {
    company_id: companyId,
    month: m,
    draft_count,
    approved_count,
    paid_month_total: Math.round(paid_month_total * 100) / 100
  }
}

export async function createOperationalExpense(companyId, payload) {
  if (isLocalDataSource()) {
    const res = await localApiFetch('/api/school/operational-expenses', {
      method: 'POST',
      body: JSON.stringify({ ...payload, company_id: companyId })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to create expense')
    }
    return res.json()
  }
  assertDatabase()
  const user = await currentUser()
  const now = new Date().toISOString()
  const amount = Number(payload.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('amount must be a positive number')
  }
  const taxRaw = payload.tax_amount
  const taxAmount =
    taxRaw != null && taxRaw !== '' && Number.isFinite(Number(taxRaw)) ? Number(taxRaw) : null
  const att = parseAttachmentIds(payload)
  const createPayload = {
    company_id: companyId,
    category_id: String(payload.category_id || '').trim(),
    supplier_id: String(payload.supplier_id || '').trim(),
    description: String(payload.description || '').trim(),
    amount: Math.round(amount * 100) / 100,
    currency: String(payload.currency || '').trim(),
    incurred_on: String(payload.incurred_on || '').trim().slice(0, 10),
    payment_method: String(payload.payment_method || '').trim(),
    reference: String(payload.reference || '').trim(),
    status: 'draft',
    linked_employee_id: String(payload.linked_employee_id || '').trim(),
    attachment_ids_json: att || '[]',
    void_reason: '',
    notes: String(payload.notes || '').trim(),
    rejected_reason: '',
    created_by: user.$id,
    created_at: now,
    updated_at: now
  }
  if (taxAmount != null) createPayload.tax_amount = taxAmount
  const doc = await databases.createDocument(
    DATABASE_ID,
    COLLECTIONS.OPERATIONAL_EXPENSES,
    'unique()',
    createPayload
  )
  return mapOperationalExpenseDoc(doc)
}

export async function updateOperationalExpense(companyId, id, payload) {
  if (isLocalDataSource()) {
    const res = await localApiFetch(`/api/school/operational-expenses/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...payload, company_id: companyId })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to update expense')
    }
    return res.json()
  }
  assertDatabase()
  const existing = await databases.getDocument(DATABASE_ID, COLLECTIONS.OPERATIONAL_EXPENSES, id)
  if (String(existing.company_id) !== String(companyId)) throw new Error('Expense not found')
  if (String(existing.status) !== 'draft') {
    throw new Error('Only draft expenses can be edited')
  }
  const now = new Date().toISOString()
  const data = { updated_at: now }
  if (payload.category_id != null) data.category_id = String(payload.category_id).trim()
  if (payload.supplier_id !== undefined) data.supplier_id = String(payload.supplier_id || '').trim()
  if (payload.description != null) data.description = String(payload.description).trim()
  if (payload.amount != null) {
    const amount = Number(payload.amount)
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('amount must be a positive number')
    data.amount = Math.round(amount * 100) / 100
  }
  if (payload.currency != null) data.currency = String(payload.currency).trim()
  if (payload.tax_amount !== undefined) {
    const taxRaw = payload.tax_amount
    data.tax_amount =
      taxRaw != null && taxRaw !== '' && Number.isFinite(Number(taxRaw)) ? Number(taxRaw) : null
  }
  if (payload.incurred_on != null) data.incurred_on = String(payload.incurred_on).trim().slice(0, 10)
  if (payload.payment_method != null) data.payment_method = String(payload.payment_method || '').trim()
  if (payload.reference != null) data.reference = String(payload.reference || '').trim()
  if (payload.linked_employee_id !== undefined) {
    data.linked_employee_id = String(payload.linked_employee_id || '').trim()
  }
  if (payload.notes != null) data.notes = String(payload.notes || '').trim()
  if (payload.attachment_ids !== undefined) {
    data.attachment_ids_json = parseAttachmentIds(payload) || '[]'
  }
  const doc = await databases.updateDocument(DATABASE_ID, COLLECTIONS.OPERATIONAL_EXPENSES, id, data)
  return mapOperationalExpenseDoc(doc)
}

export async function deleteOperationalExpense(companyId, id) {
  if (isLocalDataSource()) {
    const res = await localApiFetch(
      `/api/school/operational-expenses/${encodeURIComponent(id)}${qs({ company_id: companyId })}`,
      { method: 'DELETE' }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to delete expense')
    }
    return
  }
  assertDatabase()
  const existing = await databases.getDocument(DATABASE_ID, COLLECTIONS.OPERATIONAL_EXPENSES, id)
  if (String(existing.company_id) !== String(companyId)) throw new Error('Expense not found')
  if (String(existing.status) !== 'draft') {
    throw new Error('Only draft expenses can be deleted')
  }
  await databases.deleteDocument(DATABASE_ID, COLLECTIONS.OPERATIONAL_EXPENSES, id)
}

export async function approveOperationalExpense(companyId, id) {
  if (isLocalDataSource()) {
    const res = await localApiFetch(`/api/school/operational-expenses/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ company_id: companyId })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to approve')
    }
    return res.json()
  }
  assertDatabase()
  const existing = await databases.getDocument(DATABASE_ID, COLLECTIONS.OPERATIONAL_EXPENSES, id)
  if (String(existing.company_id) !== String(companyId)) throw new Error('Expense not found')
  if (String(existing.status) !== 'draft') {
    throw new Error('Only draft expenses can be approved')
  }
  await assertNotSelfApprover(existing)
  const user = await currentUser()
  const now = new Date().toISOString()
  const doc = await databases.updateDocument(DATABASE_ID, COLLECTIONS.OPERATIONAL_EXPENSES, id, {
    status: 'approved',
    approved_by: user.$id,
    approved_at: now,
    rejected_reason: '',
    updated_at: now
  })
  return mapOperationalExpenseDoc(doc)
}

export async function rejectOperationalExpense(companyId, id, rejectedReason) {
  if (isLocalDataSource()) {
    const res = await localApiFetch(`/api/school/operational-expenses/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejected_reason: rejectedReason, company_id: companyId })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to reject')
    }
    return res.json()
  }
  assertDatabase()
  const existing = await databases.getDocument(DATABASE_ID, COLLECTIONS.OPERATIONAL_EXPENSES, id)
  if (String(existing.company_id) !== String(companyId)) throw new Error('Expense not found')
  if (String(existing.status) !== 'draft') {
    throw new Error('Only draft expenses can be rejected')
  }
  const reason = String(rejectedReason || '').trim()
  if (!reason) throw new Error('rejected_reason is required')
  const user = await currentUser()
  const now = new Date().toISOString()
  const doc = await databases.updateDocument(DATABASE_ID, COLLECTIONS.OPERATIONAL_EXPENSES, id, {
    status: 'rejected',
    rejected_reason: reason,
    approved_by: user.$id,
    approved_at: now,
    updated_at: now
  })
  return mapOperationalExpenseDoc(doc)
}

export async function markOperationalExpensePaid(companyId, id, paidOn, paymentMethod) {
  if (isLocalDataSource()) {
    const res = await localApiFetch(`/api/school/operational-expenses/${encodeURIComponent(id)}/mark-paid`, {
      method: 'POST',
      body: JSON.stringify({
        paid_on: paidOn,
        payment_method: paymentMethod || undefined,
        company_id: companyId
      })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to mark paid')
    }
    return res.json()
  }
  assertDatabase()
  const existing = await databases.getDocument(DATABASE_ID, COLLECTIONS.OPERATIONAL_EXPENSES, id)
  if (String(existing.company_id) !== String(companyId)) throw new Error('Expense not found')
  if (String(existing.status) !== 'approved') {
    throw new Error('Only approved expenses can be marked paid')
  }
  const po = String(paidOn || '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(po)) {
    throw new Error('paid_on must be YYYY-MM-DD')
  }
  const now = new Date().toISOString()
  const pm =
    paymentMethod != null && paymentMethod !== ''
      ? String(paymentMethod).trim()
      : String(existing.payment_method || '').trim()
  const doc = await databases.updateDocument(DATABASE_ID, COLLECTIONS.OPERATIONAL_EXPENSES, id, {
    status: 'paid',
    paid_on: po,
    payment_method: pm,
    updated_at: now
  })
  return mapOperationalExpenseDoc(doc)
}

export async function voidOperationalExpense(companyId, id, voidReason) {
  if (isLocalDataSource()) {
    const res = await localApiFetch(`/api/school/operational-expenses/${encodeURIComponent(id)}/void`, {
      method: 'POST',
      body: JSON.stringify({ void_reason: voidReason, company_id: companyId })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to void')
    }
    return res.json()
  }
  assertDatabase()
  const existing = await databases.getDocument(DATABASE_ID, COLLECTIONS.OPERATIONAL_EXPENSES, id)
  if (String(existing.company_id) !== String(companyId)) throw new Error('Expense not found')
  const st = String(existing.status)
  if (st !== 'approved' && st !== 'paid') {
    throw new Error('Only approved or paid expenses can be voided')
  }
  const reason = String(voidReason || '').trim()
  if (!reason) throw new Error('void_reason is required')
  const now = new Date().toISOString()
  const doc = await databases.updateDocument(DATABASE_ID, COLLECTIONS.OPERATIONAL_EXPENSES, id, {
    status: 'void',
    void_reason: reason,
    updated_at: now
  })
  return mapOperationalExpenseDoc(doc)
}
