/**
 * Validates x-user-id against sys_users (local auth; no Appwrite session).
 * @param {import('better-sqlite3').Database} db
 */
export function requireLocalUser(db) {
  const stmt = db.prepare(
    'SELECT id FROM sys_users WHERE id = ? AND COALESCE(active, 1) = 1'
  )
  return function requireLocalUserMiddleware(req, res, next) {
    const id = req.headers['x-user-id']
    if (!id || typeof id !== 'string') {
      return res.status(401).json({ error: 'Missing or invalid x-user-id' })
    }
    const row = stmt.get(id.trim())
    if (!row) {
      return res.status(401).json({ error: 'Unknown or inactive user' })
    }
    req.userId = id.trim()
    next()
  }
}
