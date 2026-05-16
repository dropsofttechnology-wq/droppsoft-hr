/**
 * School fee ledger (students, terms, charges, payments) — per company.
 * Stubs schema aligned with SCHOOL_HR_INTEGRATION_BLUEPRINT; runs on API startup.
 * @param {import('better-sqlite3').Database} db
 */
export function ensureSchoolFeeLedgerSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS academic_years (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      label TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );
    CREATE INDEX IF NOT EXISTS idx_academic_years_company ON academic_years(company_id);

    CREATE TABLE IF NOT EXISTS academic_terms (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      academic_year_id TEXT NOT NULL,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
    );
    CREATE INDEX IF NOT EXISTS idx_academic_terms_company ON academic_terms(company_id);
    CREATE INDEX IF NOT EXISTS idx_academic_terms_year ON academic_terms(academic_year_id);

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      student_number TEXT NOT NULL,
      legal_name TEXT NOT NULL,
      dob TEXT,
      gender TEXT,
      class_label TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      guardian_summary TEXT,
      guardian_email TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );
    CREATE INDEX IF NOT EXISTS idx_students_company ON students(company_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_students_company_number ON students(company_id, student_number);

    CREATE TABLE IF NOT EXISTS fee_charges (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      academic_year_id TEXT,
      term_id TEXT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT '',
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (academic_year_id) REFERENCES academic_years(id),
      FOREIGN KEY (term_id) REFERENCES academic_terms(id)
    );
    CREATE INDEX IF NOT EXISTS idx_fee_charges_company ON fee_charges(company_id);
    CREATE INDEX IF NOT EXISTS idx_fee_charges_student ON fee_charges(student_id);
    CREATE INDEX IF NOT EXISTS idx_fee_charges_status ON fee_charges(company_id, status);

    CREATE TABLE IF NOT EXISTS fee_payments (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT '',
      paid_on TEXT NOT NULL,
      payment_method TEXT,
      reference TEXT,
      receipt_number TEXT,
      notes TEXT,
      recorded_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );
    CREATE INDEX IF NOT EXISTS idx_fee_payments_company ON fee_payments(company_id);
    CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON fee_payments(student_id);
    CREATE INDEX IF NOT EXISTS idx_fee_payments_paid_on ON fee_payments(company_id, paid_on);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_payments_receipt ON fee_payments(company_id, receipt_number)
      WHERE receipt_number IS NOT NULL AND receipt_number != '';
  `)
  const studentCols = db.prepare(`PRAGMA table_info(students)`).all()
  if (!studentCols.some((c) => c.name === 'guardian_email')) {
    db.exec(`ALTER TABLE students ADD COLUMN guardian_email TEXT`)
  }
}
