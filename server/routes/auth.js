import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { requireLocalUser } from '../middleware/auth.js'
import { normalizeLocalEmail } from '../utils/localEmail.js'
import { getRolePermissionMap } from '../utils/rolePermissions.js'

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createAuthRoutes(db) {
  const r = Router()

  r.post('/login', (req, res) => {
    try {
      const { email, username, identifier, password } = req.body || {}
      const rawIdentifier = String(identifier || username || email || '').trim()
      if (!rawIdentifier || !password) {
        return res.status(400).json({ error: 'Username/email and password required' })
      }
      const normalized = normalizeLocalEmail(rawIdentifier)
      const uname = rawIdentifier.toLowerCase()
      const row = db.prepare(
        `SELECT * FROM sys_users
         WHERE LOWER(COALESCE(email, '')) = ?
            OR LOWER(COALESCE(username, '')) = ?
         LIMIT 1`
      ).get(normalized, uname)
      if (!row) {
        return res.status(401).json({ error: 'Invalid username/email or password' })
      }
      const status = String(row.registration_status || '').toLowerCase()
      if (!Number(row.active || 0)) {
        if (status === 'pending_approval') {
          return res.status(403).json({ error: 'Account pending admin approval' })
        }
        return res.status(403).json({ error: 'Account is inactive. Contact your administrator.' })
      }
      if (!row?.password_hash) {
        return res.status(401).json({ error: 'Invalid username/email or password' })
      }
      if (!bcrypt.compareSync(password, row.password_hash)) {
        return res.status(401).json({ error: 'Invalid username/email or password' })
      }
      res.json({
        user: {
          id: row.id,
          email: row.email,
          username: row.username || null,
          name: row.name || row.email,
          role: row.role || 'user',
          must_change_password: Number(row.must_change_password || 0) ? true : false,
          permissions: getRolePermissionMap(db, row.role || 'user')
        },
        must_change_password: Number(row.must_change_password || 0) ? true : false
      })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/register', (req, res) => {
    try {
      const { email, username, password, name } = req.body || {}
      if (!email || !username || !password) {
        return res.status(400).json({ error: 'Email, username and password required' })
      }
      const usernameNorm = String(username).trim().toLowerCase()
      if (!/^[a-z0-9._-]{3,40}$/.test(usernameNorm)) {
        return res.status(400).json({
          error: 'Username must be 3-40 characters and can only contain letters, numbers, dot, underscore, and hyphen'
        })
      }
      const hash = bcrypt.hashSync(password, 10)
      const id = randomUUID()
      const now = new Date().toISOString()
      const normalized = normalizeLocalEmail(email)
      const displayName = name || normalized.split('@')[0]
      const dup = db
        .prepare('SELECT id FROM sys_users WHERE LOWER(email) = ? OR LOWER(COALESCE(username, \'\')) = ? LIMIT 1')
        .get(normalized, usernameNorm)
      if (dup) {
        return res.status(409).json({ error: 'An account with this email or username already exists' })
      }
      db.prepare(
        `INSERT INTO sys_users (
          id, email, username, password_hash, name, role, active, created_at,
          must_change_password, registration_status
        )
         VALUES (?, ?, ?, ?, ?, 'employee', 0, ?, 0, 'pending_approval')`
      ).run(id, normalized, usernameNorm, hash, displayName, now)
      res.json({
        ok: true,
        message: 'Registration submitted. Your account will be activated by an administrator.'
      })
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return res.status(409).json({ error: 'An account with this email or username already exists' })
      }
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/me', requireLocalUser(db), (req, res) => {
    try {
      const row = db
        .prepare('SELECT id, email, username, name, role, must_change_password FROM sys_users WHERE id = ?')
        .get(req.userId)
      if (!row) return res.status(401).json({ error: 'Invalid user' })
      res.json({
        user: {
          id: row.id,
          email: row.email,
          username: row.username || null,
          name: row.name || row.email,
          role: row.role || 'user',
          must_change_password: Number(row.must_change_password || 0) ? true : false,
          permissions: getRolePermissionMap(db, row.role || 'user')
        }
      })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/change-password', requireLocalUser(db), (req, res) => {
    try {
      const { current_password, new_password } = req.body || {}
      if (!current_password || !new_password) {
        return res.status(400).json({ error: 'current_password and new_password are required' })
      }
      if (String(new_password).length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' })
      }
      const row = db.prepare('SELECT id, password_hash FROM sys_users WHERE id = ?').get(req.userId)
      if (!row?.password_hash || !bcrypt.compareSync(String(current_password), row.password_hash)) {
        return res.status(401).json({ error: 'Current password is incorrect' })
      }
      const hash = bcrypt.hashSync(String(new_password), 10)
      db.prepare('UPDATE sys_users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hash, req.userId)
      res.json({ ok: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // Self-service reset from login page (local mode): username/email + new password.
  r.post('/reset-password', (req, res) => {
    try {
      const { identifier, new_password } = req.body || {}
      const rawIdentifier = String(identifier || '').trim()
      if (!rawIdentifier || !new_password) {
        return res.status(400).json({ error: 'identifier and new_password are required' })
      }
      if (String(new_password).length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' })
      }
      const normalized = normalizeLocalEmail(rawIdentifier)
      const uname = rawIdentifier.toLowerCase()
      const row = db.prepare(
        `SELECT id, active, registration_status
         FROM sys_users
         WHERE LOWER(COALESCE(email, '')) = ?
            OR LOWER(COALESCE(username, '')) = ?
         LIMIT 1`
      ).get(normalized, uname)
      if (!row) {
        return res.status(404).json({ error: 'Account not found' })
      }
      const status = String(row.registration_status || '').toLowerCase()
      if (!Number(row.active || 0) || status === 'pending_approval' || status === 'rejected') {
        return res.status(403).json({ error: 'Account is not active. Contact your administrator.' })
      }
      const hash = bcrypt.hashSync(String(new_password), 10)
      db.prepare('UPDATE sys_users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(hash, row.id)
      res.json({ ok: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  return r
}
