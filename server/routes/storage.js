import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { Router } from 'express'
import multer from 'multer'
import { requirePermission } from '../middleware/permission-guard.js'
import { getLogosDir } from '../paths.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 }
})

/**
 * Local file storage for company logos (replaces Appwrite Storage in standalone mode).
 * @param {import('better-sqlite3').Database} db
 */
export function createStorageRoutes(db) {
  const r = Router()
  const canBrand = requirePermission(db, 'storage_branding')

  r.get('/logos/:filename', (req, res) => {
    try {
      const safe = path.basename(req.params.filename)
      if (!safe || safe.includes('..')) {
        return res.status(400).end()
      }
      const p = path.join(getLogosDir(), safe)
      if (!fs.existsSync(p)) return res.status(404).end()
      res.sendFile(path.resolve(p))
    } catch (e) {
      res.status(500).end()
    }
  })

  r.post('/company-logo', canBrand, upload.single('file'), (req, res) => {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ error: 'file is required (multipart field: file)' })
      }
      const ext = path.extname(req.file.originalname || '') || '.png'
      const name = `${randomUUID()}${ext.length > 10 ? '.png' : ext}`
      fs.mkdirSync(getLogosDir(), { recursive: true })
      const dest = path.join(getLogosDir(), name)
      fs.writeFileSync(dest, req.file.buffer)
      const host = req.get('host') || '127.0.0.1'
      const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()
      const url = `${proto}://${host}/api/storage/logos/${name}`
      res.status(201).json({ url, file_id: name })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.delete('/logos/:filename', canBrand, (req, res) => {
    try {
      const safe = path.basename(req.params.filename)
      const p = path.join(getLogosDir(), safe)
      if (fs.existsSync(p)) fs.unlinkSync(p)
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  return r
}
