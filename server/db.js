import { loadBetterSqlite3 } from './loadBetterSqlite3.js'

const Database = loadBetterSqlite3()

/**
 * Open SQLite with a few retries if the file is briefly locked (e.g. antivirus).
 * @param {string} dbPath
 * @param {number} retries
 * @param {number} delayMs
 */
export function openDatabaseWithRetry(dbPath, retries = 8, delayMs = 150) {
  let lastErr
  for (let i = 0; i < retries; i++) {
    try {
      const db = new Database(dbPath)
      db.pragma('journal_mode = WAL')
      db.pragma('foreign_keys = ON')
      return db
    } catch (e) {
      lastErr = e
      const code = e && e.code
      if (code !== 'SQLITE_BUSY' && code !== 'SQLITE_LOCKED') throw e
      const start = Date.now()
      while (Date.now() - start < delayMs) {
        /* spin wait — no shared buffer in all Node builds */
      }
    }
  }
  throw lastErr
}
