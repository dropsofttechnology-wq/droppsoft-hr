import { requireLocalUser } from './auth.js'

/**
 * Enforce role-based access using x-user-id resolved from sys_users.
 * @param {import('better-sqlite3').Database} db
 * @param {string[]} allowedRoles
 */
export function requireRoles(db, allowedRoles) {
  const auth = requireLocalUser(db)
  const stmt = db.prepare('SELECT role FROM sys_users WHERE id = ?')
  const allowed = new Set(allowedRoles.map((r) => String(r).toLowerCase()))

  return function roleGuard(req, res, next) {
    auth(req, res, () => {
      const row = stmt.get(req.userId)
      const role = String(row?.role || '').toLowerCase()
      if (!allowed.has(role)) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      req.userRole = role
      next()
    })
  }
}
