import { Router } from 'express'
import {
  getRolePermissionsPayload,
  saveRolePermissionsMatrix,
  PERMISSION_DEFINITIONS
} from '../utils/rolePermissions.js'

/**
 * GET/PUT role permission matrix. Mount with requireRoles(db, ['super_admin']).
 * @param {import('better-sqlite3').Database} db
 */
export function createRolePermissionsRoutes(db) {
  const r = Router()

  r.get('/', (req, res) => {
    try {
      res.json(getRolePermissionsPayload(db))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.put('/', (req, res) => {
    try {
      const matrix = req.body?.matrix
      if (!matrix || typeof matrix !== 'object') {
        return res.status(400).json({ error: 'Body must include matrix object' })
      }
      const keys = new Set(PERMISSION_DEFINITIONS.map((d) => d.key))
      for (const k of Object.keys(matrix)) {
        if (!keys.has(k)) {
          return res.status(400).json({ error: `Unknown permission key: ${k}` })
        }
      }
      saveRolePermissionsMatrix(db, matrix)
      res.json(getRolePermissionsPayload(db))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  return r
}
