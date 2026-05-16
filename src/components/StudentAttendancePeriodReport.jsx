import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { isLocalDataSource } from '../config/dataSource'
import * as api from '../services/schoolStudentAttendanceService'
import { buildStudentMarkPath } from '../utils/studentAttendanceNav'
import {
  buildStudentPeriodReportCsv,
  downloadStudentAttendanceCsv,
  studentPeriodReportFilename
} from '../utils/studentAttendanceCsvExport'
import './StudentAttendancePeriodReport.css'

function firstDayOfMonthIso() {
  const d = new Date()
  return format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd')
}

function todayIso() {
  return format(new Date(), 'yyyy-MM-dd')
}

function formatPct(value) {
  if (value == null || value === '') return '—'
  return `${value}%`
}

function pctToneClass(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return ''
  if (n >= 80) return 'student-attendance-pct--high'
  return 'student-attendance-pct--low'
}

/**
 * Class period attendance report (`view=report`). URL: `class_id`, `from_date`, `to_date`.
 * @param {{ companyId: string }} props
 */
export default function StudentAttendancePeriodReport({ companyId }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const classParam = searchParams.get('class_id')?.trim() || ''
  const fromParam = searchParams.get('from_date')?.trim().slice(0, 10) || ''
  const toParam = searchParams.get('to_date')?.trim().slice(0, 10) || ''

  const [classId, setClassId] = useState(classParam)
  const [fromDate, setFromDate] = useState(() =>
    /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : firstDayOfMonthIso()
  )
  const [toDate, setToDate] = useState(() => (/^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : todayIso()))
  const [classes, setClasses] = useState([])
  const [report, setReport] = useState(null)
  const [loadingClasses, setLoadingClasses] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)
  const ensuredParamsRef = useRef(false)
  const fetchGenRef = useRef(0)

  const patchUrl = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('view', 'report')
          if (patch.class_id !== undefined) {
            if (patch.class_id) p.set('class_id', patch.class_id)
            else p.delete('class_id')
          }
          if (patch.from_date !== undefined) {
            if (patch.from_date) p.set('from_date', patch.from_date)
            else p.delete('from_date')
          }
          if (patch.to_date !== undefined) {
            if (patch.to_date) p.set('to_date', patch.to_date)
            else p.delete('to_date')
          }
          return p
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  useEffect(() => {
    if (ensuredParamsRef.current) return
    ensuredParamsRef.current = true
    const from = /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : firstDayOfMonthIso()
    const to = /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : todayIso()
    setFromDate(from)
    setToDate(to)
    patchUrl({ from_date: from, to_date: to, class_id: classParam })
  }, [fromParam, toParam, classParam, patchUrl])

  useEffect(() => {
    setClassId((prev) => (prev === classParam ? prev : classParam))
  }, [classParam])

  useEffect(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(fromParam)) {
      setFromDate((prev) => (prev === fromParam ? prev : fromParam))
    }
  }, [fromParam])

  useEffect(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
      setToDate((prev) => (prev === toParam ? prev : toParam))
    }
  }, [toParam])

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

  const loadReport = useCallback(async () => {
    if (!companyId || !isLocalDataSource() || !classId || !fromDate || !toDate) {
      setReport(null)
      return
    }
    const gen = ++fetchGenRef.current
    try {
      setLoadingReport(true)
      const data = await api.getClassPeriodReport(companyId, {
        fromDate,
        toDate,
        classId,
        sessionType: 'daily'
      })
      if (gen === fetchGenRef.current) setReport(data)
    } catch (e) {
      if (gen === fetchGenRef.current) {
        toast.error(e.message || 'Failed to load report')
        setReport(null)
      }
    } finally {
      if (gen === fetchGenRef.current) setLoadingReport(false)
    }
  }, [companyId, classId, fromDate, toDate])

  useEffect(() => {
    loadClasses()
  }, [loadClasses])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const syncUrl = useCallback(
    (patch) => {
      patchUrl({
        class_id: patch.class_id !== undefined ? patch.class_id : classId,
        from_date: patch.from_date ?? fromDate,
        to_date: patch.to_date ?? toDate
      })
    },
    [patchUrl, classId, fromDate, toDate]
  )

  const summary = useMemo(() => {
    if (!report) return null
    return {
      totalSchoolDays: report.total_school_days ?? 0,
      classAverage: report.class_average_attendance,
      studentCount: report.students?.length ?? 0
    }
  }, [report])

  const handleExport = () => {
    if (!report?.students?.length) {
      toast.error('Nothing to export')
      return
    }
    try {
      downloadStudentAttendanceCsv(
        studentPeriodReportFilename({
          classId: report.class_id || classId,
          fromDate: report.from_date || fromDate,
          toDate: report.to_date || toDate
        }),
        buildStudentPeriodReportCsv(report)
      )
      toast.success('CSV downloaded')
    } catch (e) {
      toast.error(e.message || 'Export failed')
    }
  }

  const openMarkForStudent = (student) => {
    navigate(
      buildStudentMarkPath({
        date: toDate,
        classId: classId || student.class_id,
        highlight: student.student_id
      })
    )
  }

  return (
    <div className="student-attendance-period-report">
      <p className="student-attendance-period-report-lead">
        Totals use <strong>distinct dates</strong> when attendance was saved for this class in the range. Attendance % = (present
        + late) ÷ total school days.
      </p>

      <div className="student-attendance-period-report-toolbar">
        <label htmlFor="period-class">
          Class
          <select
            id="period-class"
            value={classId}
            disabled={loadingClasses}
            onChange={(e) => {
              const v = e.target.value
              setClassId(v)
              syncUrl({ class_id: v })
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
        <label htmlFor="period-from">
          From
          <input
            id="period-from"
            type="date"
            value={fromDate}
            onChange={(e) => {
              const v = e.target.value
              setFromDate(v)
              syncUrl({ from_date: v })
            }}
          />
        </label>
        <label htmlFor="period-to">
          To
          <input
            id="period-to"
            type="date"
            value={toDate}
            onChange={(e) => {
              const v = e.target.value
              setToDate(v)
              syncUrl({ to_date: v })
            }}
          />
        </label>
        <button
          type="button"
          className="student-attendance-period-report-export"
          onClick={handleExport}
          disabled={loadingReport || !report?.students?.length}
        >
          Export CSV
        </button>
      </div>

      {!classId ? (
        <p className="student-attendance-period-report-hint">Select a class to load the period report.</p>
      ) : loadingReport ? (
        <p className="student-attendance-period-report-hint">Loading report…</p>
      ) : report && summary ? (
        <>
          <div className="student-attendance-period-report-banner" aria-live="polite">
            <div className="student-attendance-period-report-metric">
              <span className="label">Total school days</span>
              <strong>{summary.totalSchoolDays}</strong>
              <span className="sub">Distinct dates with saved attendance</span>
            </div>
            <div className="student-attendance-period-report-metric">
              <span className="label">Class average attendance</span>
              <strong className={pctToneClass(summary.classAverage)}>{formatPct(summary.classAverage)}</strong>
              <span className="sub">{summary.studentCount} student(s) in class</span>
            </div>
            <div className="student-attendance-period-report-metric">
              <span className="label">Period</span>
              <strong>
                {report.from_date} → {report.to_date}
              </strong>
              <span className="sub">{report.class_id}</span>
            </div>
          </div>

          <div className="student-attendance-period-report-table-wrap">
            <table className="student-attendance-period-report-table">
              <thead>
                <tr>
                  <th>Admission no.</th>
                  <th>Student name</th>
                  <th>Days present</th>
                  <th>Days absent</th>
                  <th>Late / excused</th>
                  <th>Attendance %</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(report.students || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="student-attendance-period-report-empty">
                      No active students in this class.
                    </td>
                  </tr>
                ) : (
                  report.students.map((st) => (
                    <tr key={st.student_id}>
                      <td className="student-attendance-period-report-num">{st.student_number}</td>
                      <td className="student-attendance-period-report-name">{st.legal_name}</td>
                      <td>{st.present}</td>
                      <td>{st.absent}</td>
                      <td>
                        {st.late} / {st.excused}
                      </td>
                      <td className={pctToneClass(st.attendance_percentage)}>
                        {formatPct(st.attendance_percentage)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="student-attendance-period-report-link"
                          onClick={() => openMarkForStudent(st)}
                        >
                          Mark
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
