import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'

function assertLocal() {
  if (!isLocalDataSource()) {
    throw new Error('Fee ledger is available in desktop / local API mode only.')
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

export async function getAcademicYearsReport(companyId) {
  assertLocal()
  const res = await localApiFetch(
    `/api/school/fees/reports/academic-years${qs({ company_id: companyId })}`
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load academic year reports')
  }
  return res.json()
}

export async function getAcademicTermsReport(companyId, academicYearId) {
  assertLocal()
  const res = await localApiFetch(
    `/api/school/fees/reports/academic-terms${qs({
      company_id: companyId,
      academic_year_id: academicYearId || undefined
    })}`
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load academic term reports')
  }
  return res.json()
}

export async function getFeesSummary(companyId, month) {
  assertLocal()
  const params = { company_id: companyId }
  if (month) params.month = month
  const res = await localApiFetch(`/api/school/fees/summary${qs(params)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load fee summary')
  }
  return res.json()
}

export async function getAcademicYears(companyId) {
  assertLocal()
  const res = await localApiFetch(`/api/school/fees/academic-years${qs({ company_id: companyId })}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load academic years')
  }
  return res.json()
}

export async function createAcademicYear(companyId, payload) {
  assertLocal()
  const res = await localApiFetch('/api/school/fees/academic-years', {
    method: 'POST',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create academic year')
  }
  return res.json()
}

export async function updateAcademicYear(companyId, id, payload) {
  assertLocal()
  const res = await localApiFetch(`/api/school/fees/academic-years/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to update academic year')
  }
  return res.json()
}

export async function deleteAcademicYear(companyId, id) {
  assertLocal()
  const res = await localApiFetch(
    `/api/school/fees/academic-years/${encodeURIComponent(id)}${qs({ company_id: companyId })}`,
    { method: 'DELETE' }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to delete academic year')
  }
}

export async function getAcademicTerms(companyId, academicYearId) {
  assertLocal()
  const res = await localApiFetch(
    `/api/school/fees/academic-terms${qs({ company_id: companyId, academic_year_id: academicYearId || undefined })}`
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load academic terms')
  }
  return res.json()
}

export async function createAcademicTerm(companyId, payload) {
  assertLocal()
  const res = await localApiFetch('/api/school/fees/academic-terms', {
    method: 'POST',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create term')
  }
  return res.json()
}

export async function updateAcademicTerm(companyId, id, payload) {
  assertLocal()
  const res = await localApiFetch(`/api/school/fees/academic-terms/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to update term')
  }
  return res.json()
}

export async function deleteAcademicTerm(companyId, id) {
  assertLocal()
  const res = await localApiFetch(
    `/api/school/fees/academic-terms/${encodeURIComponent(id)}${qs({ company_id: companyId })}`,
    { method: 'DELETE' }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to delete term')
  }
}

export async function getStudents(companyId) {
  assertLocal()
  const res = await localApiFetch(`/api/school/fees/students${qs({ company_id: companyId })}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load students')
  }
  return res.json()
}

export async function createStudent(companyId, payload) {
  assertLocal()
  const res = await localApiFetch('/api/school/fees/students', {
    method: 'POST',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create student')
  }
  return res.json()
}

export async function updateStudent(companyId, id, payload) {
  assertLocal()
  const res = await localApiFetch(`/api/school/fees/students/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to update student')
  }
  return res.json()
}

export async function deleteStudent(companyId, id) {
  assertLocal()
  const res = await localApiFetch(
    `/api/school/fees/students/${encodeURIComponent(id)}${qs({ company_id: companyId })}`,
    { method: 'DELETE' }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to delete student')
  }
}

/**
 * @param {string} companyId
 * @param {{ studentId?: string, academicYearId?: string, termId?: string }} [filters]
 */
export async function getFeeCharges(companyId, filters) {
  assertLocal()
  const f = filters && typeof filters === 'object' ? filters : { studentId: filters }
  const res = await localApiFetch(
    `/api/school/fees/charges${qs({
      company_id: companyId,
      student_id: f?.studentId || undefined,
      academic_year_id: f?.academicYearId || undefined,
      term_id: f?.termId || undefined
    })}`
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load charges')
  }
  return res.json()
}

export async function createFeeCharge(companyId, payload) {
  assertLocal()
  const res = await localApiFetch('/api/school/fees/charges', {
    method: 'POST',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create charge')
  }
  return res.json()
}

export async function updateFeeCharge(companyId, id, payload) {
  assertLocal()
  const res = await localApiFetch(`/api/school/fees/charges/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to update charge')
  }
  return res.json()
}

export async function deleteFeeCharge(companyId, id) {
  assertLocal()
  const res = await localApiFetch(
    `/api/school/fees/charges/${encodeURIComponent(id)}${qs({ company_id: companyId })}`,
    { method: 'DELETE' }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to delete charge')
  }
}

/**
 * @param {string} companyId
 * @param {{ studentId?: string, paidFrom?: string, paidTo?: string }} [filters]
 */
export async function getFeePayments(companyId, filters) {
  assertLocal()
  const f = filters && typeof filters === 'object' ? filters : { studentId: filters }
  const res = await localApiFetch(
    `/api/school/fees/payments${qs({
      company_id: companyId,
      student_id: f?.studentId || undefined,
      paid_from: f?.paidFrom || undefined,
      paid_to: f?.paidTo || undefined
    })}`
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load payments')
  }
  return res.json()
}

export async function createFeePayment(companyId, payload) {
  assertLocal()
  const res = await localApiFetch('/api/school/fees/payments', {
    method: 'POST',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to record payment')
  }
  return res.json()
}

export async function updateFeePayment(companyId, id, payload) {
  assertLocal()
  const res = await localApiFetch(`/api/school/fees/payments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to update payment')
  }
  return res.json()
}

export async function deleteFeePayment(companyId, id) {
  assertLocal()
  const res = await localApiFetch(
    `/api/school/fees/payments/${encodeURIComponent(id)}${qs({ company_id: companyId })}`,
    { method: 'DELETE' }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to delete payment')
  }
}
