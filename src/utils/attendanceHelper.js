/**
 * Check if a clock-in is within the reporting grace period (on time).
 * @param {string} clockInIso - ISO date string of clock-in (e.g. from record.clock_in_time)
 * @param {string} dateStr - Date of the record (yyyy-MM-dd)
 * @param {{ official_reporting_time?: string, reporting_grace_minutes?: string|number }} settings
 * @returns {boolean} - true if on time (within official time + grace), false if late or no clock-in
 */
export const isClockInOnTime = (clockInIso, dateStr, settings = {}) => {
  if (!clockInIso || !dateStr) return false
  const official = (settings.official_reporting_time || '08:00').trim()
  const graceMinutes = Math.max(0, parseInt(settings.reporting_grace_minutes, 10) || 15)
  const [h, m] = official.split(':').map(Number)
  const deadline = new Date(dateStr)
  deadline.setHours(h || 0, (m || 0) + graceMinutes, 0, 0)
  const clockIn = new Date(clockInIso)
  return clockIn <= deadline
}
