import { describe, it, expect } from 'vitest'
import {
  buildStudentDailyAttendanceCsv,
  buildStudentPeriodReportCsv,
  studentPeriodReportFilename
} from './studentAttendanceCsvExport'

describe('studentAttendanceCsvExport', () => {
  it('builds period report CSV', () => {
    const csv = buildStudentPeriodReportCsv({
      class_id: 'Form 1A',
      from_date: '2026-01-01',
      to_date: '2026-01-31',
      students: [
        {
          student_number: '001',
          legal_name: 'Jane',
          present: 18,
          absent: 2,
          late: 1,
          excused: 0,
          attendance_percentage: 90
        }
      ]
    })
    expect(csv).toContain('Admission No')
    expect(csv).toContain('Attendance Percentage')
    expect(csv).toContain('Jane')
    expect(csv).toContain('90%')
  })

  it('builds period report filename', () => {
    expect(studentPeriodReportFilename({ classId: 'Form 1A', fromDate: '2026-01-01', toDate: '2026-01-31' })).toBe(
      'Student_Attendance_Report_Form_1A_2026-01-01_to_2026-01-31.csv'
    )
  })

  it('builds daily register CSV', () => {
    const csv = buildStudentDailyAttendanceCsv({
      attendance_date: '2026-05-15',
      class_id: 'Form 1A',
      session_type: 'daily',
      rows: [
        { student_number: '001', legal_name: 'Jane', status: 'present' },
        { student_number: '002', legal_name: 'John', status: 'absent' }
      ]
    })
    expect(csv).toContain('attendance_date,class_id,session_type')
    expect(csv).toContain('Form 1A')
    expect(csv).toContain('Jane')
    expect(csv).toContain('absent')
  })
})
