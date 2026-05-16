import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'

function assertLocal() {
  if (!isLocalDataSource()) {
    throw new Error('CBC grading is available in desktop / local API mode only.')
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

async function parseError(res, fallback) {
  const err = await res.json().catch(() => ({}))
  throw new Error(err.error || fallback)
}

export async function getCbcSubjects(companyId) {
  assertLocal()
  const res = await localApiFetch(`/api/school/cbc/subjects${qs({ company_id: companyId })}`)
  if (!res.ok) await parseError(res, 'Failed to load subjects')
  return res.json()
}

export async function createCbcSubject(companyId, payload) {
  assertLocal()
  const res = await localApiFetch('/api/school/cbc/subjects', {
    method: 'POST',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) await parseError(res, 'Failed to create subject')
  return res.json()
}

export async function updateCbcSubject(companyId, id, payload) {
  assertLocal()
  const res = await localApiFetch(`/api/school/cbc/subjects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) await parseError(res, 'Failed to update subject')
  return res.json()
}

export async function deleteCbcSubject(companyId, id) {
  assertLocal()
  const res = await localApiFetch(`/api/school/cbc/subjects/${id}${qs({ company_id: companyId })}`, {
    method: 'DELETE'
  })
  if (!res.ok) await parseError(res, 'Failed to delete subject')
  return res.json()
}

export async function getCbcStrands(companyId, { subjectId, gradeLevel } = {}) {
  assertLocal()
  const res = await localApiFetch(
    `/api/school/cbc/strands${qs({
      company_id: companyId,
      subject_id: subjectId,
      grade_level: gradeLevel
    })}`
  )
  if (!res.ok) await parseError(res, 'Failed to load strands')
  return res.json()
}

export async function createCbcStrand(companyId, payload) {
  assertLocal()
  const res = await localApiFetch('/api/school/cbc/strands', {
    method: 'POST',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) await parseError(res, 'Failed to create strand')
  return res.json()
}

export async function deleteCbcStrand(companyId, id) {
  assertLocal()
  const res = await localApiFetch(`/api/school/cbc/strands/${id}${qs({ company_id: companyId })}`, {
    method: 'DELETE'
  })
  if (!res.ok) await parseError(res, 'Failed to delete strand')
  return res.json()
}

export async function getCbcGradeLevels(companyId) {
  assertLocal()
  const res = await localApiFetch(`/api/school/cbc/grade-levels${qs({ company_id: companyId })}`)
  if (!res.ok) await parseError(res, 'Failed to load grade levels')
  return res.json()
}

export async function getCbcAssessmentMatrix(companyId, params) {
  assertLocal()
  const res = await localApiFetch(
    `/api/school/cbc/assessment-matrix${qs({
      company_id: companyId,
      academic_year_id: params.academicYearId,
      term_id: params.termId,
      class_id: params.classId,
      strand_id: params.strandId
    })}`
  )
  if (!res.ok) await parseError(res, 'Failed to load assessment grid')
  return res.json()
}

export async function saveCbcAssessmentMarks(companyId, payload) {
  assertLocal()
  const res = await localApiFetch('/api/school/cbc/assessment-marks', {
    method: 'PUT',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) await parseError(res, 'Failed to save marks')
  return res.json()
}

export async function getCbcTranscript(companyId, { studentId, academicYearId, termId }) {
  assertLocal()
  const res = await localApiFetch(
    `/api/school/cbc/transcript${qs({
      company_id: companyId,
      student_id: studentId,
      academic_year_id: academicYearId,
      term_id: termId
    })}`
  )
  if (!res.ok) await parseError(res, 'Failed to load transcript')
  return res.json()
}

export async function getCbcTranscriptEmailStatus(companyId, { academicYearId, termId, classId }) {
  assertLocal()
  const res = await localApiFetch(
    `/api/school/cbc/transcript-email-status${qs({
      company_id: companyId,
      academic_year_id: academicYearId,
      term_id: termId,
      class_id: classId
    })}`
  )
  if (!res.ok) await parseError(res, 'Failed to load email status')
  return res.json()
}

export async function sendCbcTranscriptEmail(companyId, payload) {
  assertLocal()
  const res = await localApiFetch('/api/school/cbc/send-transcript-email', {
    method: 'POST',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) await parseError(res, 'Failed to send report email')
  return res.json()
}

export async function sendCbcTranscriptEmailBulk(companyId, payload) {
  assertLocal()
  const res = await localApiFetch('/api/school/cbc/send-transcript-email-bulk', {
    method: 'POST',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) await parseError(res, 'Failed to send bulk report emails')
  return res.json()
}

export async function emailCbcTranscripts(companyId, payload) {
  assertLocal()
  const res = await localApiFetch('/api/school/cbc/email-transcripts', {
    method: 'POST',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) await parseError(res, 'Failed to email transcripts')
  return res.json()
}

export async function getSchoolCbcEmailSettings(companyId) {
  assertLocal()
  const res = await localApiFetch(`/api/school/cbc/school-email-settings${qs({ company_id: companyId })}`)
  if (!res.ok) await parseError(res, 'Failed to load school email settings')
  return res.json()
}

export async function putSchoolCbcEmailSettings(companyId, payload) {
  assertLocal()
  const res = await localApiFetch('/api/school/cbc/school-email-settings', {
    method: 'PUT',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) await parseError(res, 'Failed to save school email settings')
  return res.json()
}
