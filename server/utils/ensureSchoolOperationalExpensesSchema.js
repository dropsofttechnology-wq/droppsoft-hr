/**
 * School / institution operational expenses (per company).
 * Runs on API startup so existing hr.db files gain tables without re-init.
 * @param {import('better-sqlite3').Database} db
 */
export function ensureSchoolOperationalExpensesSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS expense_categories (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      parent_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (parent_id) REFERENCES expense_categories(id)
    );
    CREATE INDEX IF NOT EXISTS idx_expense_categories_company ON expense_categories(company_id);

    CREATE TABLE IF NOT EXISTS expense_suppliers (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      tax_id TEXT,
      phone TEXT,
      email TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );
    CREATE INDEX IF NOT EXISTS idx_expense_suppliers_company ON expense_suppliers(company_id);

    CREATE TABLE IF NOT EXISTS operational_expenses (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      supplier_id TEXT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT '',
      tax_amount REAL,
      incurred_on TEXT NOT NULL,
      paid_on TEXT,
      payment_method TEXT,
      reference TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      linked_employee_id TEXT,
      attachment_ids_json TEXT,
      void_reason TEXT,
      notes TEXT,
      rejected_reason TEXT,
      created_by TEXT,
      approved_by TEXT,
      approved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (category_id) REFERENCES expense_categories(id),
      FOREIGN KEY (supplier_id) REFERENCES expense_suppliers(id)
    );
    CREATE INDEX IF NOT EXISTS idx_operational_expenses_company ON operational_expenses(company_id);
    CREATE INDEX IF NOT EXISTS idx_operational_expenses_status ON operational_expenses(company_id, status);
    CREATE INDEX IF NOT EXISTS idx_operational_expenses_incurred ON operational_expenses(company_id, incurred_on);
  `)
}
