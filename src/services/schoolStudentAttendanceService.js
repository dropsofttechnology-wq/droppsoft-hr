import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'

function assertLocal() {
  if (!isLocalDataSource()) {
    throw new Error('Student attendance register is available in desktop / local API mode only.')
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

export async function getAttendanceClasses(companyId) {
  assertLocal()
  const res = await localApiFetch(`/api/school/attendance/classes${qs({ company_id: companyId })}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load classes')
  }
  return res.json()
}

export async function getDailyAttendanceRegister(companyId, { attendanceDate, classId, sessionType = 'daily' }) {
  assertLocal()
  const res = await localApiFetch(
    `/api/school/attendance/daily${qs({
      company_id: companyId,
      attendance_date: attendanceDate,
      class_id: classId,
      session_type: sessionType
    })}`
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load attendance register')
  }
  return res.json()
}

export async function getPeriodAttendanceReport(companyId, { fromDate, toDate, classId, sessionType = 'daily' }) {
  assertLocal()
  const res = await localApiFetch(
    `/api/school/attendance/reports/period${qs({
      company_id: companyId,
      from_date: fromDate,
      to_date: toDate,
      class_id: classId || undefined,
      session_type: sessionType
    })}`
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load attendance report')
  }
  return res.json()
}

export async function getStudentAttendanceHistory(companyId, studentId) {
  assertLocal()
  const res = await localApiFetch(
    `/api/school/attendance/student-history${qs({
      company_id: companyId,
      student_id: studentId
    })}`
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load student attendance history')
  }
  return res.json()
}

export async function getAttendanceDashboardSummary(companyId, { sessionType = 'daily' } = {}) {
  assertLocal()
  const res = await localApiFetch(
    `/api/school/attendance/dashboard-summary${qs({
      company_id: companyId,
      session_type: sessionType
    })}`
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load attendance summary')
  }
  return res.json()
}

/** Class-scoped period report (distinct school days + per-student aggregates). */
export async function getClassPeriodReport(companyId, { fromDate, toDate, classId, sessionType = 'daily' }) {
  assertLocal()
  const res = await localApiFetch(
    `/api/school/attendance/period-report${qs({
      company_id: companyId,
      from_date: fromDate,
      to_date: toDate,
      class_id: classId,
      session_type: sessionType
    })}`
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load period report')
  }
  return res.json()
}

export async function saveDailyAttendance(companyId, payload) {
  assertLocal()
  const res = await localApiFetch('/api/school/attendance/daily', {
    method: 'PUT',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to save attendance')
  }
  return res.json()
}

export async function loadMarkingGrid(companyId, { date, classId, sessionType = 'daily' }) {
  assertLocal()
  const res = await localApiFetch(
    `/api/school/attendance/load-marking-grid${qs({
      company_id: companyId,
      date,
      class_id: classId,
      session_type: sessionType
    })}`
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load marking grid')
  }
  return res.json()
}

export async function saveAttendanceMarks(companyId, payload) {
  assertLocal()
  const res = await localApiFetch('/api/school/attendance/save-marks', {
    method: 'PUT',
    body: JSON.stringify({ ...payload, company_id: companyId })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to save register')
  }
  return res.json()
}

/**
 * Single-student upsert into `student_daily_attendance` (same handler as bulk save-marks).
 * Server: PUT `/api/school/attendance/save-marks` (also exposed as PUT `/api/school/attendance/daily`).
 */
export async function upsertStudentPresentForDate(companyId, { date, classId, studentId }) {
  return saveAttendanceMarks(companyId, {
    date,
    class_id: classId,
    session_type: 'daily',
    marks: [{ student_id: String(studentId), status: 'present' }]
  })
}
