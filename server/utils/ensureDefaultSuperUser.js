import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { normalizeLocalEmail } from './localEmail.js'

const DEFAULT_USERNAMES = ['dropsuper', 'superuser']
const DEFAULT_PASSWORD = 'Drop@Soft#'

/**
 * Ensure auth-related columns exist on legacy databases.
 * @param {import('better-sqlite3').Database} db
 */
export function ensureAuthUserSchema(db) {
  const cols = db.prepare('PRAGMA table_info(sys_users)').all().map((c) => String(c.name || ''))
  if (!cols.includes('username')) {
    db.exec('ALTER TABLE sys_users ADD COLUMN username TEXT')
  }
  if (!cols.includes('must_change_password')) {
    db.exec('ALTER TABLE sys_users ADD COLUMN must_change_password INTEGER DEFAULT 0')
  }
  if (!cols.includes('registration_status')) {
    db.exec(`ALTER TABLE sys_users ADD COLUMN registration_status TEXT DEFAULT 'approved'`)
  }
  if (!cols.includes('approved_by')) {
    db.exec('ALTER TABLE sys_users ADD COLUMN approved_by TEXT')
  }
  if (!cols.includes('approved_at')) {
    db.exec('ALTER TABLE sys_users ADD COLUMN approved_at TEXT')
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_sys_users_username_unique
           ON sys_users(username) WHERE username IS NOT NULL`)
}

/**
 * Ensures built-in super admin accounts exist (idempotent). Called on API startup.
 * Both usernames map to @dropsoft.local and share the same default password.
 */
export function ensureDefaultSuperUser(db) {
  ensureAuthUserSchema(db)
  const hash = bcrypt.hashSync(DEFAULT_PASSWORD, 10)
  const now = new Date().toISOString()
  const insert = db.prepare(
    `INSERT INTO sys_users (
      id, email, username, password_hash, name, role, active, created_at,
      must_change_password, registration_status, approved_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, 0, 'approved', ?)`
  )
  const updateExisting = db.prepare(
    `UPDATE sys_users
     SET email = ?,
         username = ?,
         password_hash = ?,
         name = COALESCE(NULLIF(name, ''), 'Dropsoft Super Admin'),
         role = 'super_admin',
         active = 1,
         must_change_password = 0,
         registration_status = 'approved',
         approved_at = COALESCE(approved_at, ?)
     WHERE id = ?`
  )

  for (const user of DEFAULT_USERNAMES) {
    const email = normalizeLocalEmail(user)
    const existing = db
      .prepare(
        `SELECT id
         FROM sys_users
         WHERE LOWER(COALESCE(email, '')) = LOWER(?)
            OR LOWER(COALESCE(username, '')) = LOWER(?)
         LIMIT 1`
      )
      .get(email, user)
    if (existing?.id) {
      updateExisting.run(email, user, hash, now, existing.id)
      continue
    }
    insert.run(randomUUID(), email, user, hash, 'Dropsoft Super Admin', 'super_admin', now, now)
  }
}
