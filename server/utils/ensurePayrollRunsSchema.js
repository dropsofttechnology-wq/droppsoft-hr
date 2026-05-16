/**
 * Idempotent migrations for payroll_runs (older HR DBs).
 * @param {import('better-sqlite3').Database} db
 */
export function ensurePayrollRunsSchema(db) {
  const additions = [
    'housing_allowance REAL',
    'standard_allowance REAL',
    'total_earn REAL',
    'shopping_amount REAL',
    'advance_amount REAL',
    'pension_employee REAL'
  ]
  for (const coldef of additions) {
    const name = coldef.split(/\s+/)[0]
    try {
      db.exec(`ALTER TABLE payroll_runs ADD COLUMN ${coldef}`)
    } catch (e) {
      const msg = String(e?.message || e || '')
      if (!/duplicate column/i.test(msg) && !/already exists/i.test(msg)) {
        console.warn('[payroll_runs migration]', name, e.message || e)
      }
    }
  }
}
