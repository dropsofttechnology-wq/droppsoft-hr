/** Prefix for student roster QR payloads (distinct from staff / pairing codes). */
export const STUDENT_QR_PREFIX = 'STUDENT:'

/** Cooldown (ms) between accepting the same student ID in Fast Mode (avoids double triggers). */
export const STUDENT_QR_FAST_SCAN_COOLDOWN_MS = 2500

/**
 * @param {{ studentId: string, scannedAtMs: number } | null | undefined} last
 * @param {string} studentId
 * @param {number} [nowMs]
 * @returns {boolean} true if this scan should be ignored (duplicate within cooldown)
 */
export function shouldIgnoreFastScanDuplicate(last, studentId, nowMs = Date.now()) {
  const id = String(studentId || '').trim()
  if (!id || !last?.studentId) return false
  if (String(last.studentId) !== id) return false
  return nowMs - Number(last.scannedAtMs || 0) < STUDENT_QR_FAST_SCAN_COOLDOWN_MS
}

/**
 * @param {string} studentId
 * @returns {string}
 */
export function buildStudentQrPayload(studentId) {
  const id = String(studentId || '').trim()
  if (!id) return STUDENT_QR_PREFIX
  return `${STUDENT_QR_PREFIX}${id}`
}

/**
 * @param {string} raw
 * @returns {{ studentId: string } | null}
 */
export function parseStudentQrPayload(raw) {
  const t = String(raw || '').trim()
  if (t.length < STUDENT_QR_PREFIX.length) return null
  const head = t.slice(0, STUDENT_QR_PREFIX.length).toUpperCase()
  if (head !== STUDENT_QR_PREFIX.toUpperCase()) return null
  const studentId = t.slice(STUDENT_QR_PREFIX.length).trim()
  if (!studentId) return null
  return { studentId }
}
