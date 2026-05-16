import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addMonths, format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import { getEmployees } from '../services/employeeService'
import { mergeUpsertEmployeeDeduction } from '../services/employeeDeductionsService'
import { createLeaveRequest, approveLeaveRequest, getLeaveTypes } from '../services/leaveService'
import { isPeriodClosed } from '../services/periodClosureService'
import { splitMoneyIntoInstallments } from '../utils/moneySplit'
import { sortEmployeesByEmployeeId } from '../utils/employeeSort.js'
import './OpeningBalances.css'

/** Accepts "1,234.50" or plain numbers */
function parseMoneyInput(raw) {
  if (raw == null || raw === '') return 0
  const n = Number.parseFloat(String(raw).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

function formatMoneyShort(n) {
  if (!Number.isFinite(n) || n === 0) return '0'
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function addMonthsToPeriod(periodYYYYMM, delta) {
  const d = parseISO(`${periodYYYYMM}-01`)
  return format(addMonths(d, delta), 'yyyy-MM')
}

function buildPreviewLines(r, deductionStartPeriod) {
  const adv = parseMoneyInput(r.advance_total)
  const shop = parseMoneyInput(r.shopping_total)
  const advN =
    adv <= 0 ? 0 : Math.max(1, Math.min(60, parseInt(String(r.advance_installments), 10) || 1))
  const shopN =
    shop <= 0 ? 0 : Math.max(1, Math.min(60, parseInt(String(r.shopping_installments), 10) || 1))
  if (advN === 0 && shopN === 0) return null

  const advSlices = advN ? splitMoneyIntoInstallments(adv, advN) : []
  const shopSlices = shopN ? splitMoneyIntoInstallments(shop, shopN) : []
  const maxLen = Math.max(advSlices.length, shopSlices.length)
  const lines = []
  const cap = 4
  for (let i = 0; i < Math.min(maxLen, cap); i++) {
    const p = addMonthsToPeriod(deductionStartPeriod, i)
    const a = advSlices[i] != null ? formatMoneyShort(advSlices[i]) : '—'
    const s = shopSlices[i] != null ? formatMoneyShort(shopSlices[i]) : '—'
    lines.push(`${p}: adv ${a} · shop ${s}`)
  }
  if (maxLen > cap) lines.push(`… +${maxLen - cap} more month(s)`)
  return lines
}

function buildDeductionSchedule({
  sourcePeriod,
  deductionStartPeriod,
  absentDays,
  advanceTotal,
  advanceInstallments,
  shoppingTotal,
  shoppingInstallments
}) {
  const advTotal = parseMoneyInput(advanceTotal)
  const shopTotal = parseMoneyInput(shoppingTotal)
  const advN =
    advTotal <= 0 ? 0 : Math.max(1, Math.min(60, parseInt(String(advanceInstallments), 10) || 1))
  const shopN =
    shopTotal <= 0 ? 0 : Math.max(1, Math.min(60, parseInt(String(shoppingInstallments), 10) || 1))
  const advSlices = advN === 0 ? [] : splitMoneyIntoInstallments(advTotal, advN)
  const shopSlices = shopN === 0 ? [] : splitMoneyIntoInstallments(shopTotal, shopN)

  const schedule = {}

  const absentVal = Math.max(0, Math.min(30, parseInt(String(absentDays), 10) || 0))
  if (absentVal > 0) {
    schedule[sourcePeriod] = {
      absentDays: absentVal,
      advanceAmount: 0,
      shoppingAmount: 0
    }
  }

  for (let i = 0; i < advSlices.length; i++) {
    const p = addMonthsToPeriod(deductionStartPeriod, i)
    if (!schedule[p]) {
      schedule[p] = { absentDays: null, advanceAmount: 0, shoppingAmount: 0 }
    }
    schedule[p].advanceAmount = advSlices[i]
  }

  for (let i = 0; i < shopSlices.length; i++) {
    const p = addMonthsToPeriod(deductionStartPeriod, i)
    if (!schedule[p]) {
      schedule[p] = { absentDays: null, advanceAmount: 0, shoppingAmount: 0 }
    }
    schedule[p].shoppingAmount = shopSlices[i]
  }

  return { schedule, periods: Object.keys(schedule).sort() }
}

const emptyRow = () => ({
  absent_days: '',
  advance_total: '',
  advance_installments: '1',
  shopping_total: '',
  shopping_installments: '1',
  leave_type: '',
  leave_start: '',
  leave_end: '',
  leave_reason: 'Opening balance / carryover'
})

const OpeningBalances = () => {
  const { currentCompany } = useCompany()
  const { user } = useAuth()

  const defaultMonth = format(new Date(), 'yyyy-MM')
  const prevMonth = format(addMonths(new Date(), -1), 'yyyy-MM')

  const [sourcePeriod, setSourcePeriod] = useState(prevMonth)
  const [deductionStartPeriod, setDeductionStartPeriod] = useState(defaultMonth)
  const [effectiveDay, setEffectiveDay] = useState('')

  const [employees, setEmployees] = useState([])
  const [rows, setRows] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [employeeQuery, setEmployeeQuery] = useState('')
  const [leaveOpen, setLeaveOpen] = useState({})
  const [leaveTypes, setLeaveTypes] = useState([])

  useEffect(() => {
    if (!currentCompany) return
    ;(async () => {
      setLoading(true)
      try {
        const emps = await getEmployees(currentCompany.$id, { status: 'active' })
        setEmployees(emps)
        const init = {}
        emps.forEach((e) => {
          init[e.$id] = emptyRow()
        })
        setRows(init)
      } catch (e) {
        toast.error(e.message || 'Failed to load employees')
      } finally {
        setLoading(false)
      }
    })()
  }, [currentCompany])

  useEffect(() => {
    if (!currentCompany) return
    ;(async () => {
      try {
        const types = await getLeaveTypes(currentCompany.$id, true)
        setLeaveTypes(Array.isArray(types) ? types : [])
      } catch (e) {
        console.error(e)
        setLeaveTypes([])
      }
    })()
  }, [currentCompany])

  const filteredEmployees = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase()
    if (!q) return employees
    const filtered = employees.filter((e) => {
      const name = (e.name || '').toLowerCase()
      const id = String(e.employee_id || e.staff_no || '').toLowerCase()
      return name.includes(q) || id.includes(q)
    })
    return sortEmployeesByEmployeeId(filtered)
  }, [employees, employeeQuery])

  const rowsWithDataCount = useMemo(() => {
    return employees.filter((e) => {
      const r = rows[e.$id] || emptyRow()
      const hasAbsent = String(r.absent_days || '').trim() !== '' && Number(r.absent_days) > 0
      const hasAdv = parseMoneyInput(r.advance_total) > 0
      const hasShop = parseMoneyInput(r.shopping_total) > 0
      const hasLeave = r.leave_type && r.leave_start && r.leave_end
      return hasAbsent || hasAdv || hasShop || hasLeave
    }).length
  }, [employees, rows])

  const updateRow = (employeeId, patch) => {
    setRows((prev) => ({
      ...prev,
      [employeeId]: { ...emptyRow(), ...prev[employeeId], ...patch }
    }))
  }

  const clearRow = (employeeId) => {
    setRows((prev) => ({
      ...prev,
      [employeeId]: emptyRow()
    }))
    setLeaveOpen((prev) => ({ ...prev, [employeeId]: false }))
  }

  const copyInstallmentsFromAdvance = (employeeId) => {
    setRows((prev) => {
      const cur = prev[employeeId] || emptyRow()
      return {
        ...prev,
        [employeeId]: {
          ...emptyRow(),
          ...cur,
          shopping_installments: cur.advance_installments || '1'
        }
      }
    })
  }

  const setDeductionMonthAfterSource = () => {
    setDeductionStartPeriod(addMonthsToPeriod(sourcePeriod, 1))
    toast.success('First deduction month set to the month after the source month.')
  }

  const handleSave = async () => {
    if (!currentCompany) {
      toast.error('Select a company first')
      return
    }

    const toSave = employees.filter((e) => {
      const r = rows[e.$id] || emptyRow()
      const hasAbsent = String(r.absent_days || '').trim() !== '' && Number(r.absent_days) > 0
      const hasAdv = parseMoneyInput(r.advance_total) > 0
      const hasShop = parseMoneyInput(r.shopping_total) > 0
      const hasLeave = r.leave_type && r.leave_start && r.leave_end
      return hasAbsent || hasAdv || hasShop || hasLeave
    })

    if (!toSave.length) {
      toast.error('Enter at least one value for at least one employee (absences, advance, shopping, or leave).')
      return
    }

    for (const emp of toSave) {
      const r = rows[emp.$id] || emptyRow()
      const leaveBits = [r.leave_type, r.leave_start, r.leave_end].filter(Boolean).length
      if (leaveBits > 0 && leaveBits < 3) {
        toast.error(
          `${emp.name}: complete leave type, start date, and end date, or clear all leave fields for that employee.`
        )
        return
      }
    }

    setSaving(true)
    try {
      const uniquePeriods = new Set()
      for (const emp of toSave) {
        const r = rows[emp.$id] || emptyRow()
        const { schedule } = buildDeductionSchedule({
          sourcePeriod,
          deductionStartPeriod,
          absentDays: r.absent_days,
          advanceTotal: r.advance_total,
          advanceInstallments: r.advance_installments,
          shoppingTotal: r.shopping_total,
          shoppingInstallments: r.shopping_installments
        })
        Object.keys(schedule).forEach((p) => uniquePeriods.add(p))
      }

      for (const period of uniquePeriods) {
        const closed = await isPeriodClosed(currentCompany.$id, period)
        if (closed) {
          toast.error(`Payroll period ${period} is closed. Open it or pick different months.`)
          setSaving(false)
          return
        }
      }

      let savedRows = 0
      let leaveCount = 0

      const noteParts = [
        'Opening balance carryover',
        `source period: ${sourcePeriod}`,
        `deductions from: ${deductionStartPeriod}`
      ]
      if (effectiveDay) noteParts.push(`effective day: ${effectiveDay}`)
      const notes = noteParts.join('; ')

      for (const emp of toSave) {
        const r = rows[emp.$id] || emptyRow()
        const { schedule } = buildDeductionSchedule({
          sourcePeriod,
          deductionStartPeriod,
          absentDays: r.absent_days,
          advanceTotal: r.advance_total,
          advanceInstallments: r.advance_installments,
          shoppingTotal: r.shopping_total,
          shoppingInstallments: r.shopping_installments
        })

        for (const period of Object.keys(schedule).sort()) {
          const cell = schedule[period]
          await mergeUpsertEmployeeDeduction({
            companyId: currentCompany.$id,
            employeeId: emp.$id,
            period,
            absentDays: cell.absentDays === null ? undefined : cell.absentDays,
            advanceAmount: cell.advanceAmount,
            shoppingAmount: cell.shoppingAmount,
            notes
          })
          savedRows++
        }

        if (r.leave_type && r.leave_start && r.leave_end) {
          try {
            const lr = await createLeaveRequest({
              company_id: currentCompany.$id,
              employee_id: emp.$id,
              leave_type: r.leave_type,
              start_date: r.leave_start,
              end_date: r.leave_end,
              reason: r.leave_reason || 'Opening balance carryover'
            })
            await approveLeaveRequest(lr.$id || lr.id, user?.$id)
            leaveCount++
          } catch (le) {
            console.error(le)
            toast.error(`${emp.name}: leave failed — ${le.message || 'overlap or invalid dates'}`)
          }
        }
      }

      toast.success(
        `Saved carryover data (${savedRows} period row updates).${leaveCount ? ` ${leaveCount} leave record(s) approved.` : ''}`
      )
    } catch (e) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const periodHint = useMemo(
    () =>
      `Record absences against “Source month”. Split advance & shopping across monthly payroll deductions starting from “First deduction month”.`,
    []
  )

  if (!currentCompany) {
    return (
      <div className="opening-balances">
        <div className="alert alert-warning">Select a company first.</div>
      </div>
    )
  }

  return (
    <div className="opening-balances">
      <header className="ob-header">
        <h1>Opening balances & carryover</h1>
        <p className="ob-lead">
          For new companies or when moving from another system: capture <strong>absence days</strong> from a past month,
          <strong> salary advance</strong> and <strong>shopping</strong> balances to recover from pay, and optional{' '}
          <strong>leave</strong> already taken. Choose which payroll month deductions begin and how many{' '}
          <strong>monthly installments</strong> apply to each balance.
        </p>
      </header>

      <section className="ob-card">
        <h2>Periods &amp; effective date</h2>
        <p className="ob-hint">{periodHint}</p>
        <div className="ob-quick-actions" role="group" aria-label="Quick period presets">
          <span className="ob-quick-label">Quick set:</span>
          <button
            type="button"
            className="ob-btn-ghost"
            onClick={() => setSourcePeriod(format(addMonths(new Date(), -1), 'yyyy-MM'))}
          >
            Source = last month
          </button>
          <button type="button" className="ob-btn-ghost" onClick={() => setSourcePeriod(format(new Date(), 'yyyy-MM'))}>
            Source = this month
          </button>
          <button
            type="button"
            className="ob-btn-ghost"
            onClick={() => setDeductionStartPeriod(format(new Date(), 'yyyy-MM'))}
          >
            Deductions start this month
          </button>
          <button type="button" className="ob-btn-ghost ob-btn-primary-soft" onClick={setDeductionMonthAfterSource}>
            Deductions start month after source
          </button>
        </div>
        <div className="ob-grid">
          <label>
            Source month (where absence days are recorded)
            <input
              type="month"
              value={sourcePeriod}
              onChange={(e) => setSourcePeriod(e.target.value)}
            />
          </label>
          <label>
            First payroll month to deduct advance / shopping
            <input
              type="month"
              value={deductionStartPeriod}
              onChange={(e) => setDeductionStartPeriod(e.target.value)}
            />
          </label>
          <label>
            Effective day of month (optional, 1–31)
            <input
              type="number"
              min={1}
              max={31}
              placeholder="e.g. 15"
              value={effectiveDay}
              onChange={(e) => setEffectiveDay(e.target.value)}
            />
          </label>
        </div>
      </section>

      {loading ? (
        <p>Loading employees…</p>
      ) : (
        <>
          <section className="ob-toolbar ob-card">
            <div className="ob-toolbar-row">
              <label className="ob-search">
                <span className="ob-search-label">Find employee</span>
                <input
                  type="search"
                  placeholder="Name or staff ID…"
                  value={employeeQuery}
                  onChange={(e) => setEmployeeQuery(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <p className="ob-toolbar-meta">
                Showing <strong>{filteredEmployees.length}</strong> of {employees.length} employees
                {rowsWithDataCount > 0 ? (
                  <>
                    {' '}
                    · <strong>{rowsWithDataCount}</strong> with data to save
                  </>
                ) : null}
              </p>
            </div>
          </section>

          {filteredEmployees.length === 0 ? (
            <p className="ob-empty">No employees match your search. Clear the box above to see everyone.</p>
          ) : (
            <div className="ob-table-wrap">
              <table className="ob-table">
                <thead>
                  <tr>
                    <th className="ob-col-sticky">Employee</th>
                    <th>
                      Absent days
                      <span className="ob-th-sub">(source month)</span>
                    </th>
                    <th>Advance (KES)</th>
                    <th>
                      # Months
                      <span className="ob-th-sub">(advance)</span>
                    </th>
                    <th>Shopping (KES)</th>
                    <th>
                      # Months
                      <span className="ob-th-sub">(shopping)</span>
                    </th>
                    <th>
                      Deduction preview
                      <span className="ob-th-sub">(from first deduction month)</span>
                    </th>
                    <th className="ob-col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => {
                    const r = rows[emp.$id] || emptyRow()
                    const previewLines = buildPreviewLines(r, deductionStartPeriod)
                    const leaveExpanded = !!leaveOpen[emp.$id]
                    return (
                      <Fragment key={emp.$id}>
                        <tr>
                          <td className="ob-col-sticky">
                            <strong>{emp.name}</strong>
                            <div className="ob-muted">{emp.employee_id || emp.staff_no || '—'}</div>
                          </td>
                          <td>
                            <input
                              className="ob-input-sm"
                              type="number"
                              min={0}
                              max={30}
                              aria-label={`Absent days for ${emp.name}`}
                              value={r.absent_days}
                              onChange={(e) => updateRow(emp.$id, { absent_days: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              className="ob-input"
                              type="text"
                              inputMode="decimal"
                              placeholder="0 or 1,000"
                              aria-label={`Advance total for ${emp.name}`}
                              value={r.advance_total}
                              onChange={(e) => updateRow(emp.$id, { advance_total: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              className="ob-input-sm"
                              type="number"
                              min={1}
                              max={60}
                              aria-label={`Advance installments for ${emp.name}`}
                              value={r.advance_installments}
                              onChange={(e) => updateRow(emp.$id, { advance_installments: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              className="ob-input"
                              type="text"
                              inputMode="decimal"
                              placeholder="0 or 1,000"
                              aria-label={`Shopping total for ${emp.name}`}
                              value={r.shopping_total}
                              onChange={(e) => updateRow(emp.$id, { shopping_total: e.target.value })}
                            />
                          </td>
                          <td>
                            <div className="ob-inst-wrap">
                              <input
                                className="ob-input-sm"
                                type="number"
                                min={1}
                                max={60}
                                aria-label={`Shopping installments for ${emp.name}`}
                                value={r.shopping_installments}
                                onChange={(e) => updateRow(emp.$id, { shopping_installments: e.target.value })}
                              />
                              <button
                                type="button"
                                className="ob-btn-link"
                                title="Use the same number of months as advance"
                                onClick={() => copyInstallmentsFromAdvance(emp.$id)}
                              >
                                Same as advance
                              </button>
                            </div>
                          </td>
                          <td className="ob-preview-cell">
                            {previewLines ? (
                              <ul className="ob-preview-list">
                                {previewLines.map((line, i) => (
                                  <li key={i}>{line}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="ob-muted">—</span>
                            )}
                          </td>
                          <td className="ob-col-actions">
                            <div className="ob-action-btns">
                              <button
                                type="button"
                                className={leaveExpanded ? 'ob-btn-toggle is-on' : 'ob-btn-toggle'}
                                onClick={() =>
                                  setLeaveOpen((prev) => ({ ...prev, [emp.$id]: !prev[emp.$id] }))
                                }
                              >
                                {leaveExpanded ? 'Hide leave' : 'Carryover leave'}
                              </button>
                              <button type="button" className="ob-btn-link-danger" onClick={() => clearRow(emp.$id)}>
                                Clear row
                              </button>
                            </div>
                          </td>
                        </tr>
                        {leaveExpanded ? (
                          <tr className="ob-subrow">
                            <td colSpan={8}>
                              <div className="ob-leave-panel">
                                <div className="ob-leave-grid">
                                  <label>
                                    Leave type
                                    <select
                                      value={r.leave_type}
                                      onChange={(e) => updateRow(emp.$id, { leave_type: e.target.value })}
                                    >
                                      <option value="">— Select —</option>
                                      {leaveTypes.map((lt) => {
                                        const code = lt.leave_code || lt.leaveCode || ''
                                        const name = lt.leave_name || lt.leaveName || code
                                        return (
                                          <option key={lt.$id || lt.id || code} value={code}>
                                            {code} — {name}
                                          </option>
                                        )
                                      })}
                                    </select>
                                  </label>
                                  <label>
                                    Start date
                                    <input
                                      type="date"
                                      value={r.leave_start}
                                      onChange={(e) => updateRow(emp.$id, { leave_start: e.target.value })}
                                    />
                                  </label>
                                  <label>
                                    End date
                                    <input
                                      type="date"
                                      value={r.leave_end}
                                      onChange={(e) => updateRow(emp.$id, { leave_end: e.target.value })}
                                    />
                                  </label>
                                  <label className="ob-leave-reason">
                                    Notes (optional)
                                    <input
                                      type="text"
                                      value={r.leave_reason}
                                      placeholder="Opening balance / carryover"
                                      onChange={(e) => updateRow(emp.$id, { leave_reason: e.target.value })}
                                    />
                                  </label>
                                </div>
                                {!leaveTypes.length ? (
                                  <p className="ob-leave-warn">
                                    No leave types found.{' '}
                                    <Link to="/leave/types">Add leave types</Link> first so the list is not empty.
                                  </p>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="ob-actions">
            <button type="button" className="btn-primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving…' : 'Save opening balances'}
            </button>
          </div>

          <section className="ob-card ob-footnote">
            <p>
              <strong>How it works:</strong> Absent days are saved on the <strong>source month</strong> payroll period.
              Advance and shopping totals are split evenly across the number of monthly installments you set, starting in
              the <strong>first payroll month to deduct</strong>. The preview column shows how much will be deducted in
              each month (adv / shopping). Leave rows are created and approved for reporting — pick a type from the list (
              same codes as <Link to="/leave/types">Leave types</Link>). You can type commas in money fields (e.g.{' '}
              12,500).
            </p>
          </section>
        </>
      )}
    </div>
  )
}

export default OpeningBalances
