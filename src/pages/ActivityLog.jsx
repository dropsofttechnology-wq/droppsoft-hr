import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { useCompany } from '../contexts/CompanyContext'
import { getAuditLogs } from '../services/auditService'
import { listUsers } from '../services/usersService'
import { isLocalDataSource } from '../config/dataSource'
import {
  feeLedgerAuditDetailSummary,
  feeLedgerOpenQueryFromAuditRow,
  isFeeLedgerAuditRow
} from '../utils/feeLedgerAuditNav'
import {
  isStudentAttendanceAuditRow,
  studentAttendanceAuditDetailSummary,
  studentAttendanceOpenQueryFromAuditRow
} from '../utils/studentAttendanceAuditNav'
import './ActivityLog.css'

function normalizeAction(action) {
  const key = String(action || '').toLowerCase()
  if (key.includes('mark_paid')) return 'paid'
  if (key.includes('approve')) return 'approved'
  if (key.includes('reject')) return 'rejected'
  if (key.includes('deactivate') || key.includes('void')) return 'deactivated'
  if (key.includes('create')) return 'created'
  if (key.includes('update')) return 'updated'
  if (key.includes('delete')) return 'deleted'
  if (key.startsWith('student_attendance')) return 'updated'
  return key || 'unknown'
}

function classifyModule(row) {
  const action = String(row?.action || '').toLowerCase()
  const entityType = String(row?.entity_type || '').toLowerCase()
  if (isFeeLedgerAuditRow(row)) {
    return 'fee-ledger'
  }
  if (isStudentAttendanceAuditRow(row)) {
    return 'student-attendance'
  }
  if (
    action.startsWith('operational_expense_') ||
    action.startsWith('expense_category_') ||
    action.startsWith('expense_supplier_') ||
    entityType === 'operational_expenses' ||
    entityType === 'expense_categories' ||
    entityType === 'expense_suppliers'
  ) {
    return 'school-expenses'
  }
  if (action.startsWith('leave_request_') || entityType === 'leave_requests') return 'leave'
  if (action.startsWith('salary_advance_') || entityType === 'salary_advance_requests') return 'salary-advance'
  if (action.startsWith('shopping_request_') || entityType === 'shopping_requests') return 'shopping'
  return 'other'
}

function safeParseJson(value) {
  if (!value) return null
  try {
    return JSON.parse(String(value))
  } catch {
    return null
  }
}

function copyIdLabel(moduleKey) {
  return moduleKey === 'leave' || moduleKey === 'salary-advance' || moduleKey === 'shopping'
    ? 'request ID'
    : 'record ID'
}

function activityLogDetailsCell(moduleKey, prev, details) {
  if (moduleKey === 'fee-ledger') {
    return feeLedgerAuditDetailSummary(prev, details)
  }
  if (moduleKey === 'student-attendance') {
    return studentAttendanceAuditDetailSummary(prev, details)
  }
  if (moduleKey === 'school-expenses') {
    const pick = (obj) => {
      if (!obj) return ''
      const parts = [obj.description, obj.name, obj.code, obj.amount != null ? String(obj.amount) : null, obj.status]
        .filter(Boolean)
      return parts.join(' · ') || ''
    }
    const before = pick(prev)
    const after = pick(details)
    if (before && after && before !== after) return `${before} → ${after}`
    return after || before || '—'
  }
  if (prev?.status || details?.status) {
    return `${prev?.status || '—'} → ${details?.status || '—'}`
  }
  return details?.status || '—'
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString()
}

function activityLogModuleLabel(moduleKey) {
  switch (moduleKey) {
    case 'leave':
      return 'Leave'
    case 'salary-advance':
      return 'Salary advance'
    case 'shopping':
      return 'Shopping'
    case 'school-expenses':
      return 'School expenses'
    case 'fee-ledger':
      return 'Fee ledger'
    case 'student-attendance':
      return 'Student attendance'
    default:
      return moduleKey
  }
}

