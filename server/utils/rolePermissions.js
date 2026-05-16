/**
 * Fine-grained permissions per login role (matrix edited by super admin on Users & roles).
 * super_admin always has every permission; their row is not persisted.
 */

/** Roles shown in the matrix (super_admin column is read-only, all allowed). */
export const MATRIX_ROLES = ['super_admin', 'admin', 'manager', 'cashier', 'approver', 'hod', 'employee', 'user']

/** Matches previous elevatedOnly: admin, manager, super_admin (not cashier). */
const DEF_ELEVATED = {
  super_admin: true,
  admin: true,
  manager: true,
  cashier: false,
  approver: false,
  hod: false,
  employee: false,
  user: false
}

/** Elevated + cashier (previous cashierOrHigher for attendance / face). */
const DEF_CASHIER_PLUS = {
  super_admin: true,
  admin: true,
  manager: true,
  cashier: true,
  approver: false,
  hod: false,
  employee: false,
  user: false
}

/** Previous userManagementRoles: admin, manager, super_admin. */
const DEF_USER_ADMIN = {
  super_admin: true,
  admin: true,
  manager: true,
  cashier: false,
  approver: false,
  hod: false,
  employee: false,
  user: false
}

/** Admin and manager (plus super_admin at runtime) — request approval workflows. */
const DEF_REQUEST_APPROVAL = {
  super_admin: true,
  admin: true,
  manager: true,
  cashier: false,
  approver: false,
  hod: false,
  employee: false,
  user: false
}

/** Non-employee staff could maintain employee records (admin, manager, cashier; not plain employee). */
const DEF_EMPLOYEE_CRUD = {
  super_admin: true,
  admin: true,
  manager: true,
  cashier: true,
  approver: false,
  hod: false,
  employee: false,
  user: false
}

/**
 * @typedef {{ key: string, label: string, description?: string, defaults: Record<string, boolean> }} PermissionDef
 */

