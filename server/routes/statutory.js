import { Router } from 'express'
import { requireLocalUser } from '../middleware/auth.js'

/**
 * KRA / SHIF / NSSF preview or filing stubs — wire to src/utils/payrollCalc.js logic later.
 * @param {import('better-sqlite3').Database} db
 */
export function createStatutoryRoutes(db) {
  const r = Router()
  const auth = requireLocalUser(db)

  r.post('/preview', auth, (req, res) => {
    res.status(501).json({
      message: 'Statutory preview not implemented — port payrollCalc.js here',
      body: req.body
    })
  })

  return r
}
