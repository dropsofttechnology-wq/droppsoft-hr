/**
 * Role → default permission when `user.prefs.permissions` has no explicit entry for a key.
 * Must stay aligned with server/utils/rolePermissions.js PERMISSION_DEFINITIONS[].defaults.
 */

const E = {
  super_admin: true,
  admin: true,
  manager: true,
  cashier: false,
  approver: false,
  hod: false,
  employee: false,
  user: false
}

const CASHIER_PLUS = {
  super_admin: true,
  admin: true,
  manager: true,
  cashier: true,
  approver: false,
  hod: false,
  employee: false,
  user: false
}

const USER_ADMIN = {
  super_admin: true,
  admin: true,
  manager: true,
  cashier: false,
  approver: false,
  hod: false,
  employee: false,
  user: false
}

const REQ_APP = {
  super_admin: true,
  admin: true,
  manager: true,
  cashier: false,
  approver: false,
  hod: false,
  employee: false,
  user: false
}

const EMP_CRUD = {
  super_admin: true,
  admin: true,
  manager: true,
  cashier: true,
  approver: false,
  hod: false,
  employee: false,
  user: false
}

const SA_ONLY = {
  super_admin: true,
  admin: false,
  manager: false,
  cashier: false,
  approver: false,
  hod: false,
  employee: false,
  user: false
}

/** @type {Record<string, Record<string, boolean>>} */
export const PERMISSION_DEFAULT_BY_KEY = {
  manage_companies: { ...E },
  manage_employees: { ...EMP_CRUD },
  payroll_access: { ...E },
  payslips_access: { ...E },
  attendance_management: { ...CASHIER_PLUS },
  face_terminal: { ...CASHIER_PLUS },
  leave_request_management: { ...REQ_APP },
  leave_request_approval: { ...REQ_APP },
  leave_request_deactivate: { ...SA_ONLY },
  leave_types_config: { ...EMP_CRUD },
  holidays_config: { ...E },
  salary_advance_management: { ...REQ_APP },
  salary_advance_approval: { ...REQ_APP },
  salary_advance_deactivate: { ...SA_ONLY },
  salary_shopping_management: { ...REQ_APP },
  salary_shopping_approval: { ...REQ_APP },
  statutory_compliance: { ...E },
  app_settings: { ...E },
  employee_deductions: { ...E },
  period_closure: { ...E },
  banks_master: { ...E },
  audit_log: { ...E },
  storage_branding: { ...E },
  manage_users: { ...USER_ADMIN },
  fee_ledger: { ...CASHIER_PLUS },
  school_attendance: { ...CASHIER_PLUS },
  cbc_grading: { ...CASHIER_PLUS },
  operational_expenses: { ...CASHIER_PLUS },
  operational_expenses_approval: {
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

/**
 * @param {string} role
 * @param {string} permissionKey
 */
export function defaultRoleAllows(role, permissionKey) {
  const r = String(role || '').toLowerCase()
  if (r === 'super_admin') return true
  const row = PERMISSION_DEFAULT_BY_KEY[permissionKey]
  if (!row) return false
  return !!row[r]
}
