import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { useSearchParams } from 'react-router-dom'
import { isLocalDataSource } from '../config/dataSource'
import * as api from '../services/schoolStudentAttendanceService'
import {
  buildStudentDailyAttendanceCsv,
  downloadStudentAttendanceCsv
} from '../utils/studentAttendanceCsvExport'
import './StudentAttendanceMarking.css'

const EXTRA_STATUS = [
  { value: 'late', label: 'Late' },
  { value: 'excused', label: 'Excused' }
]

function todayIso() {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * Daily class marking grid (`view=mark`). URL: `date`, `class_id`, optional `highlight`.
 * @param {{ companyId: string }} props
 */
export default function StudentAttendanceMarking({ companyId }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const highlightParam = searchParams.get('highlight')?.trim() || ''
  const dateParam = searchParams.get('date')?.trim().slice(0, 10) || ''
  const classParam = searchParams.get('class_id')?.trim() || ''

  const [attendanceDate, setAttendanceDate] = useState(() =>
    /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayIso()
  )
  const [classId, setClassId] = useState(classParam)
  const [classes, setClasses] = useState([])
  const [rows, setRows] = useState([])
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [loadingGrid, setLoadingGrid] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [highlightFlashId, setHighlightFlashId] = useState(null)
  const flashTimerRef = useRef(null)
  const ensuredDateRef = useRef(false)

  const patchUrl = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('view', 'mark')
          if (patch.date !== undefined) {
            if (patch.date) p.set('date', patch.date)
            else p.delete('date')
          }
          if (patch.class_id !== undefined) {
            if (patch.class_id) p.set('class_id', patch.class_id)
            else p.delete('class_id')
          }
          if (patch.highlight !== undefined) {
            if (patch.highlight) p.set('highlight', patch.highlight)
            else p.delete('highlight')
          }
          return p
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  useEffect(() => {
    if (ensuredDateRef.current) return
    ensuredDateRef.current = true
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const today = todayIso()
      setAttendanceDate(today)
      patchUrl({ date: today, class_id: classParam })
    }
  }, [dateParam, classParam, patchUrl])

  useEffect(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setAttendanceDate((prev) => (prev === dateParam ? prev : dateParam))
    }
  }, [dateParam])

  useEffect(() => {
    setClassId((prev) => (prev === classParam ? prev : classParam))
  }, [classParam])

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current)
    }
  }, [])

  const loadClasses = useCallback(async () => {
    if (!companyId || !isLocalDataSource()) return
    try {
      setLoadingClasses(true)
      const list = await api.getAttendanceClasses(companyId)
      setClasses(list)
    } catch (e) {
      toast.error(e.message || 'Failed to load classes')
      setClasses([])
    } finally {
      setLoadingClasses(false)
    }
  }, [companyId])

  const loadGrid = useCallback(async () => {
    if (!companyId || !isLocalDataSource() || !classId || !attendanceDate) {
      setRows([])
      return
    }
    try {
      setLoadingGrid(true)
      const data = await api.loadMarkingGrid(companyId, {
        date: attendanceDate,
        classId,
        sessionType: 'daily'
      })
      setRows(
        (data.rows || []).map((r) => ({
          student_id: r.student_id,
          student_number: r.student_number,
          legal_name: r.legal_name,
          status: r.status || 'present'
        }))
      )
      setDirty(false)
    } catch (e) {
      toast.error(e.message || 'Failed to load students')
      setRows([])
    } finally {
      setLoadingGrid(false)
    }
  }, [companyId, classId, attendanceDate])

  useEffect(() => {
    loadClasses()
  }, [loadClasses])

  useEffect(() => {
    loadGrid()
  }, [loadGrid])

  useEffect(() => {
    if (!highlightParam || !rows.length || loadingGrid) return
    const wantId = String(highlightParam)
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`student-mark-row-${wantId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlightFlashId(wantId)
        if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current)
        flashTimerRef.current = window.setTimeout(() => {
          setHighlightFlashId(null)
          flashTimerRef.current = null
          patchUrl({ highlight: '' })
        }, 2800)
      }
    })
  }, [highlightParam, rows, loadingGrid, patchUrl])

  const summary = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0 }
    for (const r of rows) {
      const k = r.status in counts ? r.status : 'absent'
      counts[k] += 1
    }
    return counts
  }, [rows])

  const allPresent = rows.length > 0 && rows.every((r) => r.status === 'present')
  const somePresent = rows.some((r) => r.status === 'present')

  const setRowStatus = (studentId, status) => {
    setRows((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, status } : r)))
    setDirty(true)
  }

  const toggleMaster = () => {
    const next = allPresent ? 'absent' : 'present'
    setRows((prev) => prev.map((r) => ({ ...r, status: next })))
    setDirty(true)
  }

  const handleSave = async () => {
    if (!companyId || !classId || !rows.length) return
    try {
      setSaving(true)
      await api.saveAttendanceMarks(companyId, {
        date: attendanceDate,
        class_id: classId,
        session_type: 'daily',
        marks: rows.map((r) => ({ student_id: r.student_id, status: r.status }))
      })
      toast.success('Register saved')
      setDirty(false)
      await loadGrid()
    } catch (e) {
      toast.error(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = () => {
    if (!rows.length) {
      toast.error('Nothing to export')
      return
    }
    try {
      const safeClass = classId.replace(/[^\w.-]+/g, '_').slice(0, 40)
      downloadStudentAttendanceCsv(
        `student-attendance-${attendanceDate}-${safeClass}.csv`,
        buildStudentDailyAttendanceCsv({
          attendance_date: attendanceDate,
          class_id: classId,
          session_type: 'daily',
          rows
        })
      )
      toast.success('CSV downloaded')
    } catch (e) {
      toast.error(e.message || 'Export failed')
    }
  }

  return (
    <div className="student-attendance-marking">
      <div className="student-attendance-marking-toolbar">
        <label htmlFor="mark-date">
          Date
          <input
            id="mark-date"
            type="date"
            value={attendanceDate}
            onChange={(e) => {
              const v = e.target.value
              setAttendanceDate(v)
              patchUrl({ date: v, class_id: classId })
            }}
          />
        </label>
        <label htmlFor="mark-class">
          Class
          <select
            id="mark-class"
            value={classId}
            disabled={loadingClasses}
            onChange={(e) => {
              const v = e.target.value
              setClassId(v)
              patchUrl({ date: attendanceDate, class_id: v })
            }}
          >
            <option value="">Select class…</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="student-attendance-marking-export"
          onClick={handleExport}
          disabled={!classId || !rows.length}
        >
          Export CSV
        </button>
      </div>

      {classes.length === 0 && !loadingClasses ? (
        <p className="student-attendance-marking-hint">
          No classes found. Add students with a <strong>class / form</strong> on the fee ledger first.
        </p>
      ) : null}

      {!classId ? (
        <p className="student-attendance-marking-hint">Pick a date and class to load students.</p>
      ) : loadingGrid ? (
        <p className="student-attendance-marking-hint">Loading students…</p>
      ) : rows.length === 0 ? (
        <p className="student-attendance-marking-hint">No active students in this class.</p>
      ) : (
        <>
          <div className="student-attendance-marking-summary">
            <span>Present: {summary.present}</span>
            <span>Absent: {summary.absent}</span>
            <span>Late: {summary.late}</span>
            <span>Excused: {summary.excused}</span>
            {dirty ? <span className="student-attendance-marking-unsaved">Unsaved changes</span> : null}
          </div>
          <div className="student-attendance-marking-table-wrap">
            <table className="student-attendance-marking-table">
              <thead>
                <tr>
                  <th className="student-attendance-marking-check">
                    <input
                      type="checkbox"
                      aria-label={allPresent ? 'Clear all present' : 'Select all present'}
                      checked={allPresent}
                      ref={(el) => {
                        if (el) el.indeterminate = !allPresent && somePresent
                      }}
                      onChange={toggleMaster}
                    />
                  </th>
                  <th>Admission no.</th>
                  <th>Student name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isPresent = r.status === 'present'
                  return (
                    <tr
                      key={r.student_id}
                      id={`student-mark-row-${r.student_id}`}
                      className={
                        highlightFlashId === String(r.student_id)
                          ? 'student-attendance-marking-row--highlight'
                          : undefined
                      }
                    >
                      <td className="student-attendance-marking-check">
                        <input
                          type="checkbox"
                          aria-label={`${r.legal_name} present`}
                          checked={isPresent}
                          onChange={(e) =>
                            setRowStatus(r.student_id, e.target.checked ? 'present' : 'absent')
                          }
                        />
                      </td>
                      <td className="student-attendance-marking-num">{r.student_number}</td>
                      <td className="student-attendance-marking-name">{r.legal_name}</td>
                      <td>
                        <div className="student-attendance-marking-status" role="group" aria-label={`Status for ${r.legal_name}`}>
                          <button
                            type="button"
                            className={isPresent ? 'active present' : ''}
                            onClick={() => setRowStatus(r.student_id, 'present')}
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            className={r.status === 'absent' ? 'active absent' : ''}
                            onClick={() => setRowStatus(r.student_id, 'absent')}
                          >
                            Absent
                          </button>
                          {EXTRA_STATUS.map((o) => (
                            <button
                              key={o.value}
                              type="button"
                              className={r.status === o.value ? `active ${o.value}` : ''}
                              onClick={() => setRowStatus(r.student_id, o.value)}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="student-attendance-marking-savebar">
        <button
          type="button"
          className="student-attendance-marking-save"
          onClick={handleSave}
          disabled={!classId || !rows.length || saving}
        >
          {saving ? 'Saving…' : 'Save Register'}
        </button>
      </div>
    </div>
  )
}
