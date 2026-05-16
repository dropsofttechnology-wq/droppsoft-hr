import { describe, it, expect } from 'vitest'
import { hasPermission } from './permissions'

describe('hasPermission', () => {
  it('allows super_admin regardless of explicit permissions', () => {
    const user = { prefs: { role: 'super_admin', permissions: { operational_expenses: false } } }
    expect(hasPermission(user, 'operational_expenses')).toBe(true)
  })

  it('uses explicit prefs when the key is present', () => {
    const denied = { prefs: { role: 'admin', permissions: { operational_expenses: false } } }
    expect(hasPermission(denied, 'operational_expenses')).toBe(false)
    const allowed = { prefs: { role: 'employee', permissions: { operational_expenses: true } } }
    expect(hasPermission(allowed, 'operational_expenses')).toBe(true)
  })

  it('falls back to role defaults when the key is absent (Appwrite-style prefs)', () => {
    const admin = { prefs: { role: 'admin', permissions: {} } }
    expect(hasPermission(admin, 'operational_expenses')).toBe(true)
    expect(hasPermission(admin, 'operational_expenses_approval')).toBe(true)
    const cashier = { prefs: { role: 'cashier', permissions: {} } }
    expect(hasPermission(cashier, 'operational_expenses')).toBe(true)
    expect(hasPermission(cashier, 'operational_expenses_approval')).toBe(false)
    const employee = { prefs: { role: 'employee', permissions: {} } }
    expect(hasPermission(employee, 'operational_expenses')).toBe(false)
  })

  it('falls back for fee_ledger by role', () => {
    const manager = { prefs: { role: 'manager', permissions: {} } }
    expect(hasPermission(manager, 'fee_ledger')).toBe(true)
    const employee = { prefs: { role: 'employee', permissions: {} } }
    expect(hasPermission(employee, 'fee_ledger')).toBe(false)
  })

  it('falls back for cbc_grading by role', () => {
    const manager = { prefs: { role: 'manager' } }
    expect(hasPermission(manager, 'cbc_grading')).toBe(true)
    const employee = { prefs: { role: 'employee' } }
    expect(hasPermission(employee, 'cbc_grading')).toBe(false)
  })

  it('falls back for school_attendance by role', () => {
    const cashier = { prefs: { role: 'cashier', permissions: {} } }
    expect(hasPermission(cashier, 'school_attendance')).toBe(true)
    const employee = { prefs: { role: 'employee', permissions: {} } }
    expect(hasPermission(employee, 'school_attendance')).toBe(false)
  })
})
