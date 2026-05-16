import { Router } from 'express'
import { randomUUID } from 'crypto'
import { requireLocalUser } from '../middleware/auth.js'
import { mapCompanyRow } from '../utils/rowMappers.js'

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createCompanyRoutes(db) {
  const r = Router()
  const auth = requireLocalUser(db)

  r.get('/', auth, (req, res) => {
    try {
      const rows = db
        .prepare(
          `SELECT * FROM companies
           WHERE status = 'active' OR status IS NULL
           ORDER BY name`
        )
        .all()
      res.json(rows.map((row) => mapCompanyRow(row)))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/:id', auth, (req, res) => {
    try {
      const row = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id)
      if (!row) return res.status(404).json({ error: 'Not found' })
      res.json(mapCompanyRow(row))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/', auth, (req, res) => {
    try {
      const { name, registration_number, tax_pin, address, phone, email, logo_url } = req.body || {}
      if (!name) return res.status(400).json({ error: 'name is required' })
      const now = new Date().toISOString()
      const id = randomUUID()
      db.prepare(
        `INSERT INTO companies (
          id, name, registration_number, tax_pin, address, phone, email, logo_url, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
      ).run(
        id,
        name,
        registration_number || '',
        tax_pin || '',
        address || '',
        phone || '',
        email || '',
        logo_url || '',
        now,
        now
      )
      const row = db.prepare('SELECT * FROM companies WHERE id = ?').get(id)
      res.status(201).json(mapCompanyRow(row))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.put('/:id', auth, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Not found' })
      const now = new Date().toISOString()
      const b = req.body || {}
      const name = b.name != null ? String(b.name) : existing.name
      if (!name) return res.status(400).json({ error: 'name is required' })
      db.prepare(
        `UPDATE companies SET
          name = ?, registration_number = ?, tax_pin = ?, address = ?, phone = ?, email = ?, logo_url = ?, status = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        name,
        b.registration_number != null ? String(b.registration_number) : existing.registration_number || '',
        b.tax_pin != null ? String(b.tax_pin) : existing.tax_pin || '',
        b.address != null ? String(b.address) : existing.address || '',
        b.phone != null ? String(b.phone) : existing.phone || '',
        b.email != null ? String(b.email) : existing.email || '',
        b.logo_url != null ? String(b.logo_url) : existing.logo_url || '',
        b.status != null ? String(b.status) : existing.status || 'active',
        now,
        id
      )
      const row = db.prepare('SELECT * FROM companies WHERE id = ?').get(id)
      res.json(mapCompanyRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  /** Soft-delete: mark inactive so lists hide the company */
  r.delete('/:id', auth, (req, res) => {
    try {
      const id = req.params.id
      const existing = db.prepare('SELECT id FROM companies WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Not found' })
      const now = new Date().toISOString()
      db.prepare(`UPDATE companies SET status = 'inactive', updated_at = ? WHERE id = ?`).run(now, id)
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  return r
}
