/**
 * Student class register (flat daily ledger) — separate from HR staff attendance.
 * @param {import('better-sqlite3').Database} db
 */
export function ensureStudentDailyAttendanceSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS student_daily_attendance (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      attendance_date TEXT NOT NULL,
      student_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'present'
        CHECK(status IN ('present', 'absent', 'late', 'excused')),
      session_type TEXT NOT NULL DEFAULT 'daily',
      marked_by TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(company_id) REFERENCES companies(id),
      FOREIGN KEY(student_id) REFERENCES students(id),
      UNIQUE(attendance_date, student_id, session_type)
    );
    CREATE INDEX IF NOT EXISTS idx_student_daily_att_company_date
      ON student_daily_attendance(company_id, attendance_date);
    CREATE INDEX IF NOT EXISTS idx_student_daily_att_class_date
      ON student_daily_attendance(company_id, class_id, attendance_date);
  `)
  const cols = db.prepare(`PRAGMA table_info(student_daily_attendance)`).all()
  if (!cols.some((c) => c.name === 'remarks')) {
    db.exec(`ALTER TABLE student_daily_attendance ADD COLUMN remarks TEXT`)
  }
}