/** @type {PermissionDef[]} — one row per major system function (aligned with API modules). */
export const PERMISSION_DEFINITIONS = [
  {
    key: 'manage_companies',
    label: 'Companies',
    description: 'Create and manage companies and organisation setup.',
    defaults: { ...DEF_ELEVATED }
  },
  {
    key: 'manage_employees',
    label: 'Employee records',
    description: 'Add, edit, and delete employee profiles and HR data.',
    defaults: { ...DEF_EMPLOYEE_CRUD }
  },
  {
    key: 'payroll_access',
    label: 'Payroll',
    description: 'Run payroll, calculations, and payroll-related processing.',
    defaults: { ...DEF_ELEVATED }
  },
  {
    key: 'payslips_access',
    label: 'Payslips',
    description: 'View and generate payslips.',
    defaults: { ...DEF_ELEVATED }
  },
  {
    key: 'attendance_management',
    label: 'Attendance',
    description: 'Clocking, attendance history, bulk attendance, and related tools.',
    defaults: { ...DEF_CASHIER_PLUS }
  },
  {
    key: 'face_terminal',
    label: 'Face enrollment & terminal',
    description: 'Face registration and attendance terminal / kiosk features.',
    defaults: { ...DEF_CASHIER_PLUS }
  },
  {
    key: 'leave_request_management',
    label: 'Leave requests (approve / edit)',
    description: 'Approve or reject leave; edit or delete leave requests.',
    defaults: { ...DEF_REQUEST_APPROVAL }
  },
  {
    key: 'leave_request_approval',
    label: 'Leave requests (approve / reject only)',
    description: 'Approve or reject leave requests without broader leave-management edits.',
    defaults: { ...DEF_REQUEST_APPROVAL }
  },
  {
    key: 'leave_request_deactivate',
    label: 'Leave requests (deactivate approved)',
    description: 'Mark approved leave as inactive (excluded from payroll and overlap checks).',
    defaults: {
      super_admin: true,
      admin: false,
      manager: false,
      cashier: false,
      approver: false,
      hod: false,
      employee: false,
      user: false
    }
  },
  {
    key: 'leave_types_config',
    label: 'Leave types',
    description: 'Configure leave types (codes, entitlements, pay rules).',
    defaults: { ...DEF_EMPLOYEE_CRUD }
  },
  {
    key: 'holidays_config',
    label: 'Public holidays',
    description: 'Add and manage company holiday calendar.',
    defaults: { ...DEF_ELEVATED }
  },
  {
    key: 'salary_advance_management',
    label: 'Salary advances',
    description:
      'Approve or reject requests; edit or delete requests; set payroll month and installments when creating advances for others.',
    defaults: { ...DEF_REQUEST_APPROVAL }
  },
  {
    key: 'salary_advance_approval',
    label: 'Salary advances (approve / reject only)',
    description: 'Approve or reject salary-advance requests without broader management edits.',
    defaults: { ...DEF_REQUEST_APPROVAL }
  },
  {
    key: 'salary_advance_deactivate',
    label: 'Salary advances (deactivate approved)',
    description: 'Reverse posted payroll deductions and void an approved salary advance.',
    defaults: {
      super_admin: true,
      admin: false,
      manager: false,
      cashier: false,
      approver: false,
      hod: false,
      employee: false,
      user: false
    }
  },
  {
    key: 'salary_shopping_management',
    label: 'Shopping deductions',
    description:
      'Approve or reject shopping requests; edit or delete requests; set payroll month and installments.',
    defaults: { ...DEF_REQUEST_APPROVAL }
  },
  {
    key: 'salary_shopping_approval',
    label: 'Shopping deductions (approve / reject only)',
    description: 'Approve or reject shopping requests without broader management edits.',
    defaults: { ...DEF_REQUEST_APPROVAL }
  },
  {
    key: 'statutory_compliance',
    label: 'Statutory & compliance',
    description: 'Statutory reports and compliance-related data.',
    defaults: { ...DEF_ELEVATED }
  },
  {
    key: 'app_settings',
    label: 'App & company settings',
    description: 'Application and company-wide settings.',
    defaults: { ...DEF_ELEVATED }
  },
  {
    key: 'employee_deductions',
    label: 'Employee deductions & benefits',
    description: 'Manage deductions, benefits, and related payroll adjustments.',
    defaults: { ...DEF_ELEVATED }
  },
  {
    key: 'period_closure',
    label: 'Period closure',
    description: 'Close or reopen payroll periods.',
    defaults: { ...DEF_ELEVATED }
  },
  {
    key: 'banks_master',
    label: 'Banks directory',
    description: 'Maintain bank master list used for payments.',
    defaults: { ...DEF_ELEVATED }
  },
  {
    key: 'audit_log',
    label: 'Audit log',
    description: 'View the audit trail of changes.',
    defaults: { ...DEF_ELEVATED }
  },
  {
    key: 'storage_branding',
    label: 'Company logos & files',
    description: 'Upload company logos and branding files (storage).',
    defaults: { ...DEF_ELEVATED }
  },
  {
    key: 'manage_users',
    label: 'User accounts',
    description: 'Create users and assign roles (not the permission matrix itself; that stays super-admin only).',
    defaults: { ...DEF_USER_ADMIN }
  },
  {
    key: 'fee_ledger',
    label: 'School fee ledger',
    description:
      'Manage students, academic years/terms, fee charges, and fee payments (stub ledger for school fees; local API).',
    defaults: { ...DEF_CASHIER_PLUS }
  },
  {
    key: 'school_attendance',
    label: 'Student attendance register',
    description:
      'Take daily class attendance for students (separate from staff clock-in; local API). Uses class labels from the fee ledger.',
    defaults: { ...DEF_CASHIER_PLUS }
  },
  {
    key: 'cbc_grading',
    label: 'CBC grading & assessments',
    description:
      'Configure learning areas and strands, record Kenyan CBC performance levels (EE/ME/AE/BE), and print learner progress reports.',
    defaults: { ...DEF_CASHIER_PLUS }
  },
  {
    key: 'operational_expenses',
    label: 'School operational expenses',
    description:
      'Record and edit school running costs (utilities, supplies, vendors). Draft expenses can be edited or deleted.',
    defaults: { ...DEF_CASHIER_PLUS }
  },
  {
    key: 'operational_expenses_approval',
    label: 'School expenses (approve / pay / void)',
    description: 'Approve, reject, mark as paid, or void operational expense records.',
    defaults: {
      super_admin: true,
      admin: true,
      manager: true,
      cashier: false,
      approver: true,
      hod: false,
      employee: false,
      user: false
    }
  }
]

const DEF_BY_KEY = Object.fromEntries(PERMISSION_DEFINITIONS.map((d) => [d.key, d]))

const REQUEST_APPROVAL_PERMISSION_KEYS = [
  'leave_request_management',
  'leave_request_approval',
  'salary_advance_management',
  'salary_advance_approval',
  'salary_shopping_management',
  'salary_shopping_approval'
]

