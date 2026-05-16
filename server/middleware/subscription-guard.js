import { isSubscriptionCurrentlyActive } from '../utils/subscriptionQueries.js'

function isExemptPath(reqPath) {
  return (
    reqPath === '/api/health' ||
    reqPath.startsWith('/api/auth') ||
    reqPath.startsWith('/api/subscription')
  )
}

/**
 * Blocks HR API when subscription period has ended (local mode).
 * Exempt: health, auth, subscription (super admin can renew).
 * Set BYPASS_SUBSCRIPTION=1 to disable checks (dev / support).
 * @param {import('better-sqlite3').Database} db
 */
export function createSubscriptionGuard(db) {
  return function subscriptionGuard(req, res, next) {
    if (!req.path.startsWith('/api')) {
      return next()
    }
    if (isExemptPath(req.path)) {
      return next()
    }
    if (process.env.BYPASS_SUBSCRIPTION === '1') {
      return next()
    }
    if (!isSubscriptionCurrentlyActive(db)) {
      return res.status(403).json({
        error:
          'Subscription period has ended. A super admin must renew under Settings → System maintenance.',
        code: 'SUBSCRIPTION_EXPIRED'
      })
    }
    next()
  }
}
