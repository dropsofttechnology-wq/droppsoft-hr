import { Router } from 'express'
import { requireLocalUser } from '../middleware/auth.js'
import { requireRoles } from '../middleware/role-guard.js'
import {
  applySubscriptionFromLicense,
  computePeriodEnd,
  ensureDeploymentId,
  getSubscriptionPayload,
  resolveSubscriptionDatesFromLicensePayload,
  setAppSetting
} from '../utils/subscriptionQueries.js'
import { getLicensePublicKeyPem, verifyLicenseToken } from '../utils/licenseToken.js'
import { buildLicenseQuote, getLicenseCatalogPayload } from '../utils/licensePackages.js'
import { createLicenseOrder, getLicenseOrderById, listLicenseOrders } from '../utils/licenseOrderQueries.js'
import { buildLicenseProformaPdfBuffer } from '../services/licenseProformaPdf.js'

const PLANS = new Set(['monthly', 'quarterly', 'yearly'])

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createSubscriptionRoutes(db) {
  const r = Router()

  r.get('/catalog', (req, res) => {
    try {
      res.json(getLicenseCatalogPayload())
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/quote', (req, res) => {
    try {
      res.json(buildLicenseQuote(req.body || {}))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.post('/orders', requireRoles(db, ['super_admin', 'admin', 'manager']), (req, res) => {
    try {
      const deploymentId = ensureDeploymentId(db)
      const body = { ...(req.body || {}), deploymentId }
      const order = createLicenseOrder(db, body, req.userId)
      res.status(201).json(order)
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.get('/orders/:orderId/proforma', requireRoles(db, ['super_admin', 'admin', 'manager']), async (req, res) => {
    try {
      const orderId = String(req.params.orderId || '').trim()
      if (!orderId) {
        return res.status(400).json({ error: 'Missing order id' })
      }
      const order = getLicenseOrderById(db, orderId)
      if (!order) {
        return res.status(404).json({ error: 'Order not found' })
      }
      if (req.userRole !== 'super_admin') {
        const dep = ensureDeploymentId(db)
        if (order.deploymentId && order.deploymentId !== dep) {
          return res.status(403).json({ error: 'Not allowed to download this order' })
        }
      }
      const pdf = await buildLicenseProformaPdfBuffer(order)
      const safeRef = String(order.referenceCode || 'order').replace(/[^\w.-]+/g, '_')
      const filename = `Proforma-${safeRef}.pdf`
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.send(pdf)
    } catch (e) {
      res.status(500).json({ error: e.message || 'Failed to build proforma' })
    }
  })

  r.get('/orders', requireRoles(db, ['super_admin']), (req, res) => {
    try {
      res.json({ orders: listLicenseOrders(db) })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/status', requireLocalUser(db), (req, res) => {
    try {
      res.json(getSubscriptionPayload(db))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/deployment', requireRoles(db, ['super_admin']), (req, res) => {
    try {
      res.json({ deploymentId: ensureDeploymentId(db) })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/activate', requireRoles(db, ['super_admin']), (req, res) => {
    try {
      const raw = req.body?.license ?? req.body?.token
      if (!raw || typeof raw !== 'string' || !String(raw).trim()) {
        return res.status(400).json({ error: 'Missing license token (body.license)' })
      }
      const publicKeyPem = getLicensePublicKeyPem()
      const payload = verifyLicenseToken(publicKeyPem, raw.trim())
      const deploymentId = ensureDeploymentId(db)
      if (String(payload.deployment_id).trim() !== deploymentId) {
        return res.status(400).json({
          error:
            'This license was issued for a different deployment. Copy your Deployment ID from System maintenance and request a license for this server.',
          code: 'DEPLOYMENT_MISMATCH'
        })
      }
      const dates = resolveSubscriptionDatesFromLicensePayload(db, payload)
      applySubscriptionFromLicense(
        db,
        dates,
        {
          licenseId: String(payload.license_id).trim(),
          deploymentId
        },
        req.userId
      )
      res.json(getSubscriptionPayload(db))
    } catch (e) {
      const msg = e?.message || String(e)
      const status = msg.includes('Invalid') || msg.includes('missing') || msg.includes('must') ? 400 : 500
      res.status(status).json({ error: msg })
    }
  })

  r.put(
    '/session',
    requireRoles(db, ['super_admin']),
    (req, res) => {
      try {
        const raw = req.body?.autoLogoutMinutes
        const n = Math.floor(Number(raw))
        const maxM = 7 * 24 * 60
        if (!Number.isFinite(n) || n < 0 || n > maxM) {
          return res.status(400).json({ error: `autoLogoutMinutes must be 0–${maxM}` })
        }
        setAppSetting(db, 'auto_logout_minutes', String(n))
        res.json(getSubscriptionPayload(db))
      } catch (e) {
        res.status(500).json({ error: e.message })
      }
    }
  )

  r.put(
    '/',
    requireRoles(db, ['super_admin']),
    (req, res) => {
      try {
        const { plan, periodStart } = req.body || {}
        const p = typeof plan === 'string' ? plan.toLowerCase().trim() : ''
        if (!PLANS.has(p)) {
          return res.status(400).json({ error: 'plan must be monthly, quarterly, or yearly' })
        }
        const start =
          periodStart && String(periodStart).trim()
            ? new Date(String(periodStart)).toISOString()
            : new Date().toISOString()
        const startDate = new Date(start)
        if (Number.isNaN(startDate.getTime())) {
          return res.status(400).json({ error: 'Invalid periodStart' })
        }
        const end = computePeriodEnd(startDate, p).toISOString()
        const now = new Date().toISOString()
        const existing = db.prepare(`SELECT id FROM app_subscription WHERE id = 'default'`).get()
        if (existing) {
          db.prepare(
            `UPDATE app_subscription SET plan = ?, period_start = ?, period_end = ?, updated_at = ?, updated_by = ?
             WHERE id = 'default'`
          ).run(p, start, end, now, req.userId)
        } else {
          db.prepare(
            `INSERT INTO app_subscription (id, plan, period_start, period_end, updated_at, updated_by)
             VALUES ('default', ?, ?, ?, ?, ?)`
          ).run(p, start, end, now, req.userId)
        }
        res.json(getSubscriptionPayload(db))
      } catch (e) {
        res.status(500).json({ error: e.message })
      }
    }
  )

  return r
}
