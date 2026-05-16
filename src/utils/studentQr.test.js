import { describe, expect, it } from 'vitest'
import {
  buildStudentQrPayload,
  parseStudentQrPayload,
  shouldIgnoreFastScanDuplicate,
  STUDENT_QR_FAST_SCAN_COOLDOWN_MS,
  STUDENT_QR_PREFIX
} from './studentQr.js'

describe('studentQr', () => {
  it('builds and parses round-trip', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    const raw = buildStudentQrPayload(id)
    expect(raw.startsWith(STUDENT_QR_PREFIX)).toBe(true)
    expect(parseStudentQrPayload(raw)).toEqual({ studentId: id })
  })

  it('rejects staff-like payloads', () => {
    expect(parseStudentQrPayload('EMP:123')).toBe(null)
    expect(parseStudentQrPayload('')).toBe(null)
  })

  it('is case-insensitive on prefix only', () => {
    expect(parseStudentQrPayload('student:abc-1')).toEqual({ studentId: 'abc-1' })
  })

  it('ignores duplicate student within fast scan cooldown', () => {
    const id = 'a-b-c'
    const t0 = 1_000_000
    const last = { studentId: id, scannedAtMs: t0 }
    expect(shouldIgnoreFastScanDuplicate(last, id, t0 + STUDENT_QR_FAST_SCAN_COOLDOWN_MS - 1)).toBe(true)
    expect(shouldIgnoreFastScanDuplicate(last, id, t0 + STUDENT_QR_FAST_SCAN_COOLDOWN_MS)).toBe(false)
    expect(shouldIgnoreFastScanDuplicate(last, 'other', t0 + 100)).toBe(false)
    expect(shouldIgnoreFastScanDuplicate(null, id, t0)).toBe(false)
  })
})
