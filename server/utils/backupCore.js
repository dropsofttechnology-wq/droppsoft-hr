import fs from 'fs'
import os from 'os'
import path from 'path'
import { randomUUID } from 'crypto'
import archiver from 'archiver'
import { encryptBackupZip } from './backupCrypto.js'

/**
 * Build a zip in a temp file and return its buffer, then delete the temp file.
 * @param {string} dbPath
 * @param {string} uploadsRoot
 * @param {object} manifest
 */
function buildZipBuffer(dbPath, uploadsRoot, manifest) {
  return new Promise((resolve, reject) => {
    const tmpPath = path.join(os.tmpdir(), `dropsoft-zip-${randomUUID()}.zip`)
    const output = fs.createWriteStream(tmpPath)
    const archive = archiver('zip', { zlib: { level: 6 } })
    archive.on('error', reject)
    output.on('error', reject)
    output.on('close', () => {
      try {
        const buf = fs.readFileSync(tmpPath)
        fs.unlinkSync(tmpPath)
        resolve(buf)
      } catch (e) {
        reject(e)
      }
    })
    archive.pipe(output)
    try {
      if (fs.existsSync(dbPath)) {
        archive.file(dbPath, { name: 'hr.db' })
      }
      archive.append(Buffer.from(JSON.stringify(manifest, null, 2)), { name: 'manifest.json' })
      if (fs.existsSync(uploadsRoot)) {
        archive.directory(uploadsRoot, 'uploads')
      }
    } catch (e) {
      reject(e)
      return
    }
    archive.finalize()
  })
}

/**
 * @param {object} opts
 * @param {string} opts.dbPath
 * @param {string} opts.uploadsRoot
 * @param {string} opts.password — min 8 chars
 * @param {import('better-sqlite3').Database} [opts.db] — optional, for WAL checkpoint
 * @returns {Promise<Buffer>} encrypted .dhrbackup bytes
 */
export async function createEncryptedBackupBuffer({ dbPath, uploadsRoot, password, db }) {
  if (!password || String(password).length < 8) {
    throw new Error('Password must be at least 8 characters')
  }
  if (db) {
    try {
      db.pragma('wal_checkpoint(FULL)')
    } catch (_) {
      /* ignore */
    }
  }
  const manifest = {
    version: 1,
    app: 'dropsoft-hr',
    created_at: new Date().toISOString(),
    encrypted: true
  }
  const zipBuf = await buildZipBuffer(dbPath, uploadsRoot, manifest)
  return encryptBackupZip(zipBuf, String(password))
}
