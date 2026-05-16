/**
 * Deep links for student attendance (marking + period report).
 */

/**
 * @param {{ date?: string, classId?: string, highlight?: string }} opts
 * @returns {string}
 */
export function buildStudentMarkPath({ date, classId, highlight } = {}) {
  const p = new URLSearchParams()
  p.set('view', 'mark')
  const d = String(date || '').slice(0, 10)
  if (d) p.set('date', d)
  const cls = String(classId || '').trim()
  if (cls) p.set('class_id', cls)
  const hi = String(highlight || '').trim()
  if (hi) p.set('highlight', hi)
  return `/school/student-attendance?${p.toString()}`
}

/**
 * @param {{ fromDate?: string, toDate?: string, classId?: string }} opts
 * @returns {string}
 */
export function buildStudentPeriodReportPath({ fromDate, toDate, classId } = {}) {
  const p = new URLSearchParams()
  p.set('view', 'report')
  const from = String(fromDate || '').slice(0, 10)
  const to = String(toDate || '').slice(0, 10)
  if (from) p.set('from_date', from)
  if (to) p.set('to_date', to)
  const cls = String(classId || '').trim()
  if (cls) p.set('class_id', cls)
  return `/school/student-attendance?${p.toString()}`
}
