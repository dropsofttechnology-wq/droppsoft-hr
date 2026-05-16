import { describe, it, expect } from 'vitest'
import {
  isStudentAttendanceAuditRow,
  studentAttendanceAuditDetailSummary,
  studentAttendanceOpenQueryFromAuditRow
} from './studentAttendanceAuditNav'

describe('studentAttendanceAuditNav', () => {
  it('detects student attendance audit rows', () => {
    expect(
      isStudentAttendanceAuditRow({
        entity_type: 'student_daily_attendance',
        action: 'student_attendance_daily_save'
      })
    ).toBe(true)
    expect(isStudentAttendanceAuditRow({ entity_type: 'attendance', action: 'attendance_clock_in' })).toBe(
      false
    )
  })

  it('summarizes save details', () => {
    const s = studentAttendanceAuditDetailSummary(null, {
      attendance_date: '2026-05-15',
      class_id: 'Form 1A',
      session_type: 'daily',
      saved: 28
    })
    expect(s).toContain('2026-05-15')
    expect(s).toContain('Form 1A')
    expect(s).toContain('28 mark(s) saved')
  })

  it('builds open query from new_value JSON', () => {
    const p = studentAttendanceOpenQueryFromAuditRow({
      entity_id: '2026-05-15:Form 1A',
      new_value: JSON.stringify({
        attendance_date: '2026-05-15',
        class_id: 'Form 1A',
        saved: 10
      })
    })
    expect(p?.get('view')).toBe('mark')
    expect(p?.get('date')).toBe('2026-05-15')
    expect(p?.get('class_id')).toBe('Form 1A')
  })
})
