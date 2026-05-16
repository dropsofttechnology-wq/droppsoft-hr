import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { isLocalDataSource } from '../config/dataSource'
import * as api from '../services/schoolStudentAttendanceService'
import './StudentIndividualHistory.css'

const STATUS_LABELS = {
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
  excused: 'Excused'
}

function formatHistoryDate(isoDate) {
  const d = String(isoDate || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d || '—'
  try {
    return format(parseISO(d), 'EEE, MMM d, yyyy')
  } catch {
    return d
  }
}

function formatPct(value) {
  if (value == null || value === '') return '—'
  return `${value}%`
}

/**
 * Modal ledger for one student's attendance history.
 * @param {{
 *   companyId: string,
 *   student: { $id: string, student_number?: string, legal_name?: string, class_label?: string },
 *   onClose: () => void
 * }} props
 */
export default function StudentIndividualHistory({ companyId, student, onClose }) {
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState(null)

  const loadHistory = useCallback(async () => {
    if (!companyId || !student?.$id || !isLocalDataSource()) {
      setHistory(null)
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const data = await api.getStudentAttendanceHistory(companyId, student.$id)
      setHistory(data?.success ? data : null)
    } catch (e) {
      toast.error(e.message || 'Failed to load attendance history')
      setHistory(null)
    } finally {
      setLoading(false)
    }
  }, [companyId, student?.$id])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const summary = history?.summary
  const records = history?.records || []
  const displayName = history?.legal_name || student?.legal_name || 'Student'
  const displayNumber = history?.student_number || student?.student_number || '—'
  const displayClass = history?.class_label || student?.class_label || '—'

  return (
    <div className="student-history-overlay" role="dialog" aria-modal="true" aria-labelledby="student-history-title" onClick={onClose}>
      <div className="student-history-panel" onClick={(e) => e.stopPropagation()}>
        <header className="student-history-header">
          <div>
            <h2 id="student-history-title">Attendance history</h2>
            <p className="student-history-subtitle">
              {displayName} · {displayNumber} · {displayClass}
            </p>
          </div>
          <button type="button" className="student-history-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {loading ? (
          <p className="student-history-hint">Loading history…</p>
        ) : (
          <>
            <div className="student-history-summary">
              <div className="student-history-badge student-history-badge--present">
                <span className="label">Present</span>
                <strong>{summary?.present ?? 0}</strong>
              </div>
              <div className="student-history-badge student-history-badge--absent">
                <span className="label">Absent</span>
                <strong>{summary?.absent ?? 0}</strong>
              </div>
              <div className="student-history-badge student-history-badge--late">
                <span className="label">Late / excused</span>
                <strong>
                  {summary?.late ?? 0} / {summary?.excused ?? 0}
                </strong>
              </div>
              <div className="student-history-badge student-history-badge--rate">
                <span className="label">Overall rate</span>
                <strong>{formatPct(summary?.attendance_percentage)}</strong>
              </div>
            </div>

            {records.length === 0 ? (
              <p className="student-history-empty">
                No attendance has been recorded for this student yet. Use <strong>Register</strong> on the fee ledger
                or the marking grid to save their first day.
              </p>
            ) : (
              <div className="student-history-table-wrap">
                <table className="student-history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Session</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((row) => {
                      const key = `${row.attendance_date}-${row.session_type}`
                      const status = String(row.status || 'absent').toLowerCase()
                      return (
                        <tr key={key}>
                          <td>{formatHistoryDate(row.attendance_date)}</td>
                          <td>
                            <span className={`student-history-status student-history-status--${status}`}>
                              {STATUS_LABELS[status] || status}
                            </span>
                          </td>
                          <td className="student-history-session">{row.session_type || 'daily'}</td>
                          <td className="student-history-remarks">
                            {row.remarks?.trim() ? row.remarks : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
