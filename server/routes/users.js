import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { normalizeLocalEmail } from '../utils/localEmail.js'

const ALLOWED_ROLES = ['super_admin', 'admin', 'manager', 'cashier', 'approver', 'hod', 'employee', 'user']

/**
 * @param {string} actorRole
 * @param {string} targetRole
 */
function mayAssignRole(actorRole, targetRole) {
  const t = String(targetRole || '').toLowerCase()
  if (t === 'super_admin') return String(actorRole || '').toLowerCase() === 'super_admin'
  return true
}

/**
 * @param {string} actorRole
 * @param {{ role?: string }} targetUser
 */
function mayModifyUserRecord(actorRole, targetUser) {
  const a = String(actorRole || '').toLowerCase()
  if (a === 'super_admin') return true
  const tr = String(targetUser?.role || '').toLowerCase()
  return tr !== 'super_admin'
}

/**
 * List, create, and assign login roles (sys_users).
 * Mount with requireRoles(db, ['admin','super_admin','manager']).
 * @param {import('better-sqlite3').Database} db
 */
export function createUsersRoutes(db) {
  const r = Router()

  r.get('/', (req, res) => {
    try {
      const rows = db
        .prepare(
          `SELECT id, email, username, name, role, active, must_change_password, registration_status, approved_at, created_at
           FROM sys_users ORDER BY email`
        )
        .all()
      res.json(rows)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/', (req, res) => {
    try {
      const actor = String(req.userRole || '').toLowerCase()
      const { email, username, password, name, role } = req.body || {}
      if (!email || !username || !password) {
        return res.status(400).json({ error: 'Email, username and password required' })
      }
      if (String(password).length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' })
      }
      const newRole = String(role || 'employee').toLowerCase().trim()
      if (!ALLOWED_ROLES.includes(newRole)) {
        return res.status(400).json({ error: `role must be one of: ${ALLOWED_ROLES.join(', ')}` })
      }
      if (!mayAssignRole(actor, newRole)) {
        return res.status(403).json({ error: 'Only a super admin can create an account with the super admin role' })
      }

      const normalized = normalizeLocalEmail(email)
      const usernameNorm = String(username).trim().toLowerCase()
      if (!/^[a-z0-9._-]{3,40}$/.test(usernameNorm)) {
        return res.status(400).json({
          error: 'Username must be 3-40 characters and can only contain letters, numbers, dot, underscore, and hyphen'
        })
      }
      const dup = db
        .prepare('SELECT id FROM sys_users WHERE LOWER(email) = ? OR LOWER(COALESCE(username, \'\')) = ? LIMIT 1')
        .get(normalized, usernameNorm)
      if (dup) {
        return res.status(409).json({ error: 'An account with this email or username already exists' })
      }

      const hash = bcrypt.hashSync(String(password), 10)
      const id = randomUUID()
      const now = new Date().toISOString()
      const displayName = (name && String(name).trim()) || normalized.split('@')[0]

      db.prepare(
        `INSERT INTO sys_users (
          id, email, username, password_hash, name, role, active, created_at,
          must_change_password, registration_status, approved_by, approved_at
        )
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, 0, 'approved', ?, ?)`
      ).run(id, normalized, usernameNorm, hash, displayName, newRole, now, req.userId || null, now)

      const row = db
        .prepare(
          'SELECT id, email, username, name, role, active, must_change_password, registration_status, approved_at, created_at FROM sys_users WHERE id = ?'
        )
        .get(id)
      res.status(201).json(row)
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return res.status(409).json({ error: 'An account with this email or username already exists' })
      }
      res.status(400).json({ error: e.message })
    }
  })

  r.patch('/:id', (req, res) => {
    try {
      const actor = String(req.userRole || '').toLowerCase()
      const targetId = req.params.id

      const newRole = String(req.body?.role || '').toLowerCase().trim()
      if (!ALLOWED_ROLES.includes(newRole)) {
        return res.status(400).json({ error: `role must be one of: ${ALLOWED_ROLES.join(', ')}` })
      }

      const existing = db.prepare('SELECT id, email, role FROM sys_users WHERE id = ?').get(targetId)
      if (!existing) return res.status(404).json({ error: 'User not found' })

      if (!mayModifyUserRecord(actor, existing)) {
        return res.status(403).json({ error: 'Only a super admin can change this account' })
      }
      if (!mayAssignRole(actor, newRole)) {
        return res.status(403).json({ error: 'Only a super admin can assign the super admin role' })
      }

      if (String(existing.role || '').toLowerCase() === 'super_admin' && newRole !== 'super_admin') {
        const count = db
          .prepare(
            `SELECT COUNT(*) as c FROM sys_users
             WHERE LOWER(COALESCE(role,'')) = 'super_admin' AND COALESCE(active, 1) = 1`
          )
          .get().c
        if (count <= 1) {
          return res.status(400).json({ error: 'Cannot change the last super admin to a different role' })
        }
      }

      db.prepare('UPDATE sys_users SET role = ? WHERE id = ?').run(newRole, targetId)

      const row = db
        .prepare(
          'SELECT id, email, username, name, role, active, must_change_password, registration_status, approved_at, created_at FROM sys_users WHERE id = ?'
        )
        .get(targetId)
      res.json(row)
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.post('/:id/approval', (req, res) => {
    try {
      const actor = String(req.userRole || '').toLowerCase()
      if (!['admin', 'super_admin', 'manager'].includes(actor)) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      const targetId = String(req.params.id || '').trim()
      const decision = String(req.body?.decision || 'approve').toLowerCase()
      if (!['approve', 'reject'].includes(decision)) {
        return res.status(400).json({ error: 'decision must be approve or reject' })
      }
      const row = db.prepare('SELECT id, role, registration_status FROM sys_users WHERE id = ?').get(targetId)
      if (!row) return res.status(404).json({ error: 'User not found' })
      const now = new Date().toISOString()
      if (decision === 'approve') {
        db.prepare(
          `UPDATE sys_users
           SET active = 1, registration_status = 'approved', approved_by = ?, approved_at = ?, must_change_password = 1
           WHERE id = ?`
        ).run(req.userId || null, now, targetId)
      } else {
        db.prepare(
          `UPDATE sys_users
           SET active = 0, registration_status = 'rejected', approved_by = ?, approved_at = ?
           WHERE id = ?`
        ).run(req.userId || null, now, targetId)
      }
      const out = db
        .prepare(
          'SELECT id, email, username, name, role, active, must_change_password, registration_status, approved_at, created_at FROM sys_users WHERE id = ?'
        )
        .get(targetId)
      res.json(out)
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.post('/:id/reset-password', (req, res) => {
    try {
      const actor = String(req.userRole || '').toLowerCase()
      if (!['admin', 'super_admin', 'manager'].includes(actor)) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      const targetId = String(req.params.id || '').trim()
      const tempPassword = String(req.body?.temporary_password || '')
      if (!tempPassword || tempPassword.length < 6) {
        return res.status(400).json({ error: 'temporary_password must be at least 6 characters' })
      }
      const row = db.prepare('SELECT id, role FROM sys_users WHERE id = ?').get(targetId)
      if (!row) return res.status(404).json({ error: 'User not found' })
      if (!mayModifyUserRecord(actor, row)) {
        return res.status(403).json({ error: 'Only a super admin can reset this account password' })
      }
      const hash = bcrypt.hashSync(tempPassword, 10)
      db.prepare('UPDATE sys_users SET password_hash = ?, must_change_password = 1 WHERE id = ?').run(hash, targetId)
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  return r
}
