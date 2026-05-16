/**
 * Kenyan CBC grading: subjects, strands, performance marks.
 * @param {import('better-sqlite3').Database} db
 */
export function ensureSchoolCbcGradingSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS school_subjects (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      subject_name TEXT NOT NULL,
      subject_code TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(company_id) REFERENCES companies(id)
    );
    CREATE INDEX IF NOT EXISTS idx_school_subjects_company ON school_subjects(company_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_school_subjects_company_code
      ON school_subjects(company_id, subject_code)
      WHERE subject_code IS NOT NULL AND TRIM(subject_code) != '';

    CREATE TABLE IF NOT EXISTS school_subject_strands (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      grade_level TEXT NOT NULL,
      strand_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(company_id) REFERENCES companies(id),
      FOREIGN KEY(subject_id) REFERENCES school_subjects(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_school_strands_company ON school_subject_strands(company_id);
    CREATE INDEX IF NOT EXISTS idx_school_strands_subject_grade
      ON school_subject_strands(company_id, subject_id, grade_level);

    CREATE TABLE IF NOT EXISTS student_performance_marks (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      academic_year_id TEXT NOT NULL,
      term_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      strand_id TEXT NOT NULL,
      performance_level INTEGER NOT NULL CHECK(performance_level IN (1, 2, 3, 4)),
      teacher_remarks TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(company_id) REFERENCES companies(id),
      FOREIGN KEY(student_id) REFERENCES students(id),
      FOREIGN KEY(academic_year_id) REFERENCES academic_years(id),
      FOREIGN KEY(term_id) REFERENCES academic_terms(id),
      FOREIGN KEY(strand_id) REFERENCES school_subject_strands(id) ON DELETE CASCADE,
      UNIQUE(academic_year_id, term_id, student_id, strand_id)
    );
    CREATE INDEX IF NOT EXISTS idx_perf_marks_student ON student_performance_marks(company_id, student_id);
    CREATE INDEX IF NOT EXISTS idx_perf_marks_term ON student_performance_marks(company_id, term_id);

    CREATE TABLE IF NOT EXISTS cbc_transcript_email_log (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      academic_year_id TEXT NOT NULL,
      term_id TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      sent_by TEXT,
      FOREIGN KEY(company_id) REFERENCES companies(id),
      FOREIGN KEY(student_id) REFERENCES students(id),
      FOREIGN KEY(academic_year_id) REFERENCES academic_years(id),
      FOREIGN KEY(term_id) REFERENCES academic_terms(id),
      UNIQUE(company_id, student_id, academic_year_id, term_id)
    );
    CREATE INDEX IF NOT EXISTS idx_cbc_email_log_term ON cbc_transcript_email_log(company_id, term_id);

    CREATE TABLE IF NOT EXISTS school_email_settings (
      company_id TEXT PRIMARY KEY NOT NULL,
      host TEXT NOT NULL DEFAULT '',
      port INTEGER NOT NULL DEFAULT 587,
      secure INTEGER NOT NULL DEFAULT 0,
      auth_user TEXT NOT NULL DEFAULT '',
      auth_pass TEXT NOT NULL DEFAULT '',
      sender_name TEXT NOT NULL DEFAULT '',
      sender_email TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      FOREIGN KEY(company_id) REFERENCES companies(id)
    );
  `)
}
