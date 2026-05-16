import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'

const listAllDocuments = async (collectionId, baseQueries = []) => {
  const limit = 100
  let offset = 0
  let all = []

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const res = await databases.listDocuments(DATABASE_ID, collectionId, [
      ...baseQueries.filter(Boolean),
      Query.limit(limit),
      Query.offset(offset)
    ])
    all = all.concat(res.documents)
    if (res.documents.length < limit) break
    offset += limit
  }

  return all
}

export const getEmployeeDeductionsForPeriod = async (companyId, period) => {
  if (!companyId || !period) return []
  if (isLocalDataSource()) {
    const res = await localApiFetch(
      `/api/employee-deductions?company_id=${encodeURIComponent(companyId)}&period=${encodeURIComponent(period)}`
    )
    if (!res.ok) return []
    const rows = await res.json()
    return rows.map((r) => ({ ...r, $id: r.id || r.$id }))
  }
  return await listAllDocuments(COLLECTIONS.EMPLOYEE_DEDUCTIONS, [
    Query.equal('company_id', companyId),
    Query.equal('period', period)
  ])
}

export const upsertEmployeeDeduction = async ({
  companyId,
  employeeId,
  period,
  absentDays = 0,
  advanceAmount = 0,
  shoppingAmount = 0,
  notes = ''
}) => {
  if (!companyId || !employeeId || !period) {
    throw new Error('Missing required fields: companyId, employeeId, period')
  }

  const now = new Date().toISOString()
  const payload = {
    company_id: companyId,
    employee_id: employeeId,
    period,
    absent_days: Math.max(0, Math.min(30, parseInt(absentDays, 10) || 0)),
    advance_amount: Math.max(0, Number(advanceAmount) || 0),
    shopping_amount: Math.max(0, Number(shoppingAmount) || 0),
    notes: notes || '',
    updated_at: now
  }

  if (isLocalDataSource()) {
    const res = await localApiFetch('/api/employee-deductions', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to save employee deduction')
    }
    return await res.json()
  }

  const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.EMPLOYEE_DEDUCTIONS, [
    Query.equal('company_id', companyId),
    Query.equal('employee_id', employeeId),
    Query.equal('period', period),
    Query.limit(1)
  ])

  if (existing.documents.length) {
    const doc = existing.documents[0]
    return await databases.updateDocument(DATABASE_ID, COLLECTIONS.EMPLOYEE_DEDUCTIONS, doc.$id, payload)
  }

  return await databases.createDocument(DATABASE_ID, COLLECTIONS.EMPLOYEE_DEDUCTIONS, 'unique()', {
    ...payload,
    created_at: now
  })
}

export const bulkUpsertEmployeeDeductions = async ({
  companyId,
  period,
  items
}) => {
  if (!companyId || !period) throw new Error('Missing required fields: companyId, period')
  if (!Array.isArray(items) || !items.length) return { updated: 0 }

  // Sequential upserts to avoid rate limits / 429s
  let updated = 0
  for (const it of items) {
    // eslint-disable-next-line no-await-in-loop
    await upsertEmployeeDeduction({
      companyId,
      employeeId: it.employeeId,
      period,
      absentDays: it.absentDays,
      advanceAmount: it.advanceAmount,
      shoppingAmount: it.shoppingAmount,
      notes: it.notes
    })
    updated++
  }

  return { updated }
}

/**
 * Merge with existing row for the same employee/period.
 * Pass `undefined` for a field to keep the existing database value.
 */
export const mergeUpsertEmployeeDeduction = async ({
  companyId,
  employeeId,
  period,
  absentDays,
  advanceAmount,
  shoppingAmount,
  notes
}) => {
  const existingRows = await getEmployeeDeductionsForPeriod(companyId, period)
  const ex = existingRows.find((r) => (r.employee_id || r.employeeId) === employeeId)
  return upsertEmployeeDeduction({
    companyId,
    employeeId,
    period,
    absentDays: absentDays !== undefined ? absentDays : ex?.absent_days ?? 0,
    advanceAmount: advanceAmount !== undefined ? advanceAmount : ex?.advance_amount ?? 0,
    shoppingAmount: shoppingAmount !== undefined ? shoppingAmount : ex?.shopping_amount ?? 0,
    notes: notes !== undefined ? notes : ex?.notes ?? ''
  })
}

