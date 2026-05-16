import { Router } from 'express'
import { randomUUID } from 'crypto'
import { requirePermission } from '../middleware/permission-guard.js'
import { CBC_PERFORMANCE_LEVELS, isValidCbcLevel } from '../utils/cbcPerformanceLevels.js'
import { mapSchoolSubjectRow, mapSchoolSubjectStrandRow } from '../utils/rowMappers.js'
import { runInTransaction } from '../utils/transactions.js'
import { loadCbcTranscript } from '../services/cbcTranscriptData.js'
import {
  getTranscriptEmailStatus,
  sendClassTranscriptEmails,
  sendStudentTranscriptEmail,
  emailCbcTranscriptsToParents
} from '../services/transcriptEmailService.js'
import {
  mapSchoolEmailSettingsResponse,
  upsertSchoolEmailSettings
} from '../services/schoolEmailSettings.js'

const CBC_GRADING_PERM = 'cbc_grading'

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

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createSchoolCbcGradingRoutes(db) {
  const r = Router()
  const can = requirePermission(db, CBC_GRADING_PERM)

  r.get('/cbc/performance-levels', can, (_req, res) => {
    res.json({ levels: CBC_PERFORMANCE_LEVELS })
  })

  r.get('/cbc/grade-levels', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const rows = db
        .prepare(
          `SELECT DISTINCT TRIM(class_label) AS grade_level
           FROM students
           WHERE company_id = ? AND status = 'active'
             AND class_label IS NOT NULL AND TRIM(class_label) != ''
           ORDER BY grade_level COLLATE NOCASE`
        )
        .all(companyId)
      res.json(rows.map((row) => row.grade_level))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/cbc/subjects', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const rows = db
        .prepare(
          `SELECT * FROM school_subjects WHERE company_id = ? ORDER BY subject_name COLLATE NOCASE`
        )
        .all(companyId)
        .map(mapSchoolSubjectRow)
      res.json(rows)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/cbc/subjects', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const subject_name = String(req.body?.subject_name || '').trim()
      if (!subject_name) return res.status(400).json({ error: 'subject_name is required' })
      const subject_code = String(req.body?.subject_code || '').trim() || null
      const now = new Date().toISOString()
      const id = randomUUID()
      db.prepare(
        `INSERT INTO school_subjects (id, company_id, subject_name, subject_code, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(id, companyId, subject_name, subject_code, now, now)
      res.status(201).json(mapSchoolSubjectRow(db.prepare('SELECT * FROM school_subjects WHERE id = ?').get(id)))
    } catch (e) {
      if (String(e.message || '').includes('UNIQUE')) {
        return res.status(400).json({ error: 'Subject code already exists for this company' })
      }
      res.status(400).json({ error: e.message })
    }
  })

  r.patch('/cbc/subjects/:id', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      const id = String(req.params.id || '').trim()
      const existing = db.prepare('SELECT * FROM school_subjects WHERE id = ?').get(id)
      if (!existing || String(existing.company_id) !== String(companyId)) {
        return res.status(404).json({ error: 'Subject not found' })
      }
      const subject_name = String(req.body?.subject_name ?? existing.subject_name).trim()
      const subject_code =
        req.body?.subject_code !== undefined
          ? String(req.body.subject_code || '').trim() || null
          : existing.subject_code
      const now = new Date().toISOString()
      db.prepare(
        `UPDATE school_subjects SET subject_name = ?, subject_code = ?, updated_at = ? WHERE id = ?`
      ).run(subject_name, subject_code, now, id)
      res.json(mapSchoolSubjectRow(db.prepare('SELECT * FROM school_subjects WHERE id = ?').get(id)))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.delete('/cbc/subjects/:id', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      const id = String(req.params.id || '').trim()
      const existing = db.prepare('SELECT * FROM school_subjects WHERE id = ?').get(id)
      if (!existing || String(existing.company_id) !== String(companyId)) {
        return res.status(404).json({ error: 'Subject not found' })
      }
      db.prepare('DELETE FROM school_subjects WHERE id = ?').run(id)
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.get('/cbc/strands', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const subjectId = String(req.query.subject_id || '').trim()
      const gradeLevel = String(req.query.grade_level || '').trim()
      let sql = `SELECT st.*, sub.subject_name, sub.subject_code
        FROM school_subject_strands st
        JOIN school_subjects sub ON sub.id = st.subject_id
        WHERE st.company_id = ?`
      const params = [companyId]
      if (subjectId) {
        sql += ` AND st.subject_id = ?`
        params.push(subjectId)
      }
      if (gradeLevel) {
        sql += ` AND TRIM(st.grade_level) = ?`
        params.push(gradeLevel)
      }
      sql += ` ORDER BY st.grade_level COLLATE NOCASE, st.strand_name COLLATE NOCASE`
      const rows = db.prepare(sql).all(...params).map(mapSchoolSubjectStrandRow)
      res.json(rows)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/cbc/strands', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      const subject_id = String(req.body?.subject_id || '').trim()
      const grade_level = String(req.body?.grade_level || '').trim()
      const strand_name = String(req.body?.strand_name || '').trim()
      if (!subject_id || !grade_level || !strand_name) {
        return res.status(400).json({ error: 'subject_id, grade_level, and strand_name are required' })
      }
      const sub = db.prepare('SELECT id FROM school_subjects WHERE id = ? AND company_id = ?').get(subject_id, companyId)
      if (!sub) return res.status(400).json({ error: 'Invalid subject_id' })
      const now = new Date().toISOString()
      const id = randomUUID()
      db.prepare(
        `INSERT INTO school_subject_strands (id, company_id, subject_id, grade_level, strand_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(id, companyId, subject_id, grade_level, strand_name, now, now)
      const row = db
        .prepare(
          `SELECT st.*, sub.subject_name, sub.subject_code FROM school_subject_strands st
           JOIN school_subjects sub ON sub.id = st.subject_id WHERE st.id = ?`
        )
        .get(id)
      res.status(201).json(mapSchoolSubjectStrandRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.patch('/cbc/strands/:id', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      const id = String(req.params.id || '').trim()
      const existing = db.prepare('SELECT * FROM school_subject_strands WHERE id = ?').get(id)
      if (!existing || String(existing.company_id) !== String(companyId)) {
        return res.status(404).json({ error: 'Strand not found' })
      }
      const grade_level = String(req.body?.grade_level ?? existing.grade_level).trim()
      const strand_name = String(req.body?.strand_name ?? existing.strand_name).trim()
      const now = new Date().toISOString()
      db.prepare(
        `UPDATE school_subject_strands SET grade_level = ?, strand_name = ?, updated_at = ? WHERE id = ?`
      ).run(grade_level, strand_name, now, id)
      const row = db
        .prepare(
          `SELECT st.*, sub.subject_name, sub.subject_code FROM school_subject_strands st
           JOIN school_subjects sub ON sub.id = st.subject_id WHERE st.id = ?`
        )
        .get(id)
      res.json(mapSchoolSubjectStrandRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.delete('/cbc/strands/:id', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      const id = String(req.params.id || '').trim()
      const existing = db.prepare('SELECT * FROM school_subject_strands WHERE id = ?').get(id)
      if (!existing || String(existing.company_id) !== String(companyId)) {
        return res.status(404).json({ error: 'Strand not found' })
      }
      db.prepare('DELETE FROM school_subject_strands WHERE id = ?').run(id)
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.get('/cbc/assessment-matrix', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      const academic_year_id = String(req.query.academic_year_id || '').trim()
      const term_id = String(req.query.term_id || '').trim()
      const class_id = String(req.query.class_id || req.query.grade_level || '').trim()
      const strand_id = String(req.query.strand_id || '').trim()
      if (!academic_year_id || !term_id || !class_id || !strand_id) {
        return res.status(400).json({
          error: 'academic_year_id, term_id, class_id, and strand_id are required'
        })
      }
      const strand = db
        .prepare(
          `SELECT st.*, sub.subject_name FROM school_subject_strands st
           JOIN school_subjects sub ON sub.id = st.subject_id
           WHERE st.id = ? AND st.company_id = ?`
        )
        .get(strand_id, companyId)
      if (!strand) return res.status(404).json({ error: 'Strand not found' })

      const students = db
        .prepare(
          `SELECT * FROM students
           WHERE company_id = ? AND status = 'active' AND TRIM(class_label) = ?
           ORDER BY student_number COLLATE NOCASE, legal_name COLLATE NOCASE`
        )
        .all(companyId, class_id)

      const marks = db
        .prepare(
          `SELECT * FROM student_performance_marks
           WHERE company_id = ? AND academic_year_id = ? AND term_id = ? AND strand_id = ?`
        )
        .all(companyId, academic_year_id, term_id, strand_id)
      const markByStudent = new Map(marks.map((m) => [String(m.student_id), m]))

      const rows = students.map((s) => {
        const m = markByStudent.get(String(s.id))
        return {
          student_id: s.id,
          student_number: s.student_number,
          legal_name: s.legal_name,
          performance_level: m ? Number(m.performance_level) : null,
          teacher_remarks: m?.teacher_remarks || '',
          mark_id: m?.id || null
        }
      })

      res.json({
        company_id: companyId,
        academic_year_id,
        term_id,
        class_id,
        strand: mapSchoolSubjectStrandRow(strand),
        rows
      })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.put('/cbc/assessment-marks', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      const academic_year_id = String(req.body?.academic_year_id || '').trim()
      const term_id = String(req.body?.term_id || '').trim()
      const strand_id = String(req.body?.strand_id || '').trim()
      const marks = Array.isArray(req.body?.marks) ? req.body.marks : []
      if (!academic_year_id || !term_id || !strand_id) {
        return res.status(400).json({ error: 'academic_year_id, term_id, and strand_id are required' })
      }
      if (marks.length === 0) return res.status(400).json({ error: 'marks array is required' })

      const result = runInTransaction(db, () => {
        const upsert = db.prepare(
          `INSERT INTO student_performance_marks (
            id, company_id, academic_year_id, term_id, student_id, strand_id,
            performance_level, teacher_remarks, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(academic_year_id, term_id, student_id, strand_id) DO UPDATE SET
            performance_level = excluded.performance_level,
            teacher_remarks = excluded.teacher_remarks,
            updated_at = excluded.updated_at`
        )
        let saved = 0
        const now = new Date().toISOString()
        for (const raw of marks) {
          const studentId = String(raw?.student_id || '').trim()
          if (!studentId) continue
          if (!isValidCbcLevel(raw?.performance_level)) {
            throw new Error(`Invalid performance_level for student ${studentId}`)
          }
          const student = db
            .prepare(`SELECT id FROM students WHERE id = ? AND company_id = ? AND status = 'active'`)
            .get(studentId, companyId)
          if (!student) throw new Error(`Invalid student_id: ${studentId}`)
          const existing = db
            .prepare(
              `SELECT id, created_at FROM student_performance_marks
               WHERE academic_year_id = ? AND term_id = ? AND student_id = ? AND strand_id = ?`
            )
            .get(academic_year_id, term_id, studentId, strand_id)
          upsert.run(
            existing?.id || randomUUID(),
            companyId,
            academic_year_id,
            term_id,
            studentId,
            strand_id,
            Number(raw.performance_level),
            raw.teacher_remarks != null ? String(raw.teacher_remarks).slice(0, 2000) : null,
            existing?.created_at || now,
            now
          )
          saved += 1
        }
        return { saved }
      })
      res.json({ ok: true, ...result })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.get('/cbc/school-email-settings', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const settings = mapSchoolEmailSettingsResponse(db, companyId)
      res.json({ success: true, settings })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.put('/cbc/school-email-settings', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      if (!companyExists(db, companyId)) return res.status(404).json({ error: 'Company not found' })
      const settings = upsertSchoolEmailSettings(db, companyId, {
        host: req.body?.host,
        port: req.body?.port,
        secure: req.body?.secure,
        auth_user: req.body?.auth_user,
        auth_pass: req.body?.auth_pass,
        sender_name: req.body?.sender_name,
        sender_email: req.body?.sender_email,
        clear_password: !!req.body?.clear_password
      })
      res.json({ success: true, settings })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.post('/cbc/email-transcripts', can, async (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      const academic_year_id = String(req.body?.academic_year_id || '').trim()
      const term_id = String(req.body?.term_id || '').trim()
      const student_ids = Array.isArray(req.body?.student_ids) ? req.body.student_ids : []
      const force = !!req.body?.force
      if (!academic_year_id || !term_id) {
        return res.status(400).json({ error: 'academic_year_id and term_id are required' })
      }
      const result = await emailCbcTranscriptsToParents(db, {
        companyId,
        studentIds: student_ids.map((id) => String(id)),
        academicYearId: academic_year_id,
        termId: term_id,
        sentBy: req.userId,
        force
      })
      res.json({ success: true, ...result })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.get('/cbc/transcript', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      const student_id = String(req.query.student_id || '').trim()
      const academic_year_id = String(req.query.academic_year_id || '').trim()
      const term_id = String(req.query.term_id || '').trim()
      if (!student_id || !academic_year_id || !term_id) {
        return res.status(400).json({ error: 'student_id, academic_year_id, and term_id are required' })
      }
      const data = loadCbcTranscript(db, companyId, {
        studentId: student_id,
        academicYearId: academic_year_id,
        termId: term_id
      })
      res.json(data)
    } catch (e) {
      const status = e.status || 500
      res.status(status).json({ error: e.message })
    }
  })

  r.get('/cbc/transcript-email-status', can, (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      const academic_year_id = String(req.query.academic_year_id || '').trim()
      const term_id = String(req.query.term_id || '').trim()
      const class_id = req.query.class_id != null ? String(req.query.class_id).trim() : ''
      if (!academic_year_id || !term_id) {
        return res.status(400).json({ error: 'academic_year_id and term_id are required' })
      }
      const data = getTranscriptEmailStatus(db, companyId, {
        academicYearId: academic_year_id,
        termId: term_id,
        classId: class_id || undefined
      })
      res.json({ success: true, ...data })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/cbc/send-transcript-email', can, async (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      const student_id = String(req.body?.student_id || '').trim()
      const academic_year_id = String(req.body?.academic_year_id || '').trim()
      const term_id = String(req.body?.term_id || '').trim()
      const force = !!req.body?.force
      if (!student_id || !academic_year_id || !term_id) {
        return res.status(400).json({ error: 'student_id, academic_year_id, and term_id are required' })
      }
      const result = await sendStudentTranscriptEmail(db, {
        companyId,
        studentId: student_id,
        academicYearId: academic_year_id,
        termId: term_id,
        sentBy: req.userId,
        force
      })
      res.json({ success: true, ...result })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.post('/cbc/send-transcript-email-bulk', can, async (req, res) => {
    try {
      const companyId = requireCompanyId(req, res)
      if (!companyId) return
      const academic_year_id = String(req.body?.academic_year_id || '').trim()
      const term_id = String(req.body?.term_id || '').trim()
      const class_id = req.body?.class_id != null ? String(req.body.class_id).trim() : ''
      const student_ids = Array.isArray(req.body?.student_ids) ? req.body.student_ids : null
      const force = !!req.body?.force
      if (!academic_year_id || !term_id) {
        return res.status(400).json({ error: 'academic_year_id and term_id are required' })
      }
      const result = await sendClassTranscriptEmails(db, {
        companyId,
        academicYearId: academic_year_id,
        termId: term_id,
        classId: class_id || undefined,
        studentIds: student_ids,
        sentBy: req.userId,
        force
      })
      res.json({ success: true, ...result })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  return r
}