export default function ActivityLog() {
  const navigate = useNavigate()
  const { currentCompany } = useCompany()
  const [rows, setRows] = useState([])
  const [userMap, setUserMap] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [moduleFilter, setModuleFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [copiedRequestId, setCopiedRequestId] = useState('')

  const csvEscape = (value) => {
    const raw = value == null ? '' : String(value)
    if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`
    return raw
  }

  const exportFilteredCsv = () => {
    const headers = ['Date/Time', 'Module', 'Action', 'Record ID', 'Performed by', 'Details']
    const lines = [headers.join(',')]
    for (const r of filteredRows) {
      const details = safeParseJson(r.new_value)
      const prev = safeParseJson(r.old_value)
      const moduleKey = classifyModule(r)
      const actor = userMap.get(String(r.user_id)) || r.user_id || '—'
      const row = [
        formatDate(r.created_at),
        activityLogModuleLabel(moduleKey),
        normalizeAction(r.action),
        r.entity_id || '',
        actor,
        activityLogDetailsCell(moduleKey, prev, details)
      ]
      lines.push(row.map(csvEscape).join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'activity-log-filtered.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Activity log CSV exported')
  }

  const printCurrentView = () => {
    window.print()
  }

  const copyRequestId = async (requestId, moduleKey) => {
    const id = String(requestId || '').trim()
    if (!id) return
    const noun = copyIdLabel(moduleKey)
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(id)
      } else {
        const ta = document.createElement('textarea')
        ta.value = id
        ta.setAttribute('readonly', 'true')
        ta.style.position = 'absolute'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopiedRequestId(id)
      window.setTimeout(() => {
        setCopiedRequestId((prev) => (prev === id ? '' : prev))
      }, 1600)
      toast.success(`Copied ${noun}: ${id}`)
    } catch {
      toast.error(`Failed to copy ${noun}`)
    }
  }

  useEffect(() => {
    if (!currentCompany) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [logs, users] = await Promise.all([
          getAuditLogs(currentCompany.$id, { limit: 500, offset: 0 }),
          isLocalDataSource() ? listUsers().catch(() => []) : Promise.resolve([])
        ])
        if (cancelled) return
        setRows(Array.isArray(logs) ? logs : [])
        const map = new Map()
        for (const u of users || []) {
          map.set(String(u.id || u.$id), u.name || u.username || u.email || String(u.id || u.$id))
        }
        setUserMap(map)
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Failed to load activity log')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentCompany])

  const scopedRows = useMemo(() => rows.filter((r) => classifyModule(r) !== 'other'), [rows])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scopedRows.filter((r) => {
      const moduleKey = classifyModule(r)
      if (moduleFilter !== 'all' && moduleKey !== moduleFilter) return false

      const normalized = normalizeAction(r.action)
      if (actionFilter !== 'all' && normalized !== actionFilter) return false

      if (!q) return true
      const details = safeParseJson(r.new_value)
      const prev = safeParseJson(r.old_value)
      const who = userMap.get(String(r.user_id)) || String(r.user_id || '')
      const haystack = [
        r.entity_id,
        r.entity_type,
        r.action,
        moduleKey,
        normalized,
        who,
        details?.status,
        details?.approved_by,
        details?.employee_id,
        details?.name,
        details?.code,
        details?.description,
        details?.amount != null ? String(details.amount) : '',
        details?.incurred_on,
        details?.paid_on,
        details?.payment_method,
        details?.rejected_reason,
        details?.void_reason,
        details?.label,
        details?.student_number,
        details?.legal_name,
        details?.class_label,
        details?.class_id,
        details?.attendance_date,
        details?.session_type,
        details?.saved != null ? String(details.saved) : '',
        details?.guardian_summary,
        details?.receipt_number,
        details?.reference,
        details?.currency,
        prev?.status,
        prev?.name,
        prev?.code,
        prev?.description,
        prev?.amount != null ? String(prev.amount) : '',
        prev?.paid_on,
        prev?.payment_method,
        prev?.label,
        prev?.student_number,
        prev?.legal_name,
        prev?.class_label,
        prev?.guardian_summary,
        prev?.receipt_number,
        prev?.reference,
        prev?.currency
      ]
        .map((v) => String(v || '').toLowerCase())
        .join(' ')
      return haystack.includes(q)
    })
  }, [scopedRows, moduleFilter, actionFilter, search, userMap])

  return (
    <div className="activity-log-page">
      <div className="page-header">
        <h1>User Activity Log</h1>
        <p className="page-description">
          Track leave, salary advance, shopping, <strong>school expenses</strong> (categories and suppliers), and fee
          ledger–related entities, and <strong>student attendance</strong> saves when audited (local / desktop mode).
        </p>
      </div>

      <div className="activity-filters">
        <label>
          Module
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="leave">Leave</option>
            <option value="salary-advance">Salary advance</option>
            <option value="shopping">Shopping</option>
            <option value="school-expenses">School expenses</option>
            <option value="fee-ledger">Fee ledger</option>
            <option value="student-attendance">Student attendance</option>
          </select>
        </label>
        <label>
          Action
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="deactivated">Deactivated</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="paid">Marked paid</option>
            <option value="deleted">Deleted</option>
          </select>
        </label>
        <label className="activity-search">
          Search
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Record ID, names, amounts, action..."
          />
        </label>
        <div className="activity-filter-actions">
          <button type="button" className="activity-action-btn" onClick={exportFilteredCsv} disabled={!filteredRows.length}>
            Export CSV
          </button>
          <button type="button" className="activity-action-btn secondary" onClick={printCurrentView}>
            Print
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading activity log...</div>
      ) : filteredRows.length === 0 ? (
        <p className="empty-hint">No matching activity found.</p>
      ) : (
        <div className="activity-table-wrap">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>Module</th>
                <th>Action</th>
                <th>Record ID</th>
                <th>Performed by</th>
                <th>Status change</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const details = safeParseJson(r.new_value)
                const prev = safeParseJson(r.old_value)
                const actor = userMap.get(String(r.user_id)) || r.user_id || '—'
                const moduleKey = classifyModule(r)
                const normalized = normalizeAction(r.action)
                const statusText = activityLogDetailsCell(moduleKey, prev, details)
                return (
                  <tr key={r.$id || r.id}>
                    <td>{formatDate(r.created_at)}</td>
                    <td>{activityLogModuleLabel(moduleKey)}</td>
                    <td>
                      <span className={`activity-badge activity-${normalized}`}>{normalized}</span>
                    </td>
                    <td className="mono-cell">
                      {r.entity_id ? (
                        <button
                          type="button"
                          className={`activity-id-chip ${copiedRequestId === String(r.entity_id) ? 'copied' : ''}`}
                          onClick={() => copyRequestId(r.entity_id, moduleKey)}
                          title={`Copy ${copyIdLabel(moduleKey)}`}
                        >
                          {copiedRequestId === String(r.entity_id) ? 'Copied' : r.entity_id}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{actor}</td>
                    <td>{statusText}</td>
                    <td>
                      {r.entity_id ? (
                        <button
                          type="button"
                          className="activity-open-btn"
                          onClick={() => {
                            if (moduleKey === 'school-expenses') {
                              navigate(
                                `/school/operational-expenses?highlight=${encodeURIComponent(r.entity_id)}`
                              )
                              return
                            }
                            if (moduleKey === 'fee-ledger') {
                              const p = feeLedgerOpenQueryFromAuditRow(r)
                              if (p) {
                                navigate(`/school/fee-ledger?${p.toString()}`)
                              } else {
                                toast.error('No record ID on this audit entry.')
                              }
                              return
                            }
                            if (moduleKey === 'student-attendance') {
                              const p = studentAttendanceOpenQueryFromAuditRow(r)
                              if (p) {
                                navigate(`/school/student-attendance?${p.toString()}`)
                              } else {
                                toast.error('Could not resolve date/class for this attendance entry.')
                              }
                              return
                            }
                            navigate(
                              moduleKey === 'leave'
                                ? `/leave?status=all&request_id=${encodeURIComponent(r.entity_id)}`
                                : moduleKey === 'salary-advance'
                                  ? `/salary-advance?status=all&request_id=${encodeURIComponent(r.entity_id)}`
                                  : `/shopping?status=all&request_id=${encodeURIComponent(r.entity_id)}`
                            )
                          }}
                        >
                          {moduleKey === 'school-expenses'
                            ? 'Open expenses'
                            : moduleKey === 'fee-ledger'
                              ? 'Open fee ledger'
                              : moduleKey === 'student-attendance'
                                ? 'Open register'
                                : 'Open request'}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

