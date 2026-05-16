import { describe, expect, it } from 'vitest'
import {
  feeLedgerAuditDetailSummary,
  feeLedgerOpenQueryFromAuditRow,
  feeLedgerTabFromAuditRow,
  isFeeLedgerAuditRow,
  resolveFeeLedgerEntityTab
} from './feeLedgerAuditNav.js'

describe('isFeeLedgerAuditRow', () => {
  it('returns true for fee ledger entity types', () => {
    expect(isFeeLedgerAuditRow({ entity_type: 'students' })).toBe(true)
    expect(isFeeLedgerAuditRow({ entity_type: 'fee_charges' })).toBe(true)
  })

  it('returns true for fee ledger action prefixes without entity_type', () => {
    expect(isFeeLedgerAuditRow({ action: 'fee_student_create' })).toBe(true)
    expect(isFeeLedgerAuditRow({ action: 'fee_charge_update' })).toBe(true)
  })

  it('returns false for unrelated rows', () => {
    expect(isFeeLedgerAuditRow({})).toBe(false)
    expect(isFeeLedgerAuditRow({ entity_type: 'employees' })).toBe(false)
    expect(isFeeLedgerAuditRow({ action: 'leave_request_create' })).toBe(false)
  })
})

describe('feeLedgerAuditDetailSummary', () => {
  it('shows student fields from audit JSON', () => {
    expect(
      feeLedgerAuditDetailSummary(null, { student_number: 'S1', legal_name: 'Jane Doe' })
    ).toBe('Jane Doe · S1')
  })

  it('shows before → after when values differ', () => {
    expect(
      feeLedgerAuditDetailSummary({ status: 'open' }, { status: 'settled', description: 'Tuition' })
    ).toBe('open → Tuition · settled')
  })
})

describe('feeLedgerOpenQueryFromAuditRow', () => {
  it('sets highlight and tab when entity_id present', () => {
    const p = feeLedgerOpenQueryFromAuditRow({
      entity_id: 'e1',
      entity_type: 'fee_charges'
    })
    expect(p.get('highlight')).toBe('e1')
    expect(p.get('tab')).toBe('charges')
  })

  it('sets highlight only when tab cannot be inferred', () => {
    const p = feeLedgerOpenQueryFromAuditRow({ entity_id: 'x', action: 'unknown' })
    expect(p.get('highlight')).toBe('x')
    expect(p.get('tab')).toBeNull()
  })

  it('returns null without entity_id', () => {
    expect(feeLedgerOpenQueryFromAuditRow({ entity_type: 'students' })).toBeNull()
  })
})

describe('feeLedgerTabFromAuditRow', () => {
  it('maps entity_type to tab', () => {
    expect(feeLedgerTabFromAuditRow({ entity_type: 'academic_years' })).toBe('years')
    expect(feeLedgerTabFromAuditRow({ entity_type: 'academic_terms' })).toBe('terms')
    expect(feeLedgerTabFromAuditRow({ entity_type: 'students' })).toBe('students')
    expect(feeLedgerTabFromAuditRow({ entity_type: 'fee_charges' })).toBe('charges')
    expect(feeLedgerTabFromAuditRow({ entity_type: 'fee_payments' })).toBe('payments')
  })

  it('falls back to action prefix when entity_type missing', () => {
    expect(feeLedgerTabFromAuditRow({ action: 'academic_year_create' })).toBe('years')
    expect(feeLedgerTabFromAuditRow({ action: 'academic_term_update' })).toBe('terms')
    expect(feeLedgerTabFromAuditRow({ action: 'fee_student_delete' })).toBe('students')
    expect(feeLedgerTabFromAuditRow({ action: 'fee_charge_create' })).toBe('charges')
    expect(feeLedgerTabFromAuditRow({ action: 'fee_payment_update' })).toBe('payments')
  })

  it('prefers entity_type over action', () => {
    expect(
      feeLedgerTabFromAuditRow({ entity_type: 'fee_payments', action: 'fee_charge_create' })
    ).toBe('payments')
  })

  it('returns null when not fee ledger metadata', () => {
    expect(feeLedgerTabFromAuditRow({})).toBeNull()
    expect(feeLedgerTabFromAuditRow({ entity_type: 'employees' })).toBeNull()
  })
})

describe('resolveFeeLedgerEntityTab', () => {
  const cols = {
    years: [{ $id: 'y1' }],
    terms: [{ id: 't1' }],
    students: [{ $id: 's1' }],
    charges: [{ $id: 'c1' }],
    payments: [{ $id: 'p1' }]
  }

  it('resolves in year → term → student → charge → payment order', () => {
    expect(resolveFeeLedgerEntityTab('y1', cols)).toBe('years')
    expect(resolveFeeLedgerEntityTab('t1', cols)).toBe('terms')
    expect(resolveFeeLedgerEntityTab('s1', cols)).toBe('students')
    expect(resolveFeeLedgerEntityTab('c1', cols)).toBe('charges')
    expect(resolveFeeLedgerEntityTab('p1', cols)).toBe('payments')
  })

  it('returns null for unknown id', () => {
    expect(resolveFeeLedgerEntityTab('nope', cols)).toBeNull()
    expect(resolveFeeLedgerEntityTab('', cols)).toBeNull()
  })
})
