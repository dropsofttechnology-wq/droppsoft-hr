/**
 * Wrap multi-step business writes in one atomic SQLite transaction.
 * @param {import('better-sqlite3').Database} db
 * @param {(ctx?: { now: string }) => any} work
 */
export function runInTransaction(db, work) {
  const tx = db.transaction(() => work({ now: new Date().toISOString() }))
  return tx()
}
