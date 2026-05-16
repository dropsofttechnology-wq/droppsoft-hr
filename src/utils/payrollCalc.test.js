import { describe, it, expect } from 'vitest'
import {
  computePAYE,
  computeNSSF,
  computeSHIF,
  computeAHL,
  computeAllowances,
  calculatePayrollLine,
  buildLeaveTypePayMap,
  computeUnpaidLeaveDayEquivalents
} from './payrollCalc'

describe('payrollCalc', () => {
  describe('computePAYE', () => {
    it('returns 0 for zero taxable pay', () => {
      expect(computePAYE(0)).toBe(0)
    })
    it('applies 10% for pay up to 24,000', () => {
      expect(computePAYE(24000, 0)).toBe(2400)
      expect(computePAYE(10000, 0)).toBe(1000)
    })
    it('applies 25% for band 24,001–32,333', () => {
      expect(computePAYE(30000, 0)).toBe(2400 + (30000 - 24000) * 0.25)
    })
    it('applies 30% above 32,333', () => {
      const pay = 50000
      const expected = 24000 * 0.1 + (32333 - 24000) * 0.25 + (50000 - 32333) * 0.3
      expect(computePAYE(pay, 0)).toBeCloseTo(expected, 2)
    })
    it('subtracts personal relief', () => {
      expect(computePAYE(24000, 2400)).toBe(0)
    })
  })

  describe('computeNSSF', () => {
    it('returns tier1 and tier2 for gross within limits', () => {
      const r = computeNSSF(10000, 7000, 36000)
      expect(r.nssf_employee).toBeGreaterThan(0)
      expect(r.nssf_employer).toBe(r.nssf_employee)
    })
    it('caps tier1 at 6% of 7000 when tier1Limit=7000', () => {
      const r = computeNSSF(7000, 7000, 36000)
      expect(r.nssf_employee).toBeCloseTo(7000 * 0.06, 2)
    })
  })

  describe('computeSHIF', () => {
    it('returns at least minimum for small gross', () => {
      const r = computeSHIF(5000, 2.75, 300)
      expect(r.shif_employee).toBe(300)
    })
    it('returns percentage of gross when above minimum', () => {
      const r = computeSHIF(20000, 2.75, 300)
      expect(r.shif_employee).toBeCloseTo(20000 * 0.0275, 2)
    })
  })

  describe('computeAHL', () => {
    it('returns 1.5% of gross by default', () => {
      const r = computeAHL(10000, 1.5)
      expect(r.ahl_employee).toBeCloseTo(150, 2)
    })
  })

  describe('computeAllowances', () => {
    it('returns fixed housing when type is fixed', () => {
      const r = computeAllowances({
        basicSalary: 50000,
        standardAllowance: 5000,
        housingAllowance: 10000,
        housingAllowanceType: 'fixed'
      })
      expect(r.housing_allowance).toBe(10000)
      expect(r.standard_allowance).toBe(5000)
    })
    it('returns percentage of basic when type is percentage', () => {
      const r = computeAllowances({
        basicSalary: 50000,
        standardAllowance: 0,
        housingAllowance: 15,
        housingAllowanceType: 'percentage'
      })
      expect(r.housing_allowance).toBeCloseTo(7500, 2)
    })
  })

  describe('calculatePayrollLine', () => {
    const baseEmployee = {
      $id: 'emp1',
      name: 'Test Employee',
      basic_salary: 50000,
      department: 'IT',
      position: 'Developer'
    }
    const baseSettings = {
      pay_date: 25,
      standard_allowance: 5000,
      housing_allowance: 10000,
      housing_allowance_type: 'fixed',
      working_hours: 8,
      overtime_rate: 0,
      overtime_rate_type: 'fixed',
      shif_rate: 2.75,
      shif_minimum: 300,
      nssf_tier1_limit: 7000,
      nssf_tier2_limit: 36000,
      ahl_rate: 1.5,
      personal_relief: 2400
    }

    it('returns gross and net for employee with no attendance', () => {
      const line = calculatePayrollLine({
        employee: baseEmployee,
        attendanceRecords: [],
        period: '2026-02',
        settings: baseSettings
      })
      expect(line).toBeDefined()
      expect(line.basic_salary).toBe(50000)
      expect(line.gross_pay).toBeGreaterThan(0)
      expect(line.net_pay).toBeDefined()
      expect(Number.isInteger(line.net_pay)).toBe(true)
      expect(Number.isInteger(line.actual_net)).toBe(true)
      expect(Number.isInteger(line.projected_net)).toBe(true)
    })

    it('includes statutory deductions', () => {
      const line = calculatePayrollLine({
        employee: baseEmployee,
        attendanceRecords: [],
        period: '2026-02',
        settings: baseSettings
      })
      expect(line.paye).toBeDefined()
      expect(line.nssf_employee).toBeDefined()
      expect(line.shif_employee).toBeDefined()
      expect(line.ahl_employee).toBeDefined()
    })

    it('deducts unpaid leave at (Basic+HSE)/30 per calendar day in period', () => {
      const map = buildLeaveTypePayMap([{ leave_code: 'UNPAID', pay_percentage: 0 }])
      const approvedLeaves = [
        {
          employee_id: 'emp1',
          leave_type: 'UNPAID',
          start_date: '2026-02-10',
          end_date: '2026-02-12'
        }
      ]
      const unpaidEq = computeUnpaidLeaveDayEquivalents({
        employeeId: 'emp1',
        period: '2026-02',
        approvedLeaves,
        leaveTypePayMap: map,
        payDate: 25
      })
      expect(unpaidEq).toBe(3)

      const line = calculatePayrollLine({
        employee: baseEmployee,
        attendanceRecords: [],
        period: '2026-02',
        settings: baseSettings,
        unpaidLeaveDayEquivalents: unpaidEq
      })
      // Day rate = (50000 + 10000 HSE) / 30; standard allowance not included
      expect(line.unpaid_leave_deduction).toBeCloseTo((60000 / 30) * 3, 1)
      expect(line.manual_absence_deduction).toBe(0)
      expect(line.absence_deduction).toBe(line.unpaid_leave_deduction)
      const grossBefore = line.basic_salary + line.allowances + line.overtime_pay + line.holiday_pay
      expect(line.total_earn).toBeCloseTo(grossBefore - line.absence_deduction, 2)
    })

    it('does not count unpaid leave days after pay date in the same month (moved to next payroll)', () => {
      const map = buildLeaveTypePayMap([{ leave_code: 'UNPAID', pay_percentage: 0 }])
      const approvedLeaves = [
        {
          employee_id: 'emp1',
          leave_type: 'UNPAID',
          start_date: '2026-02-26',
          end_date: '2026-02-28'
        }
      ]
      const feb = computeUnpaidLeaveDayEquivalents({
        employeeId: 'emp1',
        period: '2026-02',
        approvedLeaves,
        leaveTypePayMap: map,
        payDate: 25
      })
      expect(feb).toBe(0)
      const mar = computeUnpaidLeaveDayEquivalents({
        employeeId: 'emp1',
        period: '2026-03',
        approvedLeaves,
        leaveTypePayMap: map,
        payDate: 25
      })
      expect(mar).toBe(3)
    })

    it('adds SUN/HOLIDAY for attended Sundays in the payroll window (no public holiday needed)', () => {
      // 1 Feb 2026 is a Sunday; pay day 25 → 1st is in current-month window
      const line = calculatePayrollLine({
        employee: baseEmployee,
        attendanceRecords: [{ date: '2026-02-01', hours_worked: 8, user_id: 'u1' }],
        period: '2026-02',
        settings: baseSettings,
        holidaysInPeriod: []
      })
      const baseBasicHse = 50000 + 10000
      const daily = baseBasicHse / 30
      expect(line.holiday_pay).toBeCloseTo(daily, 1)
    })

    it('pays half the Sunday SUN/HOLIDAY top-up when hours_worked is half the standard day', () => {
      const line = calculatePayrollLine({
        employee: baseEmployee,
        attendanceRecords: [{ date: '2026-02-01', hours_worked: 4, user_id: 'u1' }],
        period: '2026-02',
        settings: { ...baseSettings, working_hours: 8 },
        holidaysInPeriod: []
      })
      const baseBasicHse = 50000 + 10000
      const daily = baseBasicHse / 30
      expect(line.holiday_pay).toBeCloseTo(daily * 0.5, 1)
    })

    it('counts previous-month days on or after pay date in this payroll period', () => {
      const map = buildLeaveTypePayMap([{ leave_code: 'UNPAID', pay_percentage: 0 }])
      const approvedLeaves = [
        {
          employee_id: 'emp1',
          leave_type: 'UNPAID',
          start_date: '2026-01-26',
          end_date: '2026-01-31'
        }
      ]
      const febPayroll = computeUnpaidLeaveDayEquivalents({
        employeeId: 'emp1',
        period: '2026-02',
        approvedLeaves,
        leaveTypePayMap: map,
        payDate: 25
      })
      expect(febPayroll).toBe(6)
    })

    it('defers unpaid leave on pay date in current month to next payroll', () => {
      const map = buildLeaveTypePayMap([{ leave_code: 'UNPAID', pay_percentage: 0 }])
      const approvedLeaves = [
        {
          employee_id: 'emp1',
          leave_type: 'UNPAID',
          start_date: '2026-02-25',
          end_date: '2026-02-25'
        }
      ]
      const inFeb = computeUnpaidLeaveDayEquivalents({
        employeeId: 'emp1',
        period: '2026-02',
        approvedLeaves,
        leaveTypePayMap: map,
        payDate: 25
      })
      expect(inFeb).toBe(0)
      const inMar = computeUnpaidLeaveDayEquivalents({
        employeeId: 'emp1',
        period: '2026-03',
        approvedLeaves,
        leaveTypePayMap: map,
        payDate: 25
      })
      expect(inMar).toBe(1)
    })
  })
})
