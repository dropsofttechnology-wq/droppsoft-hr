import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { requireRoles } from '../middleware/role-guard.js'
import { getDataDir, getDbPath, getUploadsRoot } from '../paths.js'
import { decryptBackupToZip, isEncryptedBackup } from '../utils/backupCrypto.js'
import { createEncryptedBackupBuffer } from '../utils/backupCore.js'
import { loadAutoBackupConfig, saveAutoBackupConfig } from '../utils/autoBackup.js'

function isZipFile(buf) {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createBackupRoutes(db) {
  const r = Router()
  const dataDir = getDataDir()

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(dataDir, { recursive: true })
      cb(null, dataDir)
    },
    filename: (_req, _file, cb) => cb(null, `pending-upload-${Date.now()}.bin`)
  })
  const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 }
  })

  /**
   * Encrypted backup (AES-256-GCM). Body: { "password": "..." } (min 8 chars).
   */
  r.post('/download', requireRoles(db, ['super_admin']), (req, res) => {
    const password = req.body?.password
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'Password is required (minimum 8 characters)' })
    }

    const dbPath = getDbPath()
    const uploadsRoot = getUploadsRoot()

    createEncryptedBackupBuffer({ dbPath, uploadsRoot, password: String(password), db })
      .then((enc) => {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-')
        res.setHeader('Content-Type', 'application/octet-stream')
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="dropsoft-hr-backup-${stamp}.dhrbackup"`
        )
        res.send(enc)
      })
      .catch((err) => {
        console.error('[backup]', err)
        if (!res.headersSent) res.status(500).json({ error: err.message })
      })
  })

  /** Scheduled auto-backup settings (stored on disk; super admin only). */
  r.get('/schedule', requireRoles(db, ['super_admin']), (_req, res) => {
    try {
      const cfg = loadAutoBackupConfig(dataDir)
      res.json({
        enabled: !!cfg.enabled,
        dayOfWeek: cfg.dayOfWeek ?? 1,
        time: cfg.time ?? '02:00',
        outputDir: cfg.outputDir || '',
        hasPassword: !!(cfg.password && String(cfg.password).length >= 8)
      })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.put('/schedule', requireRoles(db, ['super_admin']), (req, res) => {
    try {
      const body = req.body || {}
      const prev = loadAutoBackupConfig(dataDir)
      const next = { ...prev }

      if (body.enabled != null) next.enabled = !!body.enabled
      if (body.dayOfWeek != null) {
        const d = parseInt(String(body.dayOfWeek), 10)
        if (!Number.isInteger(d) || d < 0 || d > 6) {
          return res.status(400).json({ error: 'dayOfWeek must be 0–6 (Sunday–Saturday)' })
        }
        next.dayOfWeek = d
      }
      if (body.time != null) {
        const t = String(body.time).trim()
        if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(t)) {
          return res.status(400).json({ error: 'time must be HH:mm (24-hour local time)' })
        }
        next.time = t
      }
      if (body.outputDir !== undefined) {
        next.outputDir = String(body.outputDir || '').trim() || undefined
      }
      if (body.password != null && String(body.password).trim() !== '') {
        if (String(body.password).length < 8) {
          return res.status(400).json({ error: 'Password must be at least 8 characters' })
        }
        next.password = String(body.password)
      }

      if (next.enabled && !(next.password && String(next.password).length >= 8)) {
        const keep = prev.password && String(prev.password).length >= 8
        if (!keep) {
          return res.status(400).json({
            error: 'Set a backup password (min 8 characters) before enabling scheduled backup'
          })
        }
        next.password = prev.password
      }

      saveAutoBackupConfig(dataDir, next)
      res.json({
        enabled: !!next.enabled,
        dayOfWeek: next.dayOfWeek ?? 1,
        time: next.time ?? '02:00',
        outputDir: next.outputDir || '',
        hasPassword: !!(next.password && String(next.password).length >= 8)
      })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.post('/restore', requireRoles(db, ['super_admin']), upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Missing file (form field name: file)' })
      }

      const uploadPath = req.file.path
      let fileBuf = fs.readFileSync(uploadPath)
      try {
        fs.unlinkSync(uploadPath)
      } catch (_) {}

      if (isEncryptedBackup(fileBuf)) {
        const pwd = String(req.body?.password || '')
        if (pwd.length < 8) {
          return res.status(400).json({
            error:
              'This backup is password-protected. Enter the same password you used when creating the backup (min 8 characters).'
          })
        }
        try {
          fileBuf = decryptBackupToZip(fileBuf, pwd)
        } catch (e) {
          console.error('[backup] decrypt failed', e)
          return res.status(400).json({
            error: 'Wrong password or the backup file is damaged and cannot be decrypted.'
          })
        }
      } else if (!isZipFile(fileBuf)) {
        return res.status(400).json({
          error:
            'Invalid file. Use an encrypted .dhrbackup from this app, or a legacy plain .zip backup from an older version.'
        })
      }

      fs.mkdirSync(dataDir, { recursive: true })
      fs.writeFileSync(path.join(dataDir, 'pending-restore.zip'), fileBuf)

      const meta = {
        zipFile: 'pending-restore.zip',
        requestedAt: new Date().toISOString(),
        requestedBy: req.userId
      }
      fs.writeFileSync(path.join(dataDir, 'restore-pending.json'), JSON.stringify(meta, null, 2))
      res.json({
        ok: true,
        restartRequired: true,
        message:
          'Restore package saved. Close and reopen Dropsoft HR (or restart the HR API) to finish restoring.'
      })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  return r
}
