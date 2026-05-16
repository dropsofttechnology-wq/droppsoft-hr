import { Router } from 'express'
import { randomUUID } from 'crypto'
import { requireLocalUser } from '../middleware/auth.js'
import { mapBankRow } from '../utils/rowMappers.js'

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createBankRoutes(db) {
  const r = Router()
  const auth = requireLocalUser(db)

  r.get('/', auth, (req, res) => {
    try {
      const status = req.query.status ? String(req.query.status) : ''
      let q = 'SELECT * FROM banks WHERE 1=1'
      const params = []
      if (status && status !== 'all') {
        q += ' AND status = ?'
        params.push(status)
      }
      q += ' ORDER BY name COLLATE NOCASE'
      const rows = db.prepare(q).all(...params)
      res.json(rows.map(mapBankRow))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/', auth, (req, res) => {
    try {
      const now = new Date().toISOString()
      const id = randomUUID()
      const bankName = String(req.body?.bank_name || req.body?.name || '').trim()
      if (!bankName) {
        return res.status(400).json({ error: 'bank_name is required' })
      }
      const bankCode = String(req.body?.bank_code || req.body?.code || '').trim()
      const swift = String(req.body?.swift_code || '').trim()
      const status = String(req.body?.status || 'active')
      db.prepare(
        `INSERT INTO banks (id, name, code, swift_code, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(id, bankName, bankCode, swift, status, now, now)
      const row = db.prepare('SELECT * FROM banks WHERE id = ?').get(id)
      res.status(201).json(mapBankRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.put('/:id', auth, (req, res) => {
    try {
      const now = new Date().toISOString()
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM banks WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Bank not found' })
      const bankName =
        req.body?.bank_name != null
          ? String(req.body.bank_name).trim()
          : existing.name
      const bankCode =
        req.body?.bank_code != null ? String(req.body.bank_code).trim() : existing.code
      const swift =
        req.body?.swift_code != null ? String(req.body.swift_code).trim() : existing.swift_code
      const status = req.body?.status != null ? String(req.body.status) : existing.status
      db.prepare(
        `UPDATE banks SET name = ?, code = ?, swift_code = ?, status = ?, updated_at = ? WHERE id = ?`
      ).run(bankName, bankCode, swift || '', status, now, id)
      const row = db.prepare('SELECT * FROM banks WHERE id = ?').get(id)
      res.json(mapBankRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.delete('/:id', auth, (req, res) => {
    try {
      const r0 = db.prepare('DELETE FROM banks WHERE id = ?').run(req.params.id)
      if (r0.changes === 0) return res.status(404).json({ error: 'Bank not found' })
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  return r
}
