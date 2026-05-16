/**
 * Activity log helpers for student daily attendance (separate from HR staff attendance).
 */

/**
 * @param {{ entity_type?: string, action?: string } | null | undefined} row
 */
export function isStudentAttendanceAuditRow(row) {
  const entityType = String(row?.entity_type || '').toLowerCase()
  if (entityType === 'student_daily_attendance') return true
  const action = String(row?.action || '').toLowerCase()
  return action.startsWith('student_attendance_')
}

/**
 * @param {Record<string, unknown> | null} prev
 * @param {Record<string, unknown> | null} details
 */
export function studentAttendanceAuditDetailSummary(prev, details) {
  const pick = (obj) => {
    if (!obj || typeof obj !== 'object') return ''
    const parts = [
      obj.attendance_date,
      obj.class_id,
      obj.session_type,
      obj.saved != null && obj.saved !== '' ? `${obj.saved} mark(s) saved` : null
    ].filter(Boolean)
    return parts.join(' · ') || ''
  }
  const after = pick(details)
  const before = pick(prev)
  if (before && after && before !== after) return `${before} → ${after}`
  return after || before || '—'
}

/**
 * @param {string | null | undefined} raw
 */
function parseAuditJson(raw) {
  if (!raw) return null
  try {
    const obj = JSON.parse(String(raw))
    return obj && typeof obj === 'object' ? obj : null
  } catch {
    return null
  }
}

/**
 * Build URL params to open the attendance register from an audit row.
 * @param {{ entity_id?: string, new_value?: string, old_value?: string } | null | undefined} row
 */
export function studentAttendanceOpenQueryFromAuditRow(row) {
  const details = parseAuditJson(row?.new_value) || parseAuditJson(row?.old_value)
  if (details?.attendance_date && details?.class_id) {
    const p = new URLSearchParams()
    p.set('view', 'mark')
    p.set('date', String(details.attendance_date).slice(0, 10))
    p.set('class_id', String(details.class_id))
    return p
  }
  const entityId = String(row?.entity_id || '').trim()
  if (!entityId) return null
  const firstColon = entityId.indexOf(':')
  if (firstColon > 0) {
    const p = new URLSearchParams()
    p.set('view', 'mark')
    p.set('date', entityId.slice(0, firstColon).slice(0, 10))
    p.set('class_id', entityId.slice(firstColon + 1))
    return p
  }
  return null
}
