import { Router } from 'express'
import { randomUUID } from 'crypto'
import { requireLocalUser } from '../middleware/auth.js'
import { runInTransaction } from '../utils/transactions.js'

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createAttendanceRoutes(db) {
  const r = Router()
  const auth = requireLocalUser(db)

  r.get('/records', auth, (req, res) => {
    try {
      const { company_id, from, to, user_id } = req.query
      let q = 'SELECT * FROM attendance WHERE 1=1'
      const params = []
      if (company_id) {
        q += ' AND company_id = ?'
        params.push(company_id)
      }
      if (user_id) {
        q += ' AND user_id = ?'
        params.push(String(user_id))
      }
      if (from) {
        q += ' AND date >= ?'
        params.push(from)
      }
      if (to) {
        q += ' AND date <= ?'
        params.push(to)
      }
      q += ' ORDER BY date DESC'
      const rows = db.prepare(q).all(...params)
      res.json(rows)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.get('/status', auth, (req, res) => {
    try {
      const userId = String(req.query.user_id || req.userId)
      const today = new Date().toISOString().slice(0, 10)
      const row = db
        .prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ? LIMIT 1')
        .get(userId, today)
      if (!row) {
        return res.json({ status: 'not_clocked_in', clock_in_time: null, clock_out_time: null })
      }
      if (row.clock_in_time && !row.clock_out_time) {
        return res.json({ status: 'clocked_in', clock_in_time: row.clock_in_time, clock_out_time: null })
      }
      return res.json({
        status: 'clocked_out',
        clock_in_time: row.clock_in_time,
        clock_out_time: row.clock_out_time
      })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  r.post('/clock', auth, (req, res) => {
    try {
      const nowIso = new Date().toISOString()
      const date = nowIso.slice(0, 10)
      const userId = String(req.body?.user_id || req.userId)
      const companyId = String(req.body?.company_id || '')
      if (!companyId) return res.status(400).json({ error: 'company_id is required' })

      const result = runInTransaction(db, () => {
        const existing = db
          .prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ? LIMIT 1')
          .get(userId, date)

        if (!existing) {
          const id = randomUUID()
          db.prepare(
            `INSERT INTO attendance (
              id, user_id, company_id, date, clock_in_time, hours_worked, overtime_hours,
              auth_method, location_lat, location_lng, location_address, reason, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            id,
            userId,
            companyId,
            date,
            nowIso,
            req.body?.auth_method || 'manual',
            req.body?.location_lat ?? null,
            req.body?.location_lng ?? null,
            req.body?.location_address || '',
            req.body?.reason || '',
            nowIso,
            nowIso
          )
          db.prepare(
            `INSERT INTO audit_log (
              id, user_id, company_id, action, entity_type, entity_id, new_value, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            randomUUID(),
            req.userId,
            companyId,
            'attendance_clock_in',
            'attendance',
            id,
            JSON.stringify({ user_id: userId, date, clock_in_time: nowIso }),
            nowIso
          )
          return { status: 'clocked_in', record_id: id, clock_in_time: nowIso }
        }

        if (existing.clock_out_time) {
          throw new Error('Already clocked out for today')
        }

        const hoursWorked = (new Date(nowIso).getTime() - new Date(existing.clock_in_time).getTime()) / 3600000
        const standardHours = Number(req.body?.standard_hours || 8)
        const overtimeHours = Math.max(0, hoursWorked - standardHours)

        db.prepare(
          `UPDATE attendance
           SET clock_out_time = ?, hours_worked = ?, overtime_hours = ?, updated_at = ?
           WHERE id = ?`
        ).run(nowIso, hoursWorked, overtimeHours, nowIso, existing.id)

        db.prepare(
          `INSERT INTO audit_log (
            id, user_id, company_id, action, entity_type, entity_id, new_value, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          randomUUID(),
          req.userId,
          existing.company_id,
          'attendance_clock_out',
          'attendance',
          existing.id,
          JSON.stringify({
            user_id: userId,
            date,
            clock_out_time: nowIso,
            hours_worked: hoursWorked,
            overtime_hours: overtimeHours
          }),
          nowIso
        )

        return {
          status: 'clocked_out',
          record_id: existing.id,
          clock_in_time: existing.clock_in_time,
          clock_out_time: nowIso,
          hours_worked: hoursWorked,
          overtime_hours: overtimeHours
        }
      })

      res.json(result)
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  /** Insert many attendance rows in one transaction (e.g. bulk default attendance). */
  r.post('/batch', auth, (req, res) => {
    try {
      const companyId = String(req.body?.company_id || '')
      const records = Array.isArray(req.body?.records) ? req.body.records : []
      if (!companyId || !records.length) {
        return res.status(400).json({ error: 'company_id and a non-empty records array are required' })
      }
      const now = new Date().toISOString()
      const ins = db.prepare(
        `INSERT INTO attendance (
          id, user_id, company_id, date, clock_in_time, clock_out_time, hours_worked, overtime_hours,
          auth_method, location_lat, location_lng, location_address, reason, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      const existsStmt = db.prepare(
        'SELECT 1 FROM attendance WHERE company_id = ? AND user_id = ? AND date = ? LIMIT 1'
      )
      let inserted = 0
      runInTransaction(db, () => {
        for (const r0 of records) {
          if (String(r0.company_id || '') !== companyId) {
            throw new Error('Record company_id must match request company_id')
          }
          const uid = String(r0.user_id)
          const dStr = String(r0.date)
          if (existsStmt.get(companyId, uid, dStr)) {
            continue
          }
          const id = randomUUID()
          ins.run(
            id,
            uid,
            companyId,
            dStr,
            r0.clock_in_time || null,
            r0.clock_out_time || null,
            Number(r0.hours_worked) || 0,
            Number(r0.overtime_hours) || 0,
            String(r0.auth_method || 'bulk'),
            r0.location_lat ?? null,
            r0.location_lng ?? null,
            String(r0.location_address || ''),
            String(r0.reason || ''),
            String(r0.created_at || now),
            String(r0.updated_at || now)
          )
          inserted++
        }
      })
      res.status(201).json({ inserted })
    } catch (e) {
      res.status(400).json({ error: e.message })
    }
  })

  /**
   * Sync one employee's attendance dates for a range.
   * - Creates missing days in selected_dates
   * - Deletes existing days not in selected_dates
   */
  r.post('/sync-days', auth, (req, res) => {
    try {
      const companyId = String(req.body?.company_id || '')
      const userId = String(req.body?.user_id || '')
      const startDate = String(req.body?.start_date || '').slice(0, 10)
      const endDate = String(req.body?.end_date || '').slice(0, 10)
      const selectedDates = Array.isArray(req.body?.selected_dates) ? req.body.selected_dates : []
      const standardHoursRaw = Number(req.body?.standard_hours)
      const standardHours = Number.isFinite(standardHoursRaw) && standardHoursRaw > 0 ? standardHoursRaw : 8

      if (!companyId || !userId || !startDate || !endDate) {
        return res.status(400).json({ error: 'company_id, user_id, start_date and end_date are required' })
      }
      if (startDate > endDate) {
        return res.status(400).json({ error: 'start_date must be before or equal to end_date' })
      }

      const selectedSet = new Set(
        selectedDates
          .map((d) => String(d || '').slice(0, 10))
          .filter((d) => d && d >= startDate && d <= endDate)
      )

      const dayModesRaw = req.body?.day_modes
      const dayModes =
        dayModesRaw && typeof dayModesRaw === 'object' && !Array.isArray(dayModesRaw) ? dayModesRaw : {}
      const hoursForDate = (dateStr) => {
        return dayModes[dateStr] === 'half' ? standardHours / 2 : standardHours
      }

      const now = new Date().toISOString()
      const existingRows = db
        .prepare(
          `SELECT id, date FROM attendance
           WHERE company_id = ? AND user_id = ? AND date >= ? AND date <= ?`
        )
        .all(companyId, userId, startDate, endDate)
      const existingByDate = new Map(existingRows.map((r0) => [String(r0.date), r0]))

      const delStmt = db.prepare('DELETE FROM attendance WHERE id = ?')
      const insStmt = db.prepare(
        `INSERT INTO attendance (
          id, user_id, company_id, date, clock_in_time, clock_out_time, hours_worked, overtime_hours,
          auth_method, location_lat, location_lng, location_address, reason, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      const updStmt = db.prepare(
        `UPDATE attendance SET clock_in_time = ?, clock_out_time = ?, hours_worked = ?, overtime_hours = 0, updated_at = ? WHERE id = ?`
      )

      let inserted = 0
      let updated = 0
      let deleted = 0
      runInTransaction(db, () => {
        for (const row of existingRows) {
          if (!selectedSet.has(String(row.date))) {
            delStmt.run(row.id)
            deleted++
            existingByDate.delete(String(row.date))
          }
        }

        for (const date of selectedSet) {
          const h = hoursForDate(date)
          const clockInMs = new Date(`${date}T09:00:00`).getTime()
          const clockIn = new Date(clockInMs).toISOString()
          const clockOut = new Date(clockInMs + h * 60 * 60 * 1000).toISOString()
          const ex = existingByDate.get(date)
          if (ex) {
            updStmt.run(clockIn, clockOut, h, now, ex.id)
            updated++
            continue
          }
          insStmt.run(
            randomUUID(),
            userId,
            companyId,
            date,
            clockIn,
            clockOut,
            h,
            0,
            'historical',
            null,
            null,
            '',
            h < standardHours ? 'Historical attendance (half day)' : 'Historical attendance calendar sync',
            now,
            now
          )
          inserted++
        }
      })

      return res.json({
        ok: true,
        inserted,
        updated,
        deleted,
        total_selected: selectedSet.size
      })
    } catch (e) {
      return res.status(400).json({ error: e.message })
    }
  })

  return r
}
