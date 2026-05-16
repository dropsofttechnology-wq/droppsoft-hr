/** @param {unknown} value */
export function escapeCsvCell(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/**
 * @param {{ attendance_date: string, class_id: string, session_type?: string, rows: Record<string, unknown>[] }} register
 */
export function buildStudentDailyAttendanceCsv(register) {
  const headers = [
    'attendance_date',
    'class_id',
    'session_type',
    'student_number',
    'legal_name',
    'status'
  ]
  const lines = [headers.join(',')]
  const sessionType = register.session_type || 'daily'
  for (const row of register.rows || []) {
    lines.push(
      [
        escapeCsvCell(register.attendance_date),
        escapeCsvCell(register.class_id),
        escapeCsvCell(sessionType),
        escapeCsvCell(row.student_number),
        escapeCsvCell(row.legal_name),
        escapeCsvCell(row.status)
      ].join(',')
    )
  }
  return lines.join('\r\n')
}

/**
 * @param {{ class_id?: string, from_date?: string, to_date?: string, students?: Record<string, unknown>[] }} report
 */
export function buildStudentPeriodReportCsv(report) {
  const headers = [
    'Admission No',
    'Student Name',
    'Present',
    'Absent',
    'Late',
    'Excused',
    'Attendance Percentage'
  ]
  const lines = [headers.join(',')]
  for (const row of report.students || []) {
    const pct =
      row.attendance_percentage != null
        ? row.attendance_percentage
        : row.attended_rate != null
          ? row.attended_rate
          : ''
    lines.push(
      [
        escapeCsvCell(row.student_number),
        escapeCsvCell(row.legal_name),
        escapeCsvCell(row.present ?? 0),
        escapeCsvCell(row.absent ?? 0),
        escapeCsvCell(row.late ?? 0),
        escapeCsvCell(row.excused ?? 0),
        escapeCsvCell(pct !== '' ? `${pct}%` : '')
      ].join(',')
    )
  }
  return lines.join('\r\n')
}

/**
 * @param {{ classId?: string, fromDate?: string, toDate?: string }} opts
 */
export function studentPeriodReportFilename({ classId, fromDate, toDate }) {
  const cls = String(classId || 'Class').replace(/[^\w.-]+/g, '_').slice(0, 40)
  const from = String(fromDate || '').slice(0, 10)
  const to = String(toDate || '').slice(0, 10)
  return `Student_Attendance_Report_${cls}_${from}_to_${to}.csv`
}

/**
 * @param {string} filename
 * @param {string} csvBody
 */
export function downloadStudentAttendanceCsv(filename, csvBody) {
  const blob = new Blob([csvBody], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
