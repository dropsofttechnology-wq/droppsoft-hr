import { Router } from 'express'
import { randomUUID } from 'crypto'
import { requireLocalUser } from '../middleware/auth.js'
import { mapHolidayRow } from '../utils/rowMappers.js'

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createHolidaysRoutes(db) {
  const r = Router()
  const auth = requireLocalUser(db)

  r.get('/', auth, (req, res) => {
    try {
      const companyId = String(req.query.company_id || '')
      if (!companyId) {
        return res.status(400).json({ error: 'company_id is required' })
      }
      const year = req.query.year ? String(req.query.year) : ''
      const from = req.query.from ? String(req.query.from) : ''
      const to = req.query.to ? String(req.query.to) : ''
      const status = req.query.status ? String(req.query.status) : ''
      const dateOnly = req.query.date ? String(req.query.date) : ''

      let q = 'SELECT * FROM holidays WHERE company_id = ?'
      const params = [companyId]
      if (dateOnly) {
        q += ' AND holiday_date = ?'
        params.push(dateOnly)
      }
      if (status) {
        q += ' AND status = ?'
        params.push(status)
      }
      if (year && /^\d{4}$/.test(year)) {
        q += ' AND holiday_date >= ? AND holiday_date <= ?'
        params.push(`${year}-01-01`, `${year}-12-31`)
      } else if (from && to) {
        q += ' AND holiday_date >= ? AND holiday_date <= ?'
        params.push(from, to)
      }
      q += ' ORDER BY holiday_date ASC'
      const rows = db.prepare(q).all(...params)
      res.json(rows.map(mapHolidayRow))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/:id', auth, (req, res) => {
    try {
      const row = db.prepare('SELECT * FROM holidays WHERE id = ?').get(req.params.id)
      if (!row) return res.status(404).json({ error: 'Not found' })
      res.json(mapHolidayRow(row))
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/', auth, (req, res) => {
    try {
      const companyId = String(req.body?.company_id || '')
      const holidayDate = String(req.body?.holiday_date || '')
      const holidayName = String(req.body?.holiday_name || '').trim()
      if (!companyId || !holidayDate || !holidayName) {
        return res.status(400).json({ error: 'company_id, holiday_date, and holiday_name are required' })
      }
      const dup = db
        .prepare('SELECT id FROM holidays WHERE company_id = ? AND holiday_date = ?')
        .get(companyId, holidayDate)
      if (dup) {
        return res.status(400).json({ error: 'A holiday already exists for this date.' })
      }
      const now = new Date().toISOString()
      const id = randomUUID()
      const rateType = String(req.body?.rate_type || 'normal')
      const rate =
        rateType === 'normal' ? 100 : Number.parseFloat(String(req.body?.rate ?? 100)) || 100
      db.prepare(
        `INSERT INTO holidays (
          id, company_id, holiday_date, name, status, rate_type, rate, reporting_time, closing_time, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        companyId,
        holidayDate,
        holidayName,
        String(req.body?.status || 'active'),
        rateType,
        rate,
        String(req.body?.reporting_time || ''),
        String(req.body?.closing_time || ''),
        now,
        now
      )
      const row = db.prepare('SELECT * FROM holidays WHERE id = ?').get(id)
      res.status(201).json(mapHolidayRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.put('/:id', auth, (req, res) => {
    try {
      const now = new Date().toISOString()
      const id = req.params.id
      const existing = db.prepare('SELECT * FROM holidays WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Not found' })

      const holidayDate =
        req.body?.holiday_date != null ? String(req.body.holiday_date) : existing.holiday_date
      const holidayName =
        req.body?.holiday_name != null ? String(req.body.holiday_name).trim() : existing.name
      const rateType = String(req.body?.rate_type != null ? req.body.rate_type : existing.rate_type || 'normal')
      const rate =
        rateType === 'normal'
          ? 100
          : Number.parseFloat(String(req.body?.rate ?? existing.rate ?? 100)) || 100
      const reporting =
        req.body?.reporting_time != null ? String(req.body.reporting_time) : existing.reporting_time || ''
      const closing =
        req.body?.closing_time != null ? String(req.body.closing_time) : existing.closing_time || ''
      const status = req.body?.status != null ? String(req.body.status) : existing.status

      if (holidayDate !== existing.holiday_date) {
        const dup = db
          .prepare('SELECT id FROM holidays WHERE company_id = ? AND holiday_date = ? AND id != ?')
          .get(existing.company_id, holidayDate, id)
        if (dup) return res.status(400).json({ error: 'A holiday already exists for this date.' })
      }

      db.prepare(
        `UPDATE holidays SET holiday_date = ?, name = ?, status = ?, rate_type = ?, rate = ?,
         reporting_time = ?, closing_time = ?, updated_at = ? WHERE id = ?`
      ).run(holidayDate, holidayName, status, rateType, rate, reporting, closing, now, id)

      const row = db.prepare('SELECT * FROM holidays WHERE id = ?').get(id)
      res.json(mapHolidayRow(row))
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  r.delete('/:id', auth, (req, res) => {
    try {
      const r0 = db.prepare('DELETE FROM holidays WHERE id = ?').run(req.params.id)
      if (r0.changes === 0) return res.status(404).json({ error: 'Not found' })
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  return r
}
