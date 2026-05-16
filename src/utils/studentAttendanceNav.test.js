import { describe, it, expect } from 'vitest'
import { buildStudentMarkPath, buildStudentPeriodReportPath } from './studentAttendanceNav'

describe('studentAttendanceNav', () => {
  it('builds mark path with date and class', () => {
    const path = buildStudentMarkPath({
      date: '2026-05-15',
      classId: 'Form 1A',
      highlight: 'stu-1'
    })
    expect(path).toContain('view=mark')
    expect(path).toContain('date=2026-05-15')
    expect(path).toContain('class_id=Form+1A')
    expect(path).toContain('highlight=stu-1')
  })

  it('builds period report path with term dates', () => {
    const path = buildStudentPeriodReportPath({
      fromDate: '2026-01-06',
      toDate: '2026-04-04',
      classId: 'Form 2B'
    })
    expect(path).toContain('view=report')
    expect(path).toContain('from_date=2026-01-06')
    expect(path).toContain('to_date=2026-04-04')
    expect(path).toContain('class_id=Form+2B')
  })
})
