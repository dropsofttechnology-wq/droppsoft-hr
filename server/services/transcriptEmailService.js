import { randomUUID } from 'crypto'
import { getEmailFromDisplay, getSmtpConfig } from '../config/emailConfig.js'
import { loadCbcTranscript } from './cbcTranscriptData.js'
import { buildCbcTranscriptPdfBufferPreferred } from './cbcTranscriptPdf.js'
import { resolveGuardianEmail } from '../utils/guardianEmail.js'
import { createTransportFromSmtp } from './schoolEmailNodemailer.js'

function transcriptAlreadySent(db, companyId, studentId, academicYearId, termId) {
  return !!db
    .prepare(
      `SELECT 1 FROM cbc_transcript_email_log
       WHERE company_id = ? AND student_id = ? AND academic_year_id = ? AND term_id = ?`
    )
    .get(companyId, studentId, academicYearId, termId)
}

function recordTranscriptSent(db, { companyId, studentId, academicYearId, termId, recipientEmail, sentBy }) {
  const now = new Date().toISOString()
  const existing = db
    .prepare(
      `SELECT id FROM cbc_transcript_email_log
       WHERE company_id = ? AND student_id = ? AND academic_year_id = ? AND term_id = ?`
    )
    .get(companyId, studentId, academicYearId, termId)
  if (existing) {
    db.prepare(
      `UPDATE cbc_transcript_email_log SET recipient_email = ?, sent_at = ?, sent_by = ? WHERE id = ?`
    ).run(recipientEmail, now, sentBy || null, existing.id)
  } else {
    db.prepare(
      `INSERT INTO cbc_transcript_email_log (id, company_id, student_id, academic_year_id, term_id, recipient_email, sent_at, sent_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), companyId, studentId, academicYearId, termId, recipientEmail, now, sentBy || null)
  }
}

function buildSubjectLegacy(transcript) {
  const cls = String(transcript.class_label || 'Class').trim()
  const term = String(transcript.term_name || 'Term').trim()
  return `${cls} ${term} Progress Report - ${transcript.legal_name}`
}

function buildSubjectSchoolBranded(transcript, schoolName) {
  const sn = String(schoolName || 'School').trim()
  const nm = String(transcript.legal_name || 'Student').trim()
  const term = String(transcript.term_name || 'Term').trim()
  const yr = String(transcript.academic_year_label || '').trim()
  return `[${sn}] CBC Progress Report - ${nm} (${term}, ${yr})`
}

function buildBody(transcript, schoolName) {
  return `Dear Parent/Guardian,

Please find attached the Learner's Progress Report for ${transcript.legal_name} (${transcript.student_number}) for ${transcript.term_name}, ${transcript.academic_year_label}.

This report reflects competency-based curriculum (CBC) assessments recorded by ${schoolName}.

Kind regards,
${schoolName}`
}

function progressReportAttachmentFilename(transcript) {
  const safeName = String(transcript.legal_name || 'student')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 80)
  return `Progress_Report_${safeName}.pdf`
}

function createTransporter(smtp) {
  return createTransportFromSmtp(smtp)
}

/**
 * Legacy path: payslip / env SMTP only (for backward compatibility of early callers).
 * @param {import('better-sqlite3').Database} db
 */
function resolveLegacyMailProfile(db, companyId) {
  const smtp = getSmtpConfig(db, companyId)
  if (!smtp.host) {
    throw new Error('SMTP is not configured. Set SMTP under Settings → Payslip email (or HR_SMTP_* env).')
  }
  const { formattedFrom, fromName } = getEmailFromDisplay(db, companyId)
  if (!formattedFrom) {
    throw new Error('SMTP From address is missing.')
  }
  return {
    smtp: {
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      user: smtp.user,
      pass: smtp.pass,
      from: smtp.from
    },
    fromName: fromName || 'School',
    formattedFrom
  }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ companyId: string, studentId: string, academicYearId: string, termId: string, sentBy?: string | null, force?: boolean, subjectStyle?: 'legacy' | 'school_branded', mailProfile?: ReturnType<typeof resolveSchoolTranscriptMailProfile> }} opts
 */
async function sendOneTranscriptEmail(db, opts) {
  const {
    companyId,
    studentId,
    academicYearId,
    termId,
    sentBy,
    force = false,
    subjectStyle = 'legacy',
    mailProfile: profileOverride
  } = opts

  if (!force && transcriptAlreadySent(db, companyId, studentId, academicYearId, termId)) {
    return { ok: true, skipped: true, reason: 'already_sent' }
  }

  const transcript = loadCbcTranscript(db, companyId, {
    studentId,
    academicYearId,
    termId
  })

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId)
  const recipient = resolveGuardianEmail(student)
  if (!recipient) {
    throw new Error('No parent/guardian email on this student. Add guardian email on the fee ledger.')
  }

  const profile = profileOverride || resolveSchoolTranscriptMailProfile(db, companyId)
  const schoolName = profile.fromName || 'School'

  const pdfBuffer = await buildCbcTranscriptPdfBufferPreferred(transcript, { schoolName })

  const filename = progressReportAttachmentFilename(transcript)
  const subject =
    subjectStyle === 'school_branded'
      ? buildSubjectSchoolBranded(transcript, schoolName)
      : buildSubjectLegacy(transcript)

  const transporter = createTransporter(profile.smtp)

  await transporter.sendMail({
    from: profile.formattedFrom,
    to: recipient,
    subject,
    text: buildBody(transcript, schoolName),
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  })

  recordTranscriptSent(db, {
    companyId,
    studentId,
    academicYearId,
    termId,
    recipientEmail: recipient,
    sentBy
  })

  return { ok: true, sent: true, recipient }
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export async function sendStudentTranscriptEmail(
  db,
  { companyId, studentId, academicYearId, termId, sentBy, force = false }
) {
  const mailProfile = resolveLegacyMailProfile(db, companyId)
  return sendOneTranscriptEmail(db, {
    companyId,
    studentId,
    academicYearId,
    termId,
    sentBy,
    force,
    subjectStyle: 'legacy',
    mailProfile
  })
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export async function sendClassTranscriptEmails(
  db,
  { companyId, academicYearId, termId, classId, studentIds, sentBy, force = false }
) {
  let students
  if (Array.isArray(studentIds) && studentIds.length > 0) {
    const placeholders = studentIds.map(() => '?').join(',')
    students = db
      .prepare(
        `SELECT * FROM students WHERE company_id = ? AND status = 'active' AND id IN (${placeholders})`
      )
      .all(companyId, ...studentIds)
  } else if (classId) {
    students = db
      .prepare(
        `SELECT * FROM students WHERE company_id = ? AND status = 'active' AND TRIM(class_label) = ?`
      )
      .all(companyId, classId)
  } else {
    throw new Error('class_id or student_ids is required for bulk send')
  }

  const mailProfile = resolveLegacyMailProfile(db, companyId)
  const result = { sent: 0, skipped: 0, failed: 0, errors: [] }

  for (const student of students) {
    try {
      const out = await sendOneTranscriptEmail(db, {
        companyId,
        studentId: student.id,
        academicYearId,
        termId,
        sentBy,
        force,
        subjectStyle: 'legacy',
        mailProfile
      })
      if (out.skipped) result.skipped += 1
      else result.sent += 1
    } catch (e) {
      result.failed += 1
      result.errors.push({
        student_id: student.id,
        student_name: student.legal_name,
        message: e.message
      })
    }
  }

  return result
}

/**
 * School-branded subject + school SMTP preference; sequential queue with per-student outcomes.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{ companyId: string, studentIds: string[], academicYearId: string, termId: string, sentBy?: string | null, force?: boolean }} opts
 * @returns {Promise<{ successCount: number, skippedCount: number, failures: Array<{ studentId: string, error: string }> }>}
 */
export async function emailCbcTranscriptsToParents(db, opts) {
  const { companyId, studentIds, academicYearId, termId, sentBy, force = false } = opts
  const ids = Array.isArray(studentIds) ? [...new Set(studentIds.map((id) => String(id || '').trim()).filter(Boolean))] : []
  if (!ids.length) {
    throw new Error('student_ids must be a non-empty array')
  }

  let mailProfile
  try {
    mailProfile = resolveSchoolTranscriptMailProfile(db, companyId)
  } catch (e) {
    throw new Error(e.message)
  }

  let successCount = 0
  let skippedCount = 0
  const failures = []

  for (const studentId of ids) {
    try {
      const student = db
        .prepare(`SELECT id, company_id, status FROM students WHERE id = ? AND company_id = ?`)
        .get(studentId, companyId)
      if (!student || String(student.status) !== 'active') {
        failures.push({ studentId, error: 'Student not found or not active' })
        continue
      }

      const out = await sendOneTranscriptEmail(db, {
        companyId,
        studentId,
        academicYearId,
        termId,
        sentBy,
        force,
        subjectStyle: 'school_branded',
        mailProfile
      })

      if (out.skipped) {
        skippedCount += 1
        continue
      }
      successCount += 1
    } catch (e) {
      failures.push({ studentId, error: e.message || String(e) })
    }
  }

  return { successCount, skippedCount, failures }
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function getTranscriptEmailStatus(db, companyId, { academicYearId, termId, classId }) {
  let sql = `SELECT student_id, recipient_email, sent_at FROM cbc_transcript_email_log
    WHERE company_id = ? AND academic_year_id = ? AND term_id = ?`
  const params = [companyId, academicYearId, termId]
  if (classId) {
    sql += ` AND student_id IN (
      SELECT id FROM students WHERE company_id = ? AND TRIM(class_label) = ?
    )`
    params.push(companyId, classId)
  }
  const rows = db.prepare(sql).all(...params)
  return {
    sent: rows.map((r) => ({
      student_id: r.student_id,
      recipient_email: r.recipient_email,
      sent_at: r.sent_at
    }))
  }
}
