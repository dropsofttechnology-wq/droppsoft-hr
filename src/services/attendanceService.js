import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { format, addDays, isWeekend, parseISO, startOfDay } from 'date-fns'
import { getHolidays } from './holidayService'
import { getLeaveRequests } from './leaveService'
import { getCompanySettingNumber } from '../utils/settingsHelper'
import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from './localApi'
import { getEmployees } from './employeeService'

export const logAttendance = async (attendanceData) => {
  try {
    if (isLocalDataSource()) {
      const standardHours = await getCompanySettingNumber(attendanceData.company_id, 'working_hours', 8)
      const res = await localApiFetch('/api/attendance/clock', {
        method: 'POST',
        body: JSON.stringify({
          ...attendanceData,
          standard_hours: standardHours
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to log attendance')
      }
      return await res.json()
    }
    const today = format(new Date(), 'yyyy-MM-dd')
    
    // Check if attendance record exists for today
    const existing = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.ATTENDANCE,
      [
        Query.equal('user_id', attendanceData.user_id),
        Query.equal('date', today),
        Query.limit(1)
      ]
    )

    const attendanceRecord = {
      user_id: attendanceData.user_id,
      company_id: attendanceData.company_id,
      date: today,
      auth_method: attendanceData.auth_method || 'manual',
      location_lat: attendanceData.location_lat || null,
      location_lng: attendanceData.location_lng || null,
      location_address: attendanceData.location_address || '',
      reason: attendanceData.reason || '',
      updated_at: new Date().toISOString()
    }

    // Determine if clock-in or clock-out
    if (existing.documents.length > 0) {
      const record = existing.documents[0]
      if (record.clock_in_time && !record.clock_out_time) {
        // Clock out
        attendanceRecord.clock_in_time = record.clock_in_time
        attendanceRecord.clock_out_time = new Date().toISOString()
        
        // Calculate hours worked
        const clockIn = new Date(record.clock_in_time)
        const clockOut = new Date()
        const hoursWorked = (clockOut - clockIn) / (1000 * 60 * 60)
        attendanceRecord.hours_worked = hoursWorked
        
        // Calculate overtime hours based on company working hours setting
        const standardHours = await getCompanySettingNumber(attendanceData.company_id, 'working_hours', 8)
        attendanceRecord.overtime_hours = Math.max(0, hoursWorked - standardHours)

        return await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.ATTENDANCE,
          record.$id,
          attendanceRecord
        )
      } else {
        // Already clocked out, create new record for next day or error
        throw new Error('Already clocked out for today')
      }
    } else {
      // Clock in
      const now = new Date().toISOString()
      attendanceRecord.clock_in_time = now
      attendanceRecord.hours_worked = 0
      attendanceRecord.created_at = now

      return await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.ATTENDANCE,
        'unique()',
        attendanceRecord
      )
    }
  } catch (error) {
    console.error('Error logging attendance:', error)
    throw error
  }
}

export const getAttendanceStatus = async (userId) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(`/api/attendance/status?user_id=${encodeURIComponent(userId)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to get attendance status')
      }
      return await res.json()
    }
    const today = format(new Date(), 'yyyy-MM-dd')
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.ATTENDANCE,
      [
        Query.equal('user_id', userId),
        Query.equal('date', today),
        Query.limit(1)
      ]
    )

    if (response.documents.length === 0) {
      return { status: 'not_clocked_in', clock_in_time: null, clock_out_time: null }
    }

    const record = response.documents[0]
    if (record.clock_in_time && !record.clock_out_time) {
      return { status: 'clocked_in', clock_in_time: record.clock_in_time, clock_out_time: null }
    } else {
      return { status: 'clocked_out', clock_in_time: record.clock_in_time, clock_out_time: record.clock_out_time }
    }
  } catch (error) {
    console.error('Error getting attendance status:', error)
    throw error
  }
}

/**
 * List attendance rows (company + optional date range + optional user).
 */
export const listAttendanceRecords = async ({ companyId, from, to, userId }) => {
  if (isLocalDataSource()) {
    const params = new URLSearchParams()
    if (companyId) params.set('company_id', companyId)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (userId) params.set('user_id', userId)
    const res = await localApiFetch(`/api/attendance/records?${params.toString()}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to load attendance records')
    }
    const rows = await res.json()
    return rows.map((r) => ({ ...r, $id: r.id || r.$id }))
  }
  const queries = [Query.limit(5000)]
  if (companyId) queries.push(Query.equal('company_id', companyId))
  if (userId) queries.push(Query.equal('user_id', userId))
  if (from) queries.push(Query.greaterThanEqual('date', from))
  if (to) queries.push(Query.lessThanEqual('date', to))
  const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.ATTENDANCE, queries)
  return response.documents
}

