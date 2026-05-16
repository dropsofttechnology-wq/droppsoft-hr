/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} userId
 */
export function getUserRole(db, userId) {
  const row = db.prepare('SELECT role FROM sys_users WHERE id = ?').get(userId)
  return String(row?.role || '').toLowerCase()
}

/** Roles that can approve requests and manage HR data (not plain employees). */
export function isStaffElevatedRole(role) {
  return ['admin', 'super_admin', 'manager', 'cashier'].includes(String(role || '').toLowerCase())
}
