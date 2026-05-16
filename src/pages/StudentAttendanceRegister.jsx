import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { Link, useSearchParams } from 'react-router-dom'
import { useCompany } from '../contexts/CompanyContext'
import { isLocalDataSource } from '../config/dataSource'
import StudentAttendanceMarking from '../components/StudentAttendanceMarking'
import StudentAttendancePeriodReport from '../components/StudentAttendancePeriodReport'
import './StudentAttendanceRegister.css'

function firstDayOfMonthIso() {
  const d = new Date()
  return format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd')
}

function resolveViewParam(raw) {
  const v = String(raw || '').trim().toLowerCase()
  if (v === 'report') return 'report'
  if (v === 'roll') return 'mark'
  return 'mark'
}

const StudentAttendanceRegister = () => {
  const { currentCompany } = useCompany()
  const companyId = currentCompany?.$id
  const [searchParams, setSearchParams] = useSearchParams()
  const viewParam = resolveViewParam(searchParams.get('view'))

  const [view, setView] = useState(viewParam)

  useEffect(() => {
    setView((prev) => (prev === viewParam ? prev : viewParam))
  }, [viewParam])

  const patchUrl = useCallback(
    (patch) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (patch.view === 'report') {
            p.set('view', 'report')
            if (patch.from_date) p.set('from_date', patch.from_date)
            if (patch.to_date) p.set('to_date', patch.to_date)
            if (patch.class_id) p.set('class_id', patch.class_id)
          } else {
            p.set('view', 'mark')
          }
          return p
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const selectView = useCallback(
    (nextView) => {
      const resolved = nextView === 'report' ? 'report' : 'mark'
      setView(resolved)
      if (resolved === 'report') {
        const from = searchParams.get('from_date')?.slice(0, 10) || firstDayOfMonthIso()
        const to = searchParams.get('to_date')?.slice(0, 10) || format(new Date(), 'yyyy-MM-dd')
        patchUrl({ view: 'report', from_date: from, to_date: to, class_id: searchParams.get('class_id') || '' })
      } else {
        patchUrl({ view: 'mark' })
      }
    },
    [patchUrl, searchParams]
  )

  if (!isLocalDataSource()) {
    return (
      <div className="student-attendance-page">
        <div className="page-header">
          <h1>Student attendance</h1>
        </div>
        <p className="page-description">
          The student register runs on the <strong>local desktop / SQLite API</strong>. Use the desktop build or
          connect via LAN, then return here.
        </p>
      </div>
    )
  }

  if (!companyId) {
    return (
      <div className="student-attendance-page">
        <div className="page-header">
          <h1>Student attendance</h1>
        </div>
        <p className="page-description">Select a company in the header to take roll call.</p>
      </div>
    )
  }

  return (
    <div className="student-attendance-page">
      <div className="page-header">
        <h1>Student attendance</h1>
      </div>
      <p className="page-description">
        Daily class register (separate from <strong>staff</strong> clock-in). Classes come from each student&apos;s{' '}
        <strong>class / form</strong> on the <Link to="/school/fee-ledger?tab=students">fee ledger</Link>. Session type
        is <code>daily</code> for now; morning/afternoon can be added later without a schema change.
      </p>

      <div className="student-attendance-tabs">
        <button
          type="button"
          className={view === 'mark' ? 'active' : ''}
          onClick={() => selectView('mark')}
        >
          Mark register
        </button>
        <button
          type="button"
          className={view === 'report' ? 'active' : ''}
          onClick={() => selectView('report')}
        >
          Period report
        </button>
      </div>

      {view === 'mark' ? <StudentAttendanceMarking companyId={companyId} /> : null}
      {view === 'report' ? <StudentAttendancePeriodReport companyId={companyId} /> : null}
    </div>
  )
}

export default StudentAttendanceRegister
