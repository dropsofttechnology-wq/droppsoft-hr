import { describe, it, expect } from 'vitest'
import {
  escapeCsvCell,
  feeLedgerStudentLabel,
  buildAcademicYearsReportCsv,
  buildAcademicTermsReportCsv,
  buildFeeChargesCsv,
  buildFeePaymentsCsv
} from './feeLedgerCsvExport'

describe('feeLedgerCsvExport', () => {
  it('escapes commas and quotes', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"')
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""')
  })

  it('formats student label', () => {
    const students = [{ $id: 's1', student_number: '001', legal_name: 'Jane Doe' }]
    expect(feeLedgerStudentLabel(students, 's1')).toBe('001 — Jane Doe')
    expect(feeLedgerStudentLabel(students, 'missing')).toBe('missing')
  })

  it('builds charges CSV with resolved labels', () => {
    const csv = buildFeeChargesCsv(
      [
        {
          student_id: 's1',
          description: 'Tuition',
          amount: 12000,
          currency: 'KES',
          academic_year_id: 'y1',
          term_id: 't1',
          due_date: '2026-01-15',
          status: 'open'
        }
      ],
      {
        students: [{ $id: 's1', student_number: '001', legal_name: 'Jane' }],
        years: [{ $id: 'y1', label: '2025/26' }],
        terms: [{ $id: 't1', name: 'Term 1' }]
      }
    )
    expect(csv).toContain('student,description,amount')
    expect(csv).toContain('001 — Jane')
    expect(csv).toContain('2025/26')
    expect(csv).toContain('Term 1')
    expect(csv).toContain('Tuition')
  })

  it('builds academic years report CSV', () => {
    const csv = buildAcademicYearsReportCsv([
      {
        label: '2025/26',
        start_date: '2025-01-01',
        end_date: '2025-12-31',
        is_active: true,
        term_count: 3,
        charge_count: 5,
        charges_total: 100000,
        open_charges_total: 20000,
        payments_in_period_total: 80000
      }
    ])
    expect(csv).toContain('term_count,charge_count')
    expect(csv).toContain('2025/26')
    expect(csv).toContain('100000')
  })

  it('builds academic terms report CSV', () => {
    const csv = buildAcademicTermsReportCsv([
      {
        academic_year_label: '2025/26',
        name: 'Term 1',
        start_date: '2025-01-01',
        end_date: '2025-04-30',
        charge_count: 2,
        charges_total: 40000,
        open_charges_total: 5000,
        payments_in_period_total: 35000
      }
    ])
    expect(csv).toContain('academic_year,term_name')
    expect(csv).toContain('Term 1')
    expect(csv).toContain('35000')
  })

  it('builds payments CSV', () => {
    const csv = buildFeePaymentsCsv(
      [
        {
          student_id: 's1',
          amount: 5000,
          currency: 'KES',
          paid_on: '2026-02-01T00:00:00.000Z',
          payment_method: 'M-Pesa',
          reference: 'REF1',
          receipt_number: 'R-100',
          notes: 'partial'
        }
      ],
      { students: [{ $id: 's1', student_number: '001', legal_name: 'Jane' }] }
    )
    expect(csv).toContain('receipt_number')
    expect(csv).toContain('R-100')
    expect(csv).toContain('2026-02-01')
  })
})
