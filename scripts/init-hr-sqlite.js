/**
 * Creates hr.db schema for standalone Dropsoft HR (SQLite).
 * Run: npm run init:sqlite
 *
 * Data directory: %APPDATA%\\DropsoftHR (Windows) â€” see server/paths.js
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadBetterSqlite3 } from '../server/loadBetterSqlite3.js'

const Database = loadBetterSqlite3()
import { getDataDir, getDbPath } from '../server/paths.js'
import { ensureSubscriptionSchema } from '../server/utils/subscriptionQueries.js'

const DDL = `
CREATE TABLE IF NOT EXISTS sys_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  username TEXT UNIQUE,
  password_hash TEXT,
  name TEXT,
  role TEXT DEFAULT 'user',
  active INTEGER DEFAULT 1,
  must_change_password INTEGER DEFAULT 0,
  registration_status TEXT DEFAULT 'approved',
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  registration_number TEXT,
  tax_pin TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  company_id TEXT NOT NULL,
  employee_id TEXT,
  staff_no TEXT,
  name TEXT NOT NULL,
  id_number TEXT,
  kra_pin TEXT,
  nssf_number TEXT,
  shif_number TEXT,
  department TEXT,
  position TEXT,
  basic_salary REAL NOT NULL,
  phone TEXT,
  email TEXT,
  bank_account TEXT,
  bank_name TEXT,
  bank_branch TEXT,
  contract_start_date TEXT,
  contract_end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  role TEXT DEFAULT 'employee',
  gender TEXT,
  annual_leave_entitlement_days REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);
CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_user ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  date TEXT NOT NULL,
  clock_in_time TEXT,
  clock_out_time TEXT,
  hours_worked REAL,
  overtime_hours REAL,
  auth_method TEXT,
  location_lat REAL,
  location_lng REAL,
  location_address TEXT,
  reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_company ON attendance(company_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  period TEXT NOT NULL,
  basic_salary REAL NOT NULL,
  allowances REAL,
  gross_pay REAL NOT NULL,
  shif_employee REAL,
  shif_employer REAL,
  nssf_employee REAL,
  nssf_employer REAL,
  ahl_employee REAL,
  ahl_employer REAL,
  taxable_pay REAL,
  paye REAL,
  other_deductions REAL,
  net_pay REAL NOT NULL,
  overtime_hours REAL,
  overtime_pay REAL,
  holiday_pay REAL,
  absence_deduction REAL,
  housing_allowance REAL,
  standard_allowance REAL,
  total_earn REAL,
  shopping_amount REAL,
  advance_amount REAL,
  pension_employee REAL,
  calculated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payroll_company ON payroll_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_payroll_employee ON payroll_runs(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_period ON payroll_runs(period);

CREATE TABLE IF NOT EXISTS face_descriptors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  company_id TEXT NOT NULL,
  descriptor TEXT NOT NULL,
  quality_score REAL,
  capture_method TEXT,
  registered_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_face_company ON face_descriptors(company_id);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  setting_key TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_settings_company ON settings(company_id);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(setting_key);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  old_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

CREATE TABLE IF NOT EXISTS holidays (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  holiday_date TEXT NOT NULL,
  name TEXT,
  status TEXT,
  rate_type TEXT,
  rate REAL,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_holidays_company ON holidays(company_id);

CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  leave_type TEXT,
  start_date TEXT,
  end_date TEXT,
  days_requested INTEGER,
  reason TEXT,
  balance_deduction TEXT,
  status TEXT,
  created_by TEXT,
  admin_form_notes TEXT,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_leave_company ON leave_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_requests(employee_id);

CREATE TABLE IF NOT EXISTS leave_types (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT,
  days_allowed INTEGER,
  description TEXT,
  status TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS banks (
  id TEXT PRIMARY KEY,
  name TEXT,
  code TEXT,
  status TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS period_closures (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  period TEXT NOT NULL,
  closed_by TEXT,
  closed_at TEXT,
  notes TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_period_company ON period_closures(company_id);

CREATE TABLE IF NOT EXISTS employee_deductions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  period TEXT,
  absent_days INTEGER,
  advance_amount REAL,
  shopping_amount REAL,
  notes TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_empded_company ON employee_deductions(company_id);
CREATE INDEX IF NOT EXISTS idx_empded_employee ON employee_deductions(employee_id);

CREATE TABLE IF NOT EXISTS salary_advance_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  amount REAL NOT NULL,
  reason TEXT,
  repayment_period TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TEXT,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  for_period TEXT,
  application_date TEXT,
  installment_count INTEGER,
  admin_form_notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_sar_company ON salary_advance_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_sar_employee ON salary_advance_requests(employee_id);
CREATE TABLE IF NOT EXISTS shopping_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  amount REAL NOT NULL,
  reason TEXT,
  repayment_period TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TEXT,
  requested_by TEXT,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  for_period TEXT,
  application_date TEXT,
  installment_count INTEGER,
  installment_plan TEXT,
  item_lines_json TEXT,
  admin_form_notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_shr_company ON shopping_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_shr_employee ON shopping_requests(employee_id);

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
`

function migrate(db) {
  const colNames = (table) =>
    db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)

  const su = colNames('sys_users')
  if (!su.includes('name')) {
    db.exec('ALTER TABLE sys_users ADD COLUMN name TEXT')
  }
  if (!su.includes('username')) {
    db.exec('ALTER TABLE sys_users ADD COLUMN username TEXT')
  }
  if (!su.includes('must_change_password')) {
    db.exec('ALTER TABLE sys_users ADD COLUMN must_change_password INTEGER DEFAULT 0')
  }
  if (!su.includes('registration_status')) {
    db.exec("ALTER TABLE sys_users ADD COLUMN registration_status TEXT DEFAULT 'approved'")
  }
  if (!su.includes('approved_by')) {
    db.exec('ALTER TABLE sys_users ADD COLUMN approved_by TEXT')
  }
  if (!su.includes('approved_at')) {
    db.exec('ALTER TABLE sys_users ADD COLUMN approved_at TEXT')
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_sys_users_username_unique
           ON sys_users(username) WHERE username IS NOT NULL`)

  const em = colNames('employees')
  if (!em.includes('role')) {
    db.exec("ALTER TABLE employees ADD COLUMN role TEXT DEFAULT 'employee'")
  }
  if (!em.includes('gender')) {
    db.exec('ALTER TABLE employees ADD COLUMN gender TEXT')
  }

  const bk = colNames('banks')
  if (!bk.includes('swift_code')) {
    db.exec('ALTER TABLE banks ADD COLUMN swift_code TEXT')
  }

  const hol = colNames('holidays')
  if (!hol.includes('reporting_time')) {
    db.exec('ALTER TABLE holidays ADD COLUMN reporting_time TEXT')
  }
  if (!hol.includes('closing_time')) {
    db.exec('ALTER TABLE holidays ADD COLUMN closing_time TEXT')
  }

  const lt = colNames('leave_types')
  if (!lt.includes('leave_code')) {
    db.exec('ALTER TABLE leave_types ADD COLUMN leave_code TEXT')
  }
  if (!lt.includes('display_order')) {
    db.exec('ALTER TABLE leave_types ADD COLUMN display_order INTEGER DEFAULT 0')
  }
  if (!lt.includes('is_statutory')) {
    db.exec('ALTER TABLE leave_types ADD COLUMN is_statutory INTEGER DEFAULT 0')
  }
  if (!lt.includes('pay_percentage')) {
    db.exec('ALTER TABLE leave_types ADD COLUMN pay_percentage REAL DEFAULT 100')
    db.prepare(`UPDATE leave_types SET pay_percentage = 0 WHERE UPPER(COALESCE(leave_code, '')) = 'UNPAID'`).run()
  }

  const sar = colNames('salary_advance_requests')
  if (sar.length && !sar.includes('for_period')) {
    db.exec('ALTER TABLE salary_advance_requests ADD COLUMN for_period TEXT')
  }
  if (sar.length && !sar.includes('application_date')) {
    db.exec('ALTER TABLE salary_advance_requests ADD COLUMN application_date TEXT')
  }
  if (sar.length && !sar.includes('installment_count')) {
    db.exec('ALTER TABLE salary_advance_requests ADD COLUMN installment_count INTEGER')
  }

  const lr = colNames('leave_requests')
  if (lr.length && !lr.includes('balance_deduction')) {
    db.exec(
      `ALTER TABLE leave_requests ADD COLUMN balance_deduction TEXT`
    )
  }
  if (lr.length && !lr.includes('created_by')) {
    db.exec(`ALTER TABLE leave_requests ADD COLUMN created_by TEXT`)
  }
  if (lr.length && !lr.includes('admin_form_notes')) {
    db.exec(`ALTER TABLE leave_requests ADD COLUMN admin_form_notes TEXT`)
  }
  if (sar.length && !sar.includes('admin_form_notes')) {
    db.exec(`ALTER TABLE salary_advance_requests ADD COLUMN admin_form_notes TEXT`)
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS salary_advance_requests (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT,
      repayment_period TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_at TEXT,
      approved_by TEXT,
      approved_at TEXT,
      created_at TEXT,
      updated_at TEXT,
      for_period TEXT,
      application_date TEXT,
      installment_count INTEGER,
      admin_form_notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sar_company ON salary_advance_requests(company_id);
    CREATE INDEX IF NOT EXISTS idx_sar_employee ON salary_advance_requests(employee_id);
CREATE TABLE IF NOT EXISTS shopping_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  amount REAL NOT NULL,
  reason TEXT,
  repayment_period TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TEXT,
  requested_by TEXT,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  for_period TEXT,
  application_date TEXT,
  installment_count INTEGER,
  installment_plan TEXT,
  admin_form_notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_shr_company ON shopping_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_shr_employee ON shopping_requests(employee_id);
  `)
}

/** Create schema at `dbPath` (parent dirs created). Used by CLI and Electron first-run. */
export function runSqliteBootstrap(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(DDL)
  migrate(db)
  ensureSubscriptionSchema(db)
  db.close()
}

function cliMain() {
  fs.mkdirSync(getDataDir(), { recursive: true })
  const dbPath = getDbPath()
  runSqliteBootstrap(dbPath)
  console.log('SQLite schema ready at:', dbPath)
}

const __filename = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  cliMain()
}