const REQUEST_APPROVAL_POLICY_VERSION = 2

/**
 * @param {import('better-sqlite3').Database} db
 */
function applyRequestApprovalPolicyMigration(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hr_schema_flags (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)
  const row = db.prepare("SELECT value FROM hr_schema_flags WHERE key = 'request_approval_policy_v'").get()
  if (row && Number(row.value) >= REQUEST_APPROVAL_POLICY_VERSION) return

  const upsert = db.prepare(
    `INSERT INTO role_permissions (role, permission_key, allowed)
     VALUES (?, ?, ?)
     ON CONFLICT(role, permission_key) DO UPDATE SET allowed = excluded.allowed`
  )

  for (const permissionKey of REQUEST_APPROVAL_PERMISSION_KEYS) {
    const def = DEF_BY_KEY[permissionKey]
    if (!def) continue
    for (const role of MATRIX_ROLES) {
      if (role === 'super_admin') continue
      upsert.run(role, permissionKey, def.defaults[role] ? 1 : 0)
    }
  }

  db.prepare(
    `INSERT INTO hr_schema_flags (key, value) VALUES ('request_approval_policy_v', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(REQUEST_APPROVAL_POLICY_VERSION))
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function ensureRolePermissionsSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role TEXT NOT NULL,
      permission_key TEXT NOT NULL,
      allowed INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (role, permission_key)
    )
  `)

  const insert = db.prepare(
    `INSERT OR IGNORE INTO role_permissions (role, permission_key, allowed)
     VALUES (?, ?, ?)`
  )

  for (const def of PERMISSION_DEFINITIONS) {
    for (const role of MATRIX_ROLES) {
      if (role === 'super_admin') continue
      const allowed = def.defaults[role] ? 1 : 0
      insert.run(role, def.key, allowed)
    }
  }

  applyRequestApprovalPolicyMigration(db)
}

/**
 * @param {string} role
 * @param {string} permissionKey
 */
function defaultAllowed(role, permissionKey) {
  const def = DEF_BY_KEY[permissionKey]
  if (!def) return false
  const r = String(role || '').toLowerCase()
  if (r === 'super_admin') return true
  return !!def.defaults[r]
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} role
 * @param {string} permissionKey
 */
export function roleHasPermission(db, role, permissionKey) {
  const r = String(role || '').toLowerCase()
  if (r === 'super_admin') return true
  if (!DEF_BY_KEY[permissionKey]) return false
  const row = db
    .prepare('SELECT allowed FROM role_permissions WHERE role = ? AND permission_key = ?')
    .get(r, permissionKey)
  if (row && typeof row.allowed === 'number') return row.allowed === 1
  return defaultAllowed(r, permissionKey)
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} role
 * @returns {Record<string, boolean>}
 */
export function getRolePermissionMap(db, role) {
  const out = {}
  for (const def of PERMISSION_DEFINITIONS) {
    out[def.key] = roleHasPermission(db, role, def.key)
  }
  return out
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function getRolePermissionsPayload(db) {
  const permissions = PERMISSION_DEFINITIONS.map((def) => {
    const byRole = {}
    for (const role of MATRIX_ROLES) {
      if (role === 'super_admin') {
        byRole[role] = true
        continue
      }
      const row = db
        .prepare('SELECT allowed FROM role_permissions WHERE role = ? AND permission_key = ?')
        .get(role, def.key)
      if (row && typeof row.allowed === 'number') {
        byRole[role] = row.allowed === 1
      } else {
        byRole[role] = !!def.defaults[role]
      }
    }
    return {
      key: def.key,
      label: def.label,
      description: def.description || '',
      byRole
    }
  })
  return { permissions, roles: MATRIX_ROLES }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {Record<string, Record<string, boolean>>} matrix permissionKey -> role -> allowed
 */
export function saveRolePermissionsMatrix(db, matrix) {
  const upsert = db.prepare(
    `INSERT INTO role_permissions (role, permission_key, allowed)
     VALUES (?, ?, ?)
     ON CONFLICT(role, permission_key) DO UPDATE SET allowed = excluded.allowed`
  )

  for (const def of PERMISSION_DEFINITIONS) {
    const row = matrix[def.key]
    if (!row || typeof row !== 'object') continue
    for (const role of MATRIX_ROLES) {
      if (role === 'super_admin') continue
      if (!Object.prototype.hasOwnProperty.call(row, role)) continue
      const allowed = row[role] ? 1 : 0
      upsert.run(role, def.key, allowed)
    }
  }
}
