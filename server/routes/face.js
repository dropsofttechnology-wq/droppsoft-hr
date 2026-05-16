import { Router } from 'express'
import { randomUUID } from 'crypto'
import { requireLocalUser } from '../middleware/auth.js'
import { mapFaceDescriptorRow } from '../utils/rowMappers.js'

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createFaceRoutes(db) {
  const r = Router()
  const auth = requireLocalUser(db)

  r.get('/user/:userId', auth, (req, res) => {
    try {
      const row = db.prepare('SELECT * FROM face_descriptors WHERE user_id = ?').get(req.params.userId)
      res.json(row ? mapFaceDescriptorRow(row) : null)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/company/:companyId', auth, (req, res) => {
    try {
      const rows = db
        .prepare('SELECT * FROM face_descriptors WHERE company_id = ? LIMIT 5000')
        .all(req.params.companyId)
      res.json(rows.map(mapFaceDescriptorRow))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/', auth, (req, res) => {
    try {
      const now = new Date().toISOString()
      const userId = String(req.body?.user_id || '')
      const companyId = String(req.body?.company_id || '')
      const descriptor = req.body?.descriptor
      if (!userId || !companyId || descriptor == null) {
        return res.status(400).json({ error: 'user_id, company_id, and descriptor are required' })
      }
      const descStr = typeof descriptor === 'string' ? descriptor : JSON.stringify(descriptor)
      const qualityScore = Number(req.body?.quality_score || 0)
      const captureMethod = String(req.body?.capture_method || 'auto')

      const existing = db.prepare('SELECT id FROM face_descriptors WHERE user_id = ?').get(userId)
      if (existing) {
        db.prepare(
          `UPDATE face_descriptors SET company_id = ?, descriptor = ?, quality_score = ?, capture_method = ?, registered_at = ?
           WHERE user_id = ?`
        ).run(companyId, descStr, qualityScore, captureMethod, now, userId)
      } else {
        const id = randomUUID()
        db.prepare(
          `INSERT INTO face_descriptors (id, user_id, company_id, descriptor, quality_score, capture_method, registered_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(id, userId, companyId, descStr, qualityScore, captureMethod, now, now)
      }
      const row = db.prepare('SELECT * FROM face_descriptors WHERE user_id = ?').get(userId)
      res.status(existing ? 200 : 201).json(mapFaceDescriptorRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.delete('/user/:userId', auth, (req, res) => {
    try {
      const r0 = db.prepare('DELETE FROM face_descriptors WHERE user_id = ?').run(req.params.userId)
      res.json({ ok: true, deleted: r0.changes > 0 })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  return r
}
