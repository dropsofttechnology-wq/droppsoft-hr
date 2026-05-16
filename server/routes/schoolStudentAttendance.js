import { Router } from 'express'
import { randomUUID } from 'crypto'
import { requirePermission } from '../middleware/permission-guard.js'
import { mapStudentDailyAttendanceRow, mapStudentRow } from '../utils/rowMappers.js'
import { runInTransaction } from '../utils/transactions.js'

const SCHOOL_ATTENDANCE_PERM = 'school_attendance'
const VALID_STATUS = new Set(['present', 'absent', 'late', 'excused'])

function requireCompanyId(req, res) {
  const q = req.query.company_id != null ? String(req.query.company_id).trim() : ''
  const b = req.body?.company_id != null ? String(req.body.company_id).trim() : ''
  const id = q || b
  if (!id) {
    res.status(400).json({ error: 'company_id is required' })
    return null
  }
  return id
}

function companyExists(db, companyId) {
  return !!db.prepare('SELECT id FROM companies WHERE id = ?').get(companyId)
}

function parseDateParam(value, label) {
  const d = String(value || '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return { error: `${label} must be YYYY-MM-DD` }
  }
  return { date: d }
}

function daysInclusive(fromDate, toDate) {
  const a = new Date(`${fromDate}T12:00:00`)
  const b = new Date(`${toDate}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0
  return Math.floor((b - a) / 86400000) + 1
}

function roundPct(num, den) {
  if (!den) return null
  return Math.round((num / den) * 1000) / 10
}

/**
 * Class period report: distinct attendance dates taken + per-student status counts.
 * @param {import('better-sqlite3').Database} db
 */
function buildClassPeriodReport(db, companyId, { classId, fromDate, toDate, sessionType }) {
  const schoolDaysRow = db
    .prepare(
      `SELECT COUNT(DISTINCT attendance_date) AS n
       FROM student_daily_attendance
       WHERE company_id = ? AND TRIM(class_id) = ?
         AND attendance_date >= ? AND attendance_date <= ?
         AND session_type = ?`
    )
    .get(companyId, classId, fromDate, toDate, sessionType)
  const total_school_days = Number(schoolDaysRow?.n) || 0

  const studentRows = db
    .prepare(
      `SELECT
        s.id AS student_id,
        s.student_number,
        s.legal_name,
        COALESCE(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END), 0) AS present,
        COALESCE(SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END), 0) AS absent,
        COALESCE(SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END), 0) AS late,
        COALESCE(SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END), 0) AS excused
      FROM students s
      LEFT JOIN student_daily_attendance a
        ON a.student_id = s.id
        AND a.company_id = s.company_id
        AND TRIM(a.class_id) = ?
        AND a.attendance_date >= ? AND a.attendance_date <= ?
        AND a.session_type = ?
      WHERE s.company_id = ? AND s.status = 'active' AND TRIM(s.class_label) = ?
      GROUP BY s.id
      ORDER BY s.student_number COLLATE NOCASE, s.legal_name COLLATE NOCASE`
    )
    .all(classId, fromDate, toDate, sessionType, companyId, classId)

  const students = studentRows.map((row) => {
    const present = Number(row.present) || 0
    const late = Number(row.late) || 0
    const attended = present + late
    return {
      student_id: row.student_id,
      student_number: row.student_number,
      legal_name: row.legal_name,
      class_id: classId,
      present,
      absent: Number(row.absent) || 0,
      late,
      excused: Number(row.excused) || 0,
      attendance_percentage: roundPct(attended, total_school_days) ?? 0
    }
  })

  const class_average_attendance =
    students.length > 0
      ? Math.round(
          (students.reduce((sum, s) => sum + (Number(s.attendance_percentage) || 0), 0) / students.length) * 10
        ) / 10
      : null

  return {
    company_id: companyId,
    class_id: classId,
    from_date: fromDate,
    to_date: toDate,
    session_type: sessionType,
    total_school_days,
    class_average_attendance,
    students
  }
}

function localTodayIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * School-wide snapshot for dashboard (today, or latest date with saved marks).
 * @param {import('better-sqlite3').Database} db
 */
function buildAttendanceDashboardSummary(db, companyId, sessionType = 'daily') {
  const today = localTodayIso()

  const todayHasMarks = db
    .prepare(
      `SELECT 1 AS ok FROM student_daily_attendance
       WHERE company_id = ? AND session_type = ? AND attendance_date = ?
       LIMIT 1`
    )
    .get(companyId, sessionType, today)

  let effectiveDate = today
  if (!todayHasMarks) {
    const latest = db
      .prepare(
        `SELECT MAX(attendance_date) AS d FROM student_daily_attendance
         WHERE company_id = ? AND session_type = ? AND attendance_date <= ?`
      )
      .get(companyId, sessionType, today)
    const latestDate = latest?.d ? String(latest.d).slice(0, 10) : ''
    if (latestDate) effectiveDate = latestDate
  }

  const counts =
    effectiveDate && db
      .prepare(
        `SELECT
          SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) AS present_count,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent_count
         FROM student_daily_attendance
         WHERE company_id = ? AND session_type = ? AND attendance_date = ?`
      )
      .get(companyId, sessionType, effectiveDate) || {}

  const presentCount = Number(counts.present_count) || 0
  const absentCount = Number(counts.absent_count) || 0
  const markedTotal = presentCount + absentCount
  const rate = markedTotal > 0 ? Math.round((presentCount / markedTotal) * 1000) / 10 : null

  const unmarkedRow = db
    .prepare(
      `SELECT COUNT(*) AS n FROM (
        SELECT DISTINCT TRIM(s.class_label) AS class_id
        FROM students s
        WHERE s.company_id = ? AND s.status = 'active'
          AND s.class_label IS NOT NULL AND TRIM(s.class_label) != ''
          AND NOT EXISTS (
            SELECT 1 FROM student_daily_attendance a
            WHERE a.company_id = s.company_id
              AND a.session_type = ?
              AND a.attendance_date = ?
              AND TRIM(a.class_id) = TRIM(s.class_label)
          )
      )`
    )
    .get(companyId, sessionType, effectiveDate)

  const unmarkedClassesCount = Number(unmarkedRow?.n) || 0

  return {
    success: true,
    date: effectiveDate,
    presentCount,
    absentCount,
    rate,
    unmarkedClassesCount,
    isToday: effectiveDate === today
  }
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createSchoolStudentAttendanceRoutes(db) {
  const r = Router()
  const can = requirePermission(db, SCHOOL_ATTENDANCE_PERM)

  function tryAudit(req, { companyId, action, entityId, newValue }) {
    try {
      const id = randomUUID()
      const now = new Date().toISOString()
      const nv = newValue != null ? String(newValue).slice(0, 5000) : null
      db.prepare(
        `INSERT INTO audit_log (id, user_id, company_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, ?)`
      ).run(id, req.userId, companyId, action, 'student_daily_attendance', entityId, nv, now)
    } catch (err) {
      console.error('[school student_attendance audit]', err.message)
    }
  }

  r.get('/attendance/classes', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const rows = db
        .prepare(
          `SELECT DISTINCT TRIM(class_label) AS class_id
           FROM students
           WHERE company_id = ? AND status = 'active'
             AND class_label IS NOT NULL AND TRIM(class_label) != ''
           ORDER BY class_id COLLATE NOCASE`
        )
        .all(companyId)
      res.json(rows.map((row) => row.class_id))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  function loadAttendanceGrid(companyId, { date, classId, sessionType, defaultStatus }) {
    const students = db
      .prepare(
        `SELECT * FROM students
         WHERE company_id = ? AND status = 'active' AND TRIM(class_label) = ?
         ORDER BY student_number COLLATE NOCASE, legal_name COLLATE NOCASE`
      )
      .all(companyId, classId)
      .map(mapStudentRow)

    if (students.length === 0) {
      return {
        company_id: companyId,
        attendance_date: date,
        class_id: classId,
        session_type: sessionType,
        rows: []
      }
    }

    const ids = students.map((s) => s.id)
    const placeholders = ids.map(() => '?').join(',')
    const marks = db
      .prepare(
        `SELECT * FROM student_daily_attendance
         WHERE company_id = ? AND attendance_date = ? AND session_type = ?
           AND student_id IN (${placeholders})`
      )
      .all(companyId, date, sessionType, ...ids)
      .map(mapStudentDailyAttendanceRow)

    const markByStudent = new Map(marks.map((m) => [String(m.student_id), m]))
    const fallback = VALID_STATUS.has(defaultStatus) ? defaultStatus : 'absent'

    const rows = students.map((s) => {
      const mark = markByStudent.get(String(s.id))
      return {
        student_id: s.id,
        student_number: s.student_number,
        legal_name: s.legal_name,
        class_label: s.class_label || classId,
        status: mark?.status || fallback,
        record_id: mark?.id || null
      }
    })

    return {
      company_id: companyId,
      attendance_date: date,
      class_id: classId,
      session_type: sessionType,
      rows
    }
  }

  function saveAttendanceMarksHandler(req, res, { auditAction }) {
    try {
    const companyId = requireCompanyId(req, res)
    if (!companyId) return
    if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
    const dateRaw = req.body?.date ?? req.body?.attendance_date
    const parsed = parseDateParam(dateRaw, 'date')
    if (parsed.error) return res.status(400).json({ error: parsed.error })
    const classId = String(req.body?.class_id || '').trim()
    if (!classId) return res.status(400).json({ error: 'class_id is required' })
    const sessionType = String(req.body?.session_type || 'daily').trim() || 'daily'
    const marks = Array.isArray(req.body?.marks) ? req.body.marks : []
    if (marks.length === 0) return res.status(400).json({ error: 'marks array is required' })

    const result = runInTransaction(db, () => {
      const upsert = db.prepare(
        `INSERT INTO student_daily_attendance (
          id, company_id, attendance_date, student_id, class_id, status, session_type, marked_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(attendance_date, student_id, session_type) DO UPDATE SET
          class_id = excluded.class_id,
          status = excluded.status,
          marked_by = excluded.marked_by,
          company_id = excluded.company_id`
      )
      let saved = 0
      const now = new Date().toISOString()
      for (const raw of marks) {
        const studentId = String(raw?.student_id || '').trim()
        if (!studentId) continue
        const student = db
          .prepare(
            `SELECT id FROM students WHERE id = ? AND company_id = ? AND status = 'active' AND TRIM(class_label) = ?`
          )
          .get(studentId, companyId, classId)
        if (!student) {
          throw new Error(`Invalid student_id for class: ${studentId}`)
        }
        const status = String(raw?.status || 'absent').trim().toLowerCase()
        if (!VALID_STATUS.has(status)) {
          throw new Error(`Invalid status for student ${studentId}`)
        }
        const existing = db
          .prepare(
            `SELECT id, created_at FROM student_daily_attendance
             WHERE attendance_date = ? AND student_id = ? AND session_type = ?`
          )
          .get(parsed.date, studentId, sessionType)
        upsert.run(
          existing?.id || randomUUID(),
          companyId,
          parsed.date,
          studentId,
          classId,
          status,
          sessionType,
          req.userId || null,
          existing?.created_at || now
        )
        saved += 1
      }
      return { saved }
    })

    tryAudit(req, {
      companyId,
      action: auditAction,
      entityId: `${parsed.date}:${classId}`,
      newValue: JSON.stringify({
        attendance_date: parsed.date,
        class_id: classId,
        session_type: sessionType,
        saved: result.saved
      })
    })

    res.json({ ok: true, ...result })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  }

  r.get('/attendance/daily', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const parsed = parseDateParam(req.query.attendance_date, 'attendance_date')
      if (parsed.error) return res.status(400).json({ error: parsed.error })
      const classId = String(req.query.class_id || '').trim()
      if (!classId) return res.status(400).json({ error: 'class_id is required' })
      const sessionType = String(req.query.session_type || 'daily').trim() || 'daily'
      res.json(
        loadAttendanceGrid(companyId, {
          date: parsed.date,
          classId,
          sessionType,
          defaultStatus: 'absent'
        })
      )
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/attendance/load-marking-grid', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const dateRaw = req.query.date ?? req.query.attendance_date
      const parsed = parseDateParam(dateRaw, 'date')
      if (parsed.error) return res.status(400).json({ error: parsed.error })
      const classId = String(req.query.class_id || '').trim()
      if (!classId) return res.status(400).json({ error: 'class_id is required' })
      const sessionType = String(req.query.session_type || 'daily').trim() || 'daily'
      res.json(
        loadAttendanceGrid(companyId, {
          date: parsed.date,
          classId,
          sessionType,
          defaultStatus: 'present'
        })
      )
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/attendance/student-history', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const studentId = String(req.query.student_id || '').trim()
      if (!studentId) return res.status(400).json({ error: 'student_id is required' })

      const student = db
        .prepare(`SELECT * FROM students WHERE id = ? AND company_id = ?`)
        .get(studentId, companyId)
      if (!student) return res.status(404).json({ error: 'Student not found' })

      const rows = db
        .prepare(
          `SELECT attendance_date, status, session_type, remarks, class_id
           FROM student_daily_attendance
           WHERE company_id = ? AND student_id = ?
           ORDER BY attendance_date DESC, session_type COLLATE NOCASE`
        )
        .all(companyId, studentId)

      let present = 0
      let absent = 0
      let late = 0
      let excused = 0
      const records = rows.map((row) => {
        const status = String(row.status || 'absent').toLowerCase()
        if (status === 'present') present += 1
        else if (status === 'absent') absent += 1
        else if (status === 'late') late += 1
        else if (status === 'excused') excused += 1
        return {
          attendance_date: String(row.attendance_date || '').slice(0, 10),
          status,
          session_type: row.session_type || 'daily',
          remarks: row.remarks != null ? String(row.remarks) : '',
          class_id: row.class_id || ''
        }
      })

      const markedTotal = present + absent + late + excused
      const attended = present + late

      res.json({
        success: true,
        student_id: studentId,
        student_number: student.student_number,
        legal_name: student.legal_name,
        class_label: student.class_label || '',
        summary: {
          present,
          absent,
          late,
          excused,
          marked_days: markedTotal,
          attendance_percentage: roundPct(attended, markedTotal)
        },
        records
      })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/attendance/dashboard-summary', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const sessionType = String(req.query.session_type || 'daily').trim() || 'daily'
      res.json(buildAttendanceDashboardSummary(db, companyId, sessionType))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/attendance/period-report', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const fromParsed = parseDateParam(req.query.from_date, 'from_date')
      if (fromParsed.error) return res.status(400).json({ error: fromParsed.error })
      const toParsed = parseDateParam(req.query.to_date, 'to_date')
      if (toParsed.error) return res.status(400).json({ error: toParsed.error })
      if (toParsed.date < fromParsed.date) {
        return res.status(400).json({ error: 'to_date must be on or after from_date' })
      }
      const classId = String(req.query.class_id || '').trim()
      if (!classId) return res.status(400).json({ error: 'class_id is required' })
      const sessionType = String(req.query.session_type || 'daily').trim() || 'daily'
      res.json(
        buildClassPeriodReport(db, companyId, {
          classId,
          fromDate: fromParsed.date,
          toDate: toParsed.date,
          sessionType
        })
      )
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/attendance/reports/period', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const fromParsed = parseDateParam(req.query.from_date, 'from_date')
      if (fromParsed.error) return res.status(400).json({ error: fromParsed.error })
      const toParsed = parseDateParam(req.query.to_date, 'to_date')
      if (toParsed.error) return res.status(400).json({ error: toParsed.error })
      if (toParsed.date < fromParsed.date) {
        return res.status(400).json({ error: 'to_date must be on or after from_date' })
      }
      const classFilter = String(req.query.class_id || '').trim()
      const sessionType = String(req.query.session_type || 'daily').trim() || 'daily'
      const schoolDays = daysInclusive(fromParsed.date, toParsed.date)

      const studentRows = classFilter
        ? db
            .prepare(
              `SELECT
                s.id AS student_id,
                s.student_number,
                s.legal_name,
                TRIM(s.class_label) AS class_id,
                SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent,
                SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late,
                SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) AS excused,
                COUNT(a.id) AS marked
              FROM students s
              LEFT JOIN student_daily_attendance a
                ON a.student_id = s.id
                AND a.company_id = s.company_id
                AND a.attendance_date >= ? AND a.attendance_date <= ?
                AND a.session_type = ?
              WHERE s.company_id = ? AND s.status = 'active' AND TRIM(s.class_label) = ?
              GROUP BY s.id
              ORDER BY class_id COLLATE NOCASE, student_number COLLATE NOCASE`
            )
            .all(fromParsed.date, toParsed.date, sessionType, companyId, classFilter)
        : db
            .prepare(
              `SELECT
                s.id AS student_id,
                s.student_number,
                s.legal_name,
                TRIM(s.class_label) AS class_id,
                SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent,
                SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late,
                SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) AS excused,
                COUNT(a.id) AS marked
              FROM students s
              LEFT JOIN student_daily_attendance a
                ON a.student_id = s.id
                AND a.company_id = s.company_id
                AND a.attendance_date >= ? AND a.attendance_date <= ?
                AND a.session_type = ?
              WHERE s.company_id = ? AND s.status = 'active'
                AND class_label IS NOT NULL AND TRIM(class_label) != ''
              GROUP BY s.id
              ORDER BY class_id COLLATE NOCASE, student_number COLLATE NOCASE`
            )
            .all(fromParsed.date, toParsed.date, sessionType, companyId)

      const students = studentRows.map((row) => {
        const marked = Number(row.marked) || 0
        const present = Number(row.present) || 0
        const late = Number(row.late) || 0
        const attended = present + late
        return {
          student_id: row.student_id,
          student_number: row.student_number,
          legal_name: row.legal_name,
          class_id: row.class_id,
          marked,
          present,
          absent: Number(row.absent) || 0,
          late,
          excused: Number(row.excused) || 0,
          attended_rate: roundPct(attended, marked),
          coverage_rate: roundPct(marked, schoolDays)
        }
      })

      const byClassMap = new Map()
      for (const st of students) {
        const cid = String(st.class_id || '').trim() || '—'
        let agg = byClassMap.get(cid)
        if (!agg) {
          agg = {
            class_id: cid,
            student_count: 0,
            marked: 0,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0
          }
          byClassMap.set(cid, agg)
        }
        agg.student_count += 1
        agg.marked += st.marked
        agg.present += st.present
        agg.absent += st.absent
        agg.late += st.late
        agg.excused += st.excused
      }

      const by_class = [...byClassMap.values()]
        .map((agg) => {
          const attended = agg.present + agg.late
          return {
            ...agg,
            attended_rate: roundPct(attended, agg.marked),
            coverage_rate: roundPct(agg.marked, schoolDays * agg.student_count)
          }
        })
        .sort((a, b) => String(a.class_id).localeCompare(String(b.class_id)))

      res.json({
        company_id: companyId,
        from_date: fromParsed.date,
        to_date: toParsed.date,
        session_type: sessionType,
        school_days: schoolDays,
        students,
        by_class
      })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.put('/attendance/daily', can, (req, res) => {
    saveAttendanceMarksHandler(req, res, { auditAction: 'student_attendance_daily_save' })
  })

  r.put('/attendance/save-marks', can, (req, res) => {
    saveAttendanceMarksHandler(req, res, { auditAction: 'student_attendance_save_marks' })
  })

  return r
}
