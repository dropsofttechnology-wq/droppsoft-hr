import { Router } from 'express'
import { getSubscriptionPayload } from '../utils/subscriptionQueries.js'

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createHealthRouter(db) {
  const r = Router()
  r.get('/health', (req, res) => {
    let subscription = null
    try {
      subscription = getSubscriptionPayload(db)
    } catch (_) {
      subscription = null
    }
    res.status(200).json({
      ok: true,
      service: 'dropsoft-hr-api',
      subscription
    })
  })
  return r
}
