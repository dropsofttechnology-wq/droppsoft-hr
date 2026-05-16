import { cbcLevelMeta } from '../utils/cbcPerformanceLevels.js'

/**
 * Load CBC learner progress report payload (shared by API, PDF, and email).
 * @param {import('better-sqlite3').Database} db
 */
export function loadCbcTranscript(db, companyId, { studentId, academicYearId, termId }) {
  const student = db.prepare('SELECT * FROM students WHERE id = ? AND company_id = ?').get(studentId, companyId)
  if (!student) {
    const err = new Error('Student not found')
    err.status = 404
    throw err
  }

  const year = db.prepare('SELECT * FROM academic_years WHERE id = ? AND company_id = ?').get(academicYearId, companyId)
  const term = db.prepare('SELECT * FROM academic_terms WHERE id = ? AND company_id = ?').get(termId, companyId)
  if (!year || !term) {
    const err = new Error('Academic year or term not found')
    err.status = 404
    throw err
  }

  const marks = db
    .prepare(
      `SELECT m.performance_level, m.teacher_remarks,
              st.strand_name, st.grade_level,
              sub.subject_name, sub.subject_code, sub.id AS subject_id
       FROM student_performance_marks m
       JOIN school_subject_strands st ON st.id = m.strand_id
       JOIN school_subjects sub ON sub.id = st.subject_id
       WHERE m.company_id = ? AND m.student_id = ? AND m.academic_year_id = ? AND m.term_id = ?
       ORDER BY sub.subject_name COLLATE NOCASE, st.strand_name COLLATE NOCASE`
    )
    .all(companyId, studentId, academicYearId, termId)

  const bySubject = new Map()
  for (const row of marks) {
    const sid = String(row.subject_id)
    if (!bySubject.has(sid)) {
      bySubject.set(sid, {
        subject_id: sid,
        subject_name: row.subject_name,
        subject_code: row.subject_code,
        strands: [],
        level_sum: 0,
        level_count: 0
      })
    }
    const agg = bySubject.get(sid)
    agg.strands.push({
      strand_name: row.strand_name,
      grade_level: row.grade_level,
      performance_level: Number(row.performance_level),
      teacher_remarks: row.teacher_remarks || ''
    })
    agg.level_sum += Number(row.performance_level)
    agg.level_count += 1
  }

  const learning_areas = [...bySubject.values()].map((a) => ({
    subject_id: a.subject_id,
    subject_name: a.subject_name,
    subject_code: a.subject_code,
    strands: a.strands,
    average_level:
      a.level_count > 0 ? Math.round((a.level_sum / a.level_count) * 10) / 10 : null
  }))

  return {
    success: true,
    student_id: studentId,
    student_number: student.student_number,
    legal_name: student.legal_name,
    class_label: student.class_label || '',
    guardian_email: student.guardian_email || '',
    guardian_summary: student.guardian_summary || '',
    academic_year_id: academicYearId,
    term_id: termId,
    academic_year_label: year.label,
    term_name: term.name,
    learning_areas,
    levelMeta: cbcLevelMeta
  }
}
