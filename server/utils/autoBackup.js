import fs from 'fs'
import path from 'path'
import { createEncryptedBackupBuffer } from './backupCore.js'

const CONFIG_NAME = 'auto-backup-config.json'
const STATE_NAME = 'auto-backup-state.json'

/**
 * @param {string} dataDir
 * @returns {{ enabled?: boolean, dayOfWeek?: number, time?: string, password?: string, outputDir?: string }}
 */
export function loadAutoBackupConfig(dataDir) {
  const p = path.join(dataDir, CONFIG_NAME)
  try {
    if (!fs.existsSync(p)) return {}
    const raw = fs.readFileSync(p, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function saveAutoBackupConfig(dataDir, config) {
  fs.mkdirSync(dataDir, { recursive: true })
  const p = path.join(dataDir, CONFIG_NAME)
  fs.writeFileSync(p, JSON.stringify(config, null, 2), 'utf8')
}

function loadState(dataDir) {
  const p = path.join(dataDir, STATE_NAME)
  try {
    if (!fs.existsSync(p)) return {}
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return {}
  }
}

function saveState(dataDir, state) {
  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(path.join(dataDir, STATE_NAME), JSON.stringify(state, null, 2), 'utf8')
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

/**
 * @param {import('better-sqlite3').Database} db
 */
export async function runAutoBackupNow({ db, dbPath, uploadsRoot, dataDir, password }) {
  const buf = await createEncryptedBackupBuffer({ dbPath, uploadsRoot, password, db })
  const cfg = loadAutoBackupConfig(dataDir)
  const outDir = cfg.outputDir
    ? path.resolve(cfg.outputDir)
    : path.join(dataDir, 'backups')
  fs.mkdirSync(outDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filePath = path.join(outDir, `auto-backup-${stamp}.dhrbackup`)
  fs.writeFileSync(filePath, buf)
  return { filePath, size: buf.length }
}

/**
 * @returns {boolean} true if a backup ran
 */
export async function tickAutoBackup({ db, dbPath, uploadsRoot, dataDir }) {
  const cfg = loadAutoBackupConfig(dataDir)
  if (!cfg.enabled || cfg.password == null || String(cfg.password).length < 8) {
    return false
  }
  const day = Number(cfg.dayOfWeek)
  if (!Number.isInteger(day) || day < 0 || day > 6) return false
  const timeStr = String(cfg.time || '').trim()
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(timeStr)) return false

  const now = new Date()
  if (now.getDay() !== day) return false

  const [sh, sm] = timeStr.split(':').map((x) => parseInt(x, 10))
  if (now.getHours() !== sh || now.getMinutes() !== sm) return false

  const todayStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
  const state = loadState(dataDir)
  if (state.lastRunDate === todayStr) {
    return false
  }

  try {
    await runAutoBackupNow({
      db,
      dbPath,
      uploadsRoot,
      dataDir,
      password: cfg.password
    })
    saveState(dataDir, { ...state, lastRunDate: todayStr, lastRunAt: new Date().toISOString() })
    console.log(`[auto-backup] Wrote scheduled backup for ${todayStr}`)
    return true
  } catch (e) {
    console.error('[auto-backup] Failed:', e.message || e)
    return false
  }
}
