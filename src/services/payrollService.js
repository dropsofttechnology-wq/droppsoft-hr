import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'

const listAllDocuments = async (databaseId, collectionId, baseQueries = []) => {
  const limit = 100
  let offset = 0
  let all = []

  // Basic pagination loop
  while (true) {
    const res = await databases.listDocuments(databaseId, collectionId, [
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

export const getPayrollRunsForPeriod = async (companyId, period) => {
  if (isLocalDataSource()) {
    const res = await localApiFetch(
      `/api/payroll/runs?company_id=${encodeURIComponent(companyId)}&period=${encodeURIComponent(period)}`
    )
    if (!res.ok) throw new Error('Failed to load payroll runs')
    return await res.json()
  }
  return await listAllDocuments(DATABASE_ID, COLLECTIONS.PAYROLL_RUNS, [
    Query.equal('company_id', companyId),
    Query.equal('period', period)
  ])
}

export const deletePayrollRunsForPeriod = async (companyId, period) => {
  if (isLocalDataSource()) {
    const res = await localApiFetch(
      `/api/payroll/runs?company_id=${encodeURIComponent(companyId)}&period=${encodeURIComponent(period)}`,
      { method: 'DELETE' }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to delete payroll runs')
    }
    const data = await res.json()
    return data.deleted || 0
  }
  const existing = await getPayrollRunsForPeriod(companyId, period)
  for (const doc of existing) {
    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.PAYROLL_RUNS, doc.$id)
  }
  return existing.length
}

export const savePayrollRunsForPeriod = async ({ companyId, period, payrollLines, overwrite = true }) => {
  if (isLocalDataSource()) {
    if (overwrite) await deletePayrollRunsForPeriod(companyId, period)
    const created = []
    for (const line of payrollLines) {
      const res = await localApiFetch('/api/payroll/runs', {
        method: 'POST',
        body: JSON.stringify({
          company_id: companyId,
          employee_id: line.employee_id,
          period,
          basic_salary: line.basic_salary,
          allowances: line.allowances,
          gross_pay: line.gross_pay,
          shif_employee: line.shif_employee,
          shif_employer: line.shif_employer,
          nssf_employee: line.nssf_employee,
          nssf_employer: line.nssf_employer,
          ahl_employee: line.ahl_employee,
          ahl_employer: line.ahl_employer,
          taxable_pay: line.taxable_pay,
          paye: line.paye,
          other_deductions: line.other_deductions,
          net_pay: line.net_pay,
          overtime_hours: line.overtime_hours,
          overtime_pay: line.overtime_pay,
          holiday_pay: line.holiday_pay,
          absence_deduction: line.absence_deduction,
          housing_allowance: line.housing_allowance,
          standard_allowance: line.standard_allowance,
          total_earn: line.total_earn,
          shopping_amount: line.shopping_amount,
          advance_amount: line.advance_amount,
          pension_employee: line.pension_employee ?? line.pension
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to save payroll line')
      }
      created.push(await res.json())
    }
    return created
  }
  if (overwrite) {
    await deletePayrollRunsForPeriod(companyId, period)
  }

  const created = []
  for (const line of payrollLines) {
    const payload = {
      company_id: companyId,
      employee_id: line.employee_id,
      period,

      basic_salary: line.basic_salary,
      allowances: line.allowances,
      gross_pay: line.gross_pay,

      shif_employee: line.shif_employee,
      shif_employer: line.shif_employer,
      nssf_employee: line.nssf_employee,
      nssf_employer: line.nssf_employer,
      ahl_employee: line.ahl_employee,
      ahl_employer: line.ahl_employer,

      taxable_pay: line.taxable_pay,
      paye: line.paye,
      other_deductions: line.other_deductions,
      net_pay: line.net_pay,

      overtime_hours: line.overtime_hours,
      overtime_pay: line.overtime_pay,
      holiday_pay: line.holiday_pay,
      absence_deduction: line.absence_deduction,

      housing_allowance: line.housing_allowance,
      standard_allowance: line.standard_allowance,
      total_earn: line.total_earn,
      shopping_amount: line.shopping_amount,
      advance_amount: line.advance_amount,
      pension_employee: line.pension_employee ?? line.pension,

      calculated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }

    const doc = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.PAYROLL_RUNS,
      'unique()',
      payload
    )
    created.push(doc)
  }

  return created
}