export const findEmployeeByQR = async (qrToken, companyId) => {
  try {
    if (isLocalDataSource()) {
      const employees = await getEmployees(companyId, { status: 'active' })
      return (
        employees.find(
          (emp) => emp.employee_id === qrToken || emp.staff_no === qrToken
        ) || null
      )
    }
    const employees = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.EMPLOYEES,
      [
        Query.equal('company_id', companyId),
        Query.equal('status', 'active'),
        Query.limit(5000)
      ]
    )

    const employee = employees.documents.find(
      emp => emp.employee_id === qrToken || emp.staff_no === qrToken
    )

    return employee || null
  } catch (error) {
    console.error('Error finding employee by QR:', error)
    throw error
  }
}

export const findEmployeeByFace = async (descriptor, companyId, allDescriptors) => {
  // This will be done client-side using face-api.js FaceMatcher
  // We just need to return the user_id from the matched descriptor
  // allDescriptors should be an array of { user_id, descriptor }
  
  // For now, return the matched user_id from the client-side matching
  return null // Client-side matching will return user_id
}

/**
 * Apply bulk default attendance for selected employees over a date range.
 * Used for companies that don't use the live attendance terminal.
 */
export const applyBulkDefaultAttendance = async ({
  companyId,
  employeeIds,
  startDate,
  endDate,
  includeWeekends = false,
  includeHolidays = false,
  datesToExclude = [], // Array of date strings (yyyy-MM-dd) to exclude
  /** If set (non-empty), only these yyyy-MM-dd days get records — weekend/holiday toggles are ignored (user chose open days explicitly). */
  datesToInclude = null,
  standardHours = 8
}) => {
  if (!companyId || !employeeIds?.length || !startDate || !endDate) {
    throw new Error('Missing required data for bulk attendance')
  }

  // Use calendar dates in the local timezone only — `new Date('yyyy-MM-dd')` is UTC and breaks
  // range strings, leave overlap, and day bounds in many timezones.
  const start = startOfDay(parseISO(String(startDate).slice(0, 10)))
  const end = startOfDay(parseISO(String(endDate).slice(0, 10)))
  if (start > end) {
    throw new Error('Start date must be before end date')
  }

  const rangeFrom = format(start, 'yyyy-MM-dd')
  const rangeTo = format(end, 'yyyy-MM-dd')

  /** Approved leave: employee_id|yyyy-MM-dd — skip bulk "present" for these days */
  const leaveDaySet = new Set()
  try {
    const approvedLeaves = await getLeaveRequests(companyId, {
      status: 'approved',
      from: rangeFrom,
      to: rangeTo
    })
    for (const req of approvedLeaves) {
      const eid = req.employee_id != null ? String(req.employee_id).trim() : ''
      if (!eid || !req.start_date || !req.end_date) continue
      const ls = startOfDay(parseISO(String(req.start_date).slice(0, 10)))
      const le = startOfDay(parseISO(String(req.end_date).slice(0, 10)))
      if (Number.isNaN(ls.getTime()) || Number.isNaN(le.getTime()) || le < ls) continue
      for (let d = ls; d <= le; d = addDays(d, 1)) {
        leaveDaySet.add(`${eid}|${format(d, 'yyyy-MM-dd')}`)
      }
    }
  } catch (e) {
    console.warn('Could not load approved leave for bulk attendance skip:', e)
  }

  const employeesList = await getEmployees(companyId, { status: 'active' })
  const resolveEmployeeId = (bulkId) => {
    const b = bulkId != null ? String(bulkId).trim() : ''
    if (!b) return null
    const emp = employeesList.find((e) => String(e.$id) === b || String(e.user_id || '') === b)
    return emp?.$id != null ? String(emp.$id).trim() : null
  }

  // Holidays only matter when iterating the full range (no explicit day list).
  // Bulk UI always passes datesToInclude — skip holiday fetch to avoid failures blocking the whole apply.
  const useExplicitOpenDays =
    Array.isArray(datesToInclude) && datesToInclude.length > 0
  let holidayDates = new Set()
  if (!includeHolidays && !useExplicitOpenDays) {
    try {
      const year = start.getFullYear()
      const holidays = await getHolidays(companyId, { year })
      holidayDates = new Set(holidays.map((h) => h.holiday_date))
    } catch (e) {
      console.warn('Could not load holidays for bulk attendance, treating as no holidays:', e)
    }
  }

  const existingRecords = new Set()
  try {
    const existingDocs = await listAttendanceRecords({
      companyId,
      from: rangeFrom,
      to: rangeTo
    })
    existingDocs.forEach((rec) => {
      const uid = String(rec.user_id ?? '')
      const ds = String(rec.date ?? '').slice(0, 10)
      if (!uid || !ds) return
      existingRecords.add(`${uid}|${ds}`)
    })
  } catch (error) {
    console.warn('Could not fetch existing attendance records, proceeding anyway:', error)
  }

  // Convert datesToExclude to Set for fast lookup (yyyy-MM-dd)
  const excludeDates = new Set((datesToExclude || []).map((s) => String(s).slice(0, 10)))

  const explicitDays =
    Array.isArray(datesToInclude) && datesToInclude.length > 0
      ? [...new Set(datesToInclude.map((s) => String(s).slice(0, 10)))].sort()
      : null

  const recordsToCreate = []
  let skippedOnLeave = 0

  const processOneDate = (dateStr) => {
    const ds = String(dateStr).slice(0, 10)
    const d = parseISO(ds)
    if (Number.isNaN(d.getTime())) return
    if (ds < rangeFrom || ds > rangeTo) return

    // Skip if date is in the exclusion list
    if (excludeDates.has(ds)) return

    if (!explicitDays) {
      if (!includeWeekends && isWeekend(d)) return
      if (!includeHolidays && holidayDates.has(ds)) return
    }

    for (const userIdRaw of employeeIds) {
      const userId = String(userIdRaw ?? '').trim()
      if (!userId) continue
      const empId = resolveEmployeeId(userId)
      if (empId && leaveDaySet.has(`${empId}|${ds}`)) {
        skippedOnLeave++
        continue
      }

      // Skip if attendance record already exists
      const recordKey = `${userId}|${ds}`
      if (existingRecords.has(recordKey)) {
        continue
      }

      // Create a simple full-day attendance record
      const clockIn = new Date(`${ds}T09:00:00`)
      const clockOut = new Date(clockIn.getTime() + standardHours * 60 * 60 * 1000)

      const record = {
        user_id: userId,
        company_id: companyId,
        date: ds,
        auth_method: 'bulk',
        clock_in_time: clockIn.toISOString(),
        clock_out_time: clockOut.toISOString(),
        hours_worked: standardHours,
        overtime_hours: 0,
        location_lat: null,
        location_lng: null,
        location_address: '',
        reason: 'Bulk default attendance',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      recordsToCreate.push(record)
    }
  }

  if (explicitDays) {
    for (const dateStr of explicitDays) {
      processOneDate(dateStr)
    }
  } else {
    for (
      let d = new Date(start.getTime());
      d <= end;
      d = addDays(d, 1)
    ) {
      processOneDate(format(d, 'yyyy-MM-dd'))
    }
  }

  if (isLocalDataSource()) {
    if (!recordsToCreate.length) {
      return { created: 0, failed: 0, total: 0, skippedOnLeave }
    }
    const res = await localApiFetch('/api/attendance/batch', {
      method: 'POST',
      body: JSON.stringify({ company_id: companyId, records: recordsToCreate })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Bulk attendance failed')
    }
    const data = await res.json()
    const inserted = data.inserted ?? recordsToCreate.length
    return { created: inserted, failed: 0, total: recordsToCreate.length, skippedOnLeave }
  }

  const operations = recordsToCreate.map((record) =>
    databases.createDocument(DATABASE_ID, COLLECTIONS.ATTENDANCE, 'unique()', record)
  )

  // Helper function to sleep/delay
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  // Helper function to retry with exponential backoff
  const retryWithBackoff = async (operation, maxRetries = 3, baseDelay = 1000) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        // Check if it's a rate limit error (429)
        // Appwrite SDK errors can be in different formats
        const errorMessage = error?.message || error?.toString() || ''
        const errorCode = error?.code || error?.response?.status || error?.statusCode
        const isRateLimit = errorCode === 429 || 
                           errorMessage.includes('rate limit') || 
                           errorMessage.includes('Rate limit') ||
                           errorMessage.includes('429') ||
                           errorMessage.includes('exceeded')

        if (isRateLimit && attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s, etc.
          const delay = baseDelay * Math.pow(2, attempt)
          console.warn(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
          await sleep(delay)
          continue
        }
        throw error
      }
    }
  }

  // Run in smaller batches with delays to avoid rate limits
  const BATCH_SIZE = 10 // Reduced from 50 to avoid rate limits
  const DELAY_BETWEEN_BATCHES = 500 // 500ms delay between batches
  let created = 0
  let failed = 0

  for (let i = 0; i < operations.length; i += BATCH_SIZE) {
    const batch = operations.slice(i, i + BATCH_SIZE)
    
    // Process batch with retry logic
    const batchResults = await Promise.allSettled(
      batch.map(op => retryWithBackoff(() => op))
    )

    // Count successes and failures
    batchResults.forEach(result => {
      if (result.status === 'fulfilled') {
        created++
      } else {
        failed++
        console.error('Failed to create attendance record:', result.reason)
      }
    })

    // Add delay between batches (except for the last batch)
    if (i + BATCH_SIZE < operations.length) {
      await sleep(DELAY_BETWEEN_BATCHES)
    }
  }

  if (failed > 0) {
    console.warn(`${failed} attendance records failed to create (likely due to rate limits)`)
  }

  return { created, failed, total: operations.length, skippedOnLeave }
}

