import { requireLocalUser } from './auth.js'
import { roleHasPermission } from '../utils/rolePermissions.js'

/**
 * Require a logged-in user whose role has the given permission in the super-admin matrix.
 * Sets req.userRole like requireRoles.
 * @param {import('better-sqlite3').Database} db
 * @param {string} permissionKey
 */
export function requirePermission(db, permissionKey) {
  const auth = requireLocalUser(db)
  const stmt = db.prepare('SELECT role FROM sys_users WHERE id = ?')
  return function permissionGuard(req, res, next) {
    auth(req, res, () => {
      const row = stmt.get(req.userId)
      const role = String(row?.role || '').toLowerCase()
      req.userRole = role
      if (!roleHasPermission(db, role, permissionKey)) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      next()
    })
  }
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string[]} permissionKeys
 */
export function requireAnyPermission(db, permissionKeys) {
  const auth = requireLocalUser(db)
  const stmt = db.prepare('SELECT role FROM sys_users WHERE id = ?')
  const keys = Array.isArray(permissionKeys) ? permissionKeys.filter(Boolean) : []
  return function anyPermissionGuard(req, res, next) {
    auth(req, res, () => {
      const row = stmt.get(req.userId)
      const role = String(row?.role || '').toLowerCase()
      req.userRole = role
      const ok = keys.some((k) => roleHasPermission(db, role, k))
      if (!ok) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      next()
    })
  }
}