/**
 * Sync selected attendance days for one employee in a month/range.
 * - selected dates are ensured to exist
 * - unselected existing dates in range are removed
 */
export const syncEmployeeAttendanceDays = async ({
  companyId,
  userId,
  startDate,
  endDate,
  selectedDates = [],
  /** 'full' | 'half' per yyyy-MM-dd for selected days (half → hours_worked = standard/2) */
  dayModes = {},
  standardHours = 8
}) => {
  if (!companyId || !userId || !startDate || !endDate) {
    throw new Error('Missing required data for attendance sync')
  }

  const from = String(startDate).slice(0, 10)
  const to = String(endDate).slice(0, 10)
  const selectedSet = new Set(
    (selectedDates || [])
      .map((d) => String(d || '').slice(0, 10))
      .filter((d) => d && d >= from && d <= to)
  )

  if (isLocalDataSource()) {
    const res = await localApiFetch('/api/attendance/sync-days', {
      method: 'POST',
      body: JSON.stringify({
        company_id: companyId,
        user_id: userId,
        start_date: from,
        end_date: to,
        selected_dates: [...selectedSet],
        day_modes: dayModes,
        standard_hours: standardHours
      })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to sync attendance days')
    }
    return await res.json()
  }

  const existing = await listAttendanceRecords({
    companyId,
    userId,
    from,
    to
  })
  const existingByDate = new Map(existing.map((r) => [String(r.date).slice(0, 10), r]))

  const hoursForDate = (dateStr) =>
    dayModes[dateStr] === 'half' ? standardHours / 2 : standardHours

  const deletes = existing
    .filter((r) => !selectedSet.has(String(r.date).slice(0, 10)))
    .map((r) => databases.deleteDocument(DATABASE_ID, COLLECTIONS.ATTENDANCE, r.$id))

  const creates = []
  const updates = []
  const now = new Date().toISOString()
  for (const date of selectedSet) {
    const h = hoursForDate(date)
    const clockIn = new Date(`${date}T09:00:00`)
    const clockOut = new Date(clockIn.getTime() + h * 60 * 60 * 1000)
    const ex = existingByDate.get(date)
    if (ex) {
      updates.push(
        databases.updateDocument(DATABASE_ID, COLLECTIONS.ATTENDANCE, ex.$id, {
          clock_in_time: clockIn.toISOString(),
          clock_out_time: clockOut.toISOString(),
          hours_worked: h,
          overtime_hours: 0,
          reason:
            h < standardHours
              ? 'Historical attendance (half day)'
              : 'Historical attendance calendar sync',
          updated_at: now
        })
      )
      continue
    }
    creates.push(
      databases.createDocument(DATABASE_ID, COLLECTIONS.ATTENDANCE, 'unique()', {
        user_id: userId,
        company_id: companyId,
        date,
        auth_method: 'historical',
        clock_in_time: clockIn.toISOString(),
        clock_out_time: clockOut.toISOString(),
        hours_worked: h,
        overtime_hours: 0,
        location_lat: null,
        location_lng: null,
        location_address: '',
        reason: h < standardHours ? 'Historical attendance (half day)' : 'Historical attendance calendar sync',
        created_at: now,
        updated_at: now
      })
    )
  }

  const deleteResults = await Promise.allSettled(deletes)
  const createResults = await Promise.allSettled(creates)
  const updateResults = await Promise.allSettled(updates)
  const deleted = deleteResults.filter((r) => r.status === 'fulfilled').length
  const inserted = createResults.filter((r) => r.status === 'fulfilled').length
  const updated = updateResults.filter((r) => r.status === 'fulfilled').length
  const failed =
    deleteResults.filter((r) => r.status === 'rejected').length +
    createResults.filter((r) => r.status === 'rejected').length +
    updateResults.filter((r) => r.status === 'rejected').length
  if (failed > 0) {
    throw new Error(`Attendance sync partially failed (${failed} operations failed)`)
  }
  return { ok: true, inserted, updated, deleted, total_selected: selectedSet.size }
}
