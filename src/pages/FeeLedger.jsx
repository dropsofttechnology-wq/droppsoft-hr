import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Link, useSearchParams } from 'react-router-dom'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import { isLocalDataSource } from '../config/dataSource'
import StudentIndividualHistory from '../components/StudentIndividualHistory'
import { hasPermission } from '../utils/permissions'
import * as api from '../services/schoolFeeLedgerService'
import ConfirmDialog from '../components/ConfirmDialog'
import FeeLedgerStudentQrCell from '../components/school/FeeLedgerStudentQrCell'
import { resolveFeeLedgerEntityTab } from '../utils/feeLedgerAuditNav'
import { buildStudentMarkPath, buildStudentPeriodReportPath } from '../utils/studentAttendanceNav'
import { formatMoneyAmount } from '../utils/formatMoney'
import {
  buildAcademicTermsReportCsv,
  buildAcademicYearsReportCsv,
  buildFeeChargesCsv,
  buildFeePaymentsCsv,
  buildFeeStudentsCsv,
  downloadFeeLedgerCsv,
  feeLedgerStudentLabel,
  feeLedgerTermLabel,
  feeLedgerYearLabel
} from '../utils/feeLedgerCsvExport'
import './FeeLedger.css'

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'years', label: 'Academic years' },
  { id: 'terms', label: 'Terms' },
  { id: 'students', label: 'Students' },
  { id: 'charges', label: 'Charges' },
  { id: 'payments', label: 'Payments' }
]

const FEE_LEDGER_TAB_IDS = TABS.map((t) => t.id)

function feeLedgerMonthDateRange(yyyyMm) {
  if (!/^\d{4}-\d{2}$/.test(yyyyMm)) return { from: '', to: '' }
  const [y, m] = yyyyMm.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return {
    from: `${yyyyMm}-01`,
    to: `${yyyyMm}-${String(lastDay).padStart(2, '0')}`
  }
}

function feeLedgerPeriodQuery(from, to) {
  const f = String(from || '').slice(0, 10)
  const t = String(to || '').slice(0, 10)
  if (!f || !t) return ''
  return `&paid_from=${encodeURIComponent(f)}&paid_to=${encodeURIComponent(t)}`
}

function FeeLedgerEmptyRow({ colSpan, message }) {
  return (
    <tr>
      <td colSpan={colSpan} className="fee-ledger-empty">
        {message}
      </td>
    </tr>
  )
}

function FeeLedgerYearFilterToolbar({ years, yearId, onYearIdChange, onExport, exportDisabled }) {
  return (
    <div className="fee-ledger-toolbar">
      <label htmlFor="fee-ledger-year-filter" className="fee-ledger-toolbar-label">
        Academic year
      </label>
      <select
        id="fee-ledger-year-filter"
        value={yearId}
        onChange={(e) => onYearIdChange(e.target.value)}
      >
        <option value="">All years</option>
        {years.map((y) => (
          <option key={y.$id} value={y.$id}>
            {y.label}
          </option>
        ))}
      </select>
      {yearId ? (
        <button type="button" className="fee-ledger-toolbar-secondary" onClick={() => onYearIdChange('')}>
          Clear filter
        </button>
      ) : null}
      <button type="button" className="fee-ledger-toolbar-export" onClick={onExport} disabled={exportDisabled}>
        Export report CSV
      </button>
    </div>
  )
}

function FeeLedgerChargesFilterToolbar({
  years,
  terms,
  academicYearId,
  termId,
  students,
  studentId,
  onAcademicYearChange,
  onTermChange,
  onStudentIdChange,
  onExport,
  exportDisabled
}) {
  const termsForFilter = academicYearId
    ? terms.filter((t) => String(t.academic_year_id) === String(academicYearId))
    : terms
  return (
    <div className="fee-ledger-toolbar fee-ledger-toolbar--filters">
      <label htmlFor="fee-ledger-charge-year-filter" className="fee-ledger-toolbar-label">
        Year
      </label>
      <select
        id="fee-ledger-charge-year-filter"
        value={academicYearId}
        onChange={(e) => onAcademicYearChange(e.target.value)}
      >
        <option value="">All years</option>
        {years.map((y) => (
          <option key={y.$id} value={y.$id}>
            {y.label}
          </option>
        ))}
      </select>
      <label htmlFor="fee-ledger-charge-term-filter" className="fee-ledger-toolbar-label">
        Term
      </label>
      <select
        id="fee-ledger-charge-term-filter"
        value={termId}
        onChange={(e) => onTermChange(e.target.value)}
        disabled={termsForFilter.length === 0}
      >
        <option value="">All terms</option>
        {termsForFilter.map((t) => (
          <option key={t.$id} value={t.$id}>
            {t.name}
          </option>
        ))}
      </select>
      <label htmlFor="fee-ledger-charge-student-filter" className="fee-ledger-toolbar-label">
        Student
      </label>
      <select
        id="fee-ledger-charge-student-filter"
        value={studentId}
        onChange={(e) => onStudentIdChange(e.target.value)}
      >
        <option value="">All students</option>
        {students.map((s) => (
          <option key={s.$id} value={s.$id}>
            {s.student_number} — {s.legal_name}
          </option>
        ))}
      </select>
      {(academicYearId || termId || studentId) && (
        <button
          type="button"
          className="fee-ledger-toolbar-secondary"
          onClick={() => {
            onAcademicYearChange('')
            onTermChange('')
            onStudentIdChange('')
          }}
        >
          Clear filters
        </button>
      )}
      <button type="button" className="fee-ledger-toolbar-export" onClick={onExport} disabled={exportDisabled}>
        Export CSV
      </button>
    </div>
  )
}

function FeeLedgerPaymentsFilterToolbar({
  students,
  studentId,
  paidFrom,
  paidTo,
  onStudentIdChange,
  onPaidFromChange,
  onPaidToChange,
  onExport,
  exportDisabled
}) {
  return (
    <div className="fee-ledger-toolbar fee-ledger-toolbar--filters">
      <label htmlFor="fee-ledger-paid-from" className="fee-ledger-toolbar-label">
        Paid from
      </label>
      <input
        id="fee-ledger-paid-from"
        type="date"
        value={paidFrom}
        onChange={(e) => onPaidFromChange(e.target.value)}
      />
      <label htmlFor="fee-ledger-paid-to" className="fee-ledger-toolbar-label">
        Paid to
      </label>
      <input
        id="fee-ledger-paid-to"
        type="date"
        value={paidTo}
        onChange={(e) => onPaidToChange(e.target.value)}
      />
      <label htmlFor="fee-ledger-payment-student-filter" className="fee-ledger-toolbar-label">
        Student
      </label>
      <select
        id="fee-ledger-payment-student-filter"
        value={studentId}
        onChange={(e) => onStudentIdChange(e.target.value)}
      >
        <option value="">All students</option>
        {students.map((s) => (
          <option key={s.$id} value={s.$id}>
            {s.student_number} — {s.legal_name}
          </option>
        ))}
      </select>
      {(studentId || paidFrom || paidTo) && (
        <button
          type="button"
          className="fee-ledger-toolbar-secondary"
          onClick={() => {
            onStudentIdChange('')
            onPaidFromChange('')
            onPaidToChange('')
          }}
        >
          Clear filters
        </button>
      )}
      <button type="button" className="fee-ledger-toolbar-export" onClick={onExport} disabled={exportDisabled}>
        Export CSV
      </button>
    </div>
  )
}

function FeeLedgerStudentFilterToolbar({ students, studentId, onStudentIdChange, onExport, exportDisabled }) {
  return (
    <div className="fee-ledger-toolbar">
      <label htmlFor="fee-ledger-student-filter" className="fee-ledger-toolbar-label">
        Student
      </label>
      <select
        id="fee-ledger-student-filter"
        value={studentId}
        onChange={(e) => onStudentIdChange(e.target.value)}
      >
        <option value="">All students</option>
        {students.map((s) => (
          <option key={s.$id} value={s.$id}>
            {s.student_number} — {s.legal_name}
          </option>
        ))}
      </select>
      {studentId ? (
        <button type="button" className="fee-ledger-toolbar-secondary" onClick={() => onStudentIdChange('')}>
          Clear filter
        </button>
      ) : null}
      <button type="button" className="fee-ledger-toolbar-export" onClick={onExport} disabled={exportDisabled}>
        Export CSV
      </button>
    </div>
  )
}

const emptyYear = { label: '', start_date: '', end_date: '', is_active: true }
const emptyTerm = { academic_year_id: '', name: '', start_date: '', end_date: '' }
const emptyStudent = { student_number: '', legal_name: '', class_label: '', guardian_email: '' }
const emptyCharge = {
  student_id: '',
  academic_year_id: '',
  term_id: '',
  description: '',
  amount: '',
  currency: '',
  due_date: '',
  status: 'open'
}
const emptyPayment = {
  student_id: '',
  amount: '',
  currency: '',
  paid_on: format(new Date(), 'yyyy-MM-dd'),
  payment_method: '',
  reference: '',
  receipt_number: '',
  notes: ''
}

const FeeLedger = () => {
  const { currentCompany } = useCompany()
  const { user } = useAuth()
  const companyId = currentCompany?.$id
  const canViewStudentAttendance = isLocalDataSource() && hasPermission(user, 'school_attendance')
  const [searchParams, setSearchParams] = useSearchParams()
  const highlightParam = searchParams.get('highlight')?.trim() || ''
  const monthParam = searchParams.get('month')?.trim().slice(0, 7) || ''
  const tabParam = searchParams.get('tab')?.trim().toLowerCase() || ''
  const studentIdParam = searchParams.get('student_id')?.trim() || ''
  const academicYearIdParam = searchParams.get('academic_year_id')?.trim() || ''
  const chargeTermIdParam = searchParams.get('term_id')?.trim() || ''
  const paidFromParam = searchParams.get('paid_from')?.trim().slice(0, 10) || ''
  const paidToParam = searchParams.get('paid_to')?.trim().slice(0, 10) || ''
  const [tab, setTab] = useState('summary')
  const [loading, setLoading] = useState(false)
  const [summaryMonth, setSummaryMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [years, setYears] = useState([])
  const [terms, setTerms] = useState([])
  const [students, setStudents] = useState([])
  const [charges, setCharges] = useState([])
  const [payments, setPayments] = useState([])
  const [yearReports, setYearReports] = useState([])
  const [yearReportsLoading, setYearReportsLoading] = useState(false)
  const [termReports, setTermReports] = useState([])
  const [termReportsLoading, setTermReportsLoading] = useState(false)

  const [yearForm, setYearForm] = useState(emptyYear)
  const [editingYearId, setEditingYearId] = useState(null)
  const [termForm, setTermForm] = useState(emptyTerm)
  const [editingTermId, setEditingTermId] = useState(null)
  const [studentForm, setStudentForm] = useState(emptyStudent)
  const [editingStudentId, setEditingStudentId] = useState(null)
  const [chargeForm, setChargeForm] = useState(emptyCharge)
  const [editingChargeId, setEditingChargeId] = useState(null)
  const [paymentForm, setPaymentForm] = useState(emptyPayment)
  const [editingPaymentId, setEditingPaymentId] = useState(null)

  const [confirmDel, setConfirmDel] = useState(null)
  const [attendanceHistoryStudent, setAttendanceHistoryStudent] = useState(null)
  const [highlightFlashId, setHighlightFlashId] = useState(null)
  const flashTimerRef = useRef(null)

  const loadCore = useCallback(async () => {
    if (!companyId || !isLocalDataSource()) return
    try {
      setLoading(true)
      const [y, s, t] = await Promise.all([
        api.getAcademicYears(companyId),
        api.getStudents(companyId),
        api.getAcademicTerms(companyId)
      ])
      setYears(y)
      setStudents(s)
      setTerms(t)
    } catch (e) {
      toast.error(e.message || 'Failed to load fee ledger data')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  const loadSummary = useCallback(async () => {
    if (!companyId || !isLocalDataSource()) return
    try {
      setSummaryLoading(true)
      const s = await api.getFeesSummary(companyId, summaryMonth)
      setSummary(s)
    } catch (e) {
      toast.error(e.message || 'Failed to load summary')
      setSummary(null)
    } finally {
      setSummaryLoading(false)
    }
  }, [companyId, summaryMonth])

  const loadTerms = useCallback(async () => {
    if (!companyId || !isLocalDataSource()) return
    try {
      const t = await api.getAcademicTerms(companyId, academicYearIdParam || undefined)
      setTerms(t)
    } catch (e) {
      toast.error(e.message || 'Failed to load terms')
    }
  }, [companyId, academicYearIdParam])

  const loadYearReports = useCallback(async () => {
    if (!companyId || !isLocalDataSource()) return
    try {
      setYearReportsLoading(true)
      const rows = await api.getAcademicYearsReport(companyId)
      setYearReports(rows)
    } catch (e) {
      toast.error(e.message || 'Failed to load year reports')
      setYearReports([])
    } finally {
      setYearReportsLoading(false)
    }
  }, [companyId])

  const loadTermReports = useCallback(async () => {
    if (!companyId || !isLocalDataSource()) return
    try {
      setTermReportsLoading(true)
      const rows = await api.getAcademicTermsReport(companyId, academicYearIdParam || undefined)
      setTermReports(rows)
    } catch (e) {
      toast.error(e.message || 'Failed to load term reports')
      setTermReports([])
    } finally {
      setTermReportsLoading(false)
    }
  }, [companyId, academicYearIdParam])

  const loadChargesPayments = useCallback(async () => {
    if (!companyId || !isLocalDataSource()) return
    try {
      const sid = studentIdParam || undefined
      const [c, p] = await Promise.all([
        api.getFeeCharges(companyId, {
          studentId: sid,
          academicYearId: academicYearIdParam || undefined,
          termId: chargeTermIdParam || undefined
        }),
        api.getFeePayments(companyId, {
          studentId: sid,
          paidFrom: paidFromParam || undefined,
          paidTo: paidToParam || undefined
        })
      ])
      setCharges(c)
      setPayments(p)
    } catch (e) {
      toast.error(e.message || 'Failed to load charges or payments')
    }
  }, [companyId, studentIdParam, academicYearIdParam, chargeTermIdParam, paidFromParam, paidToParam])

  const selectFeeLedgerTab = useCallback(
    (tabId) => {
      setTab(tabId)
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('tab', tabId)
          if (tabId !== 'charges' && tabId !== 'payments') {
            p.delete('student_id')
          }
          if (tabId !== 'payments') {
            p.delete('paid_from')
            p.delete('paid_to')
          }
          if (tabId !== 'charges') {
            p.delete('term_id')
          }
          if (tabId !== 'terms' && tabId !== 'charges') {
            p.delete('academic_year_id')
          }
          return p
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const setStudentFilter = useCallback(
    (studentId) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (studentId) p.set('student_id', studentId)
          else p.delete('student_id')
          return p
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const setPaidFromFilter = useCallback(
    (value) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          const v = String(value || '').slice(0, 10)
          if (v) p.set('paid_from', v)
          else p.delete('paid_from')
          return p
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const setPaidToFilter = useCallback(
    (value) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          const v = String(value || '').slice(0, 10)
          if (v) p.set('paid_to', v)
          else p.delete('paid_to')
          return p
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const setAcademicYearFilter = useCallback(
    (yearId) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (yearId) p.set('academic_year_id', yearId)
          else p.delete('academic_year_id')
          if (tab === 'charges' || p.get('tab') === 'charges') {
            p.delete('term_id')
          }
          return p
        },
        { replace: true }
      )
    },
    [setSearchParams, tab]
  )

  const setChargeTermFilter = useCallback(
    (termId) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (termId) {
            p.set('term_id', termId)
            const term = terms.find((t) => String(t.$id) === String(termId))
            if (term?.academic_year_id) p.set('academic_year_id', String(term.academic_year_id))
          } else {
            p.delete('term_id')
          }
          return p
        },
        { replace: true }
      )
    },
    [setSearchParams, terms]
  )

  const setChargeYearFilter = useCallback(
    (yearId) => {
      if (tab === 'terms') {
        setAcademicYearFilter(yearId)
        return
      }
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (yearId) p.set('academic_year_id', yearId)
          else p.delete('academic_year_id')
          p.delete('term_id')
          return p
        },
        { replace: true }
      )
    },
    [setSearchParams, tab, setAcademicYearFilter]
  )

  const yearReportById = useMemo(() => {
    const m = new Map()
    for (const row of yearReports) m.set(String(row.year_id), row)
    return m
  }, [yearReports])

  const termReportById = useMemo(() => {
    const m = new Map()
    for (const row of termReports) m.set(String(row.term_id), row)
    return m
  }, [termReports])

  const handleFeeLedgerTabListKeyDown = useCallback(
    (e) => {
      if (e.target?.getAttribute?.('role') !== 'tab') return
      const i = FEE_LEDGER_TAB_IDS.indexOf(tab)
      if (i < 0) return
      let next = i
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        next = (i + 1) % FEE_LEDGER_TAB_IDS.length
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        next = (i - 1 + FEE_LEDGER_TAB_IDS.length) % FEE_LEDGER_TAB_IDS.length
      } else if (e.key === 'Home') {
        e.preventDefault()
        next = 0
      } else if (e.key === 'End') {
        e.preventDefault()
        next = FEE_LEDGER_TAB_IDS.length - 1
      } else {
        return
      }
      const nextId = FEE_LEDGER_TAB_IDS[next]
      selectFeeLedgerTab(nextId)
      window.requestAnimationFrame(() => {
        document.getElementById(`fee-ledger-tab-${nextId}`)?.focus()
      })
    },
    [tab, selectFeeLedgerTab]
  )

  useEffect(() => {
    loadCore()
  }, [loadCore])

  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(monthParam)) return
    setSummaryMonth((prev) => (prev === monthParam ? prev : monthParam))
  }, [monthParam])

  useEffect(() => {
    if (!tabParam || !TABS.some((t) => t.id === tabParam)) return
    setTab((cur) => (cur === tabParam ? cur : tabParam))
  }, [tabParam])

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const stripHighlight = () => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.delete('highlight')
          return p
        },
        { replace: true }
      )
    }

    if (!highlightParam || !companyId || !isLocalDataSource()) return

    let cancelled = false
    const wantId = String(highlightParam)

    ;(async () => {
      try {
        const [yr, tr, st, ch, py] = await Promise.all([
          api.getAcademicYears(companyId),
          api.getAcademicTerms(companyId),
          api.getStudents(companyId),
          api.getFeeCharges(companyId),
          api.getFeePayments(companyId)
        ])
        if (cancelled) return
        setYears(yr)
        setTerms(tr)
        setStudents(st)
        setCharges(ch)
        setPayments(py)

        const targetTab = resolveFeeLedgerEntityTab(wantId, {
          years: yr,
          terms: tr,
          students: st,
          charges: ch,
          payments: py
        })

        if (!targetTab) {
          toast.error('That record was not found (it may have been deleted).')
          stripHighlight()
          return
        }

        selectFeeLedgerTab(targetTab)
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            if (cancelled) return
            const el = document.getElementById(`fee-ledger-row-${wantId}`)
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
              setHighlightFlashId(wantId)
              if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current)
              flashTimerRef.current = window.setTimeout(() => {
                setHighlightFlashId(null)
                flashTimerRef.current = null
                stripHighlight()
              }, 2800)
            } else {
              stripHighlight()
            }
          })
        })
      } catch {
        if (!cancelled) {
          toast.error('Could not load fee ledger data for that link.')
          stripHighlight()
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [highlightParam, companyId, setSearchParams, selectFeeLedgerTab])

  useEffect(() => {
    if (tab === 'summary') loadSummary()
    if (tab === 'years') loadYearReports()
    if (tab === 'terms') {
      loadTerms()
      loadTermReports()
    }
    if (tab === 'charges' || tab === 'payments') loadChargesPayments()
  }, [tab, loadSummary, loadYearReports, loadTerms, loadTermReports, loadChargesPayments])

  const resetYearForm = () => {
    setYearForm(emptyYear)
    setEditingYearId(null)
  }
  const resetTermForm = () => {
    setTermForm(emptyTerm)
    setEditingTermId(null)
  }
  const resetStudentForm = () => {
    setStudentForm(emptyStudent)
    setEditingStudentId(null)
  }
  const resetChargeForm = () => {
    setChargeForm(emptyCharge)
    setEditingChargeId(null)
  }
  const resetPaymentForm = () => {
    setPaymentForm({ ...emptyPayment, paid_on: format(new Date(), 'yyyy-MM-dd') })
    setEditingPaymentId(null)
  }

  const handleSaveYear = async (e) => {
    e.preventDefault()
    if (!companyId) return
    try {
      if (editingYearId) {
        await api.updateAcademicYear(companyId, editingYearId, yearForm)
        toast.success('Academic year updated')
      } else {
        await api.createAcademicYear(companyId, yearForm)
        toast.success('Academic year created')
      }
      resetYearForm()
      await loadCore()
      await loadTerms()
      await loadYearReports()
    } catch (err) {
      toast.error(err.message || 'Save failed')
    }
  }

  const handleSaveTerm = async (e) => {
    e.preventDefault()
    if (!companyId) return
    try {
      if (editingTermId) {
        await api.updateAcademicTerm(companyId, editingTermId, termForm)
        toast.success('Term updated')
      } else {
        await api.createAcademicTerm(companyId, termForm)
        toast.success('Term created')
      }
      resetTermForm()
      await loadTerms()
      await loadTermReports()
    } catch (err) {
      toast.error(err.message || 'Save failed')
    }
  }

  const handleSaveStudent = async (e) => {
    e.preventDefault()
    if (!companyId) return
    try {
      if (editingStudentId) {
        await api.updateStudent(companyId, editingStudentId, studentForm)
        toast.success('Student updated')
      } else {
        await api.createStudent(companyId, studentForm)
        toast.success('Student created')
      }
      resetStudentForm()
      await loadCore()
    } catch (err) {
      toast.error(err.message || 'Save failed')
    }
  }

  const handleSaveCharge = async (e) => {
    e.preventDefault()
    if (!companyId) return
    try {
      const payload = {
        ...chargeForm,
        amount: Number(chargeForm.amount),
        academic_year_id: chargeForm.academic_year_id || undefined,
        term_id: chargeForm.term_id || undefined,
        due_date: chargeForm.due_date || undefined
      }
      if (editingChargeId) {
        await api.updateFeeCharge(companyId, editingChargeId, payload)
        toast.success('Charge updated')
      } else {
        await api.createFeeCharge(companyId, payload)
        toast.success('Charge created')
      }
      resetChargeForm()
      await loadChargesPayments()
      await loadSummary()
      await loadYearReports()
      await loadTermReports()
    } catch (err) {
      toast.error(err.message || 'Save failed')
    }
  }

  const handleSavePayment = async (e) => {
    e.preventDefault()
    if (!companyId) return
    try {
      const payload = {
        ...paymentForm,
        amount: Number(paymentForm.amount)
      }
      if (editingPaymentId) {
        await api.updateFeePayment(companyId, editingPaymentId, payload)
        toast.success('Payment updated')
      } else {
        await api.createFeePayment(companyId, payload)
        toast.success('Payment recorded')
      }
      resetPaymentForm()
      await loadChargesPayments()
      await loadSummary()
      await loadYearReports()
      await loadTermReports()
    } catch (err) {
      toast.error(err.message || 'Save failed')
    }
  }

  const runDelete = async () => {
    if (!confirmDel || !companyId) return
    const { kind, id } = confirmDel
    try {
      if (kind === 'year') await api.deleteAcademicYear(companyId, id)
      if (kind === 'term') await api.deleteAcademicTerm(companyId, id)
      if (kind === 'student') await api.deleteStudent(companyId, id)
      if (kind === 'charge') await api.deleteFeeCharge(companyId, id)
      if (kind === 'payment') await api.deleteFeePayment(companyId, id)
      toast.success('Deleted')
      setConfirmDel(null)
      await loadCore()
      await loadTerms()
      await loadYearReports()
      await loadTermReports()
      await loadChargesPayments()
      await loadSummary()
    } catch (err) {
      toast.error(err.message || 'Delete failed')
    }
  }

  const termsForYear = (yearId) =>
    yearId ? terms.filter((t) => String(t.academic_year_id) === String(yearId)) : terms

  const handleExportYearReports = () => {
    try {
      const stamp = format(new Date(), 'yyyy-MM-dd')
      downloadFeeLedgerCsv(`fee-academic-years-report-${stamp}.csv`, buildAcademicYearsReportCsv(yearReports))
      toast.success('CSV downloaded')
    } catch (err) {
      toast.error(err.message || 'Export failed')
    }
  }

  const handleExportTermReports = () => {
    try {
      const stamp = format(new Date(), 'yyyy-MM-dd')
      const tag = academicYearIdParam ? '-year' : ''
      downloadFeeLedgerCsv(
        `fee-academic-terms-report${tag}-${stamp}.csv`,
        buildAcademicTermsReportCsv(termReports)
      )
      toast.success('CSV downloaded')
    } catch (err) {
      toast.error(err.message || 'Export failed')
    }
  }

  const handleExportStudents = () => {
    try {
      const stamp = format(new Date(), 'yyyy-MM-dd')
      downloadFeeLedgerCsv(`fee-students-${stamp}.csv`, buildFeeStudentsCsv(students))
      toast.success('CSV downloaded')
    } catch (err) {
      toast.error(err.message || 'Export failed')
    }
  }

  const handleExportCharges = () => {
    try {
      const stamp = format(new Date(), 'yyyy-MM-dd')
      const tags = [
        studentIdParam ? 'student' : '',
        academicYearIdParam ? 'year' : '',
        chargeTermIdParam ? 'term' : ''
      ].filter(Boolean)
      const tag = tags.length ? `-${tags.join('-')}` : ''
      downloadFeeLedgerCsv(
        `fee-charges${tag}-${stamp}.csv`,
        buildFeeChargesCsv(charges, { students, years, terms })
      )
      toast.success('CSV downloaded')
    } catch (err) {
      toast.error(err.message || 'Export failed')
    }
  }

  const handleExportPayments = () => {
    try {
      const stamp = format(new Date(), 'yyyy-MM-dd')
      const tags = [
        studentIdParam ? 'student' : '',
        paidFromParam ? 'from' : '',
        paidToParam ? 'to' : ''
      ].filter(Boolean)
      const tag = tags.length ? `-${tags.join('-')}` : ''
      downloadFeeLedgerCsv(
        `fee-payments${tag}-${stamp}.csv`,
        buildFeePaymentsCsv(payments, { students })
      )
      toast.success('CSV downloaded')
    } catch (err) {
      toast.error(err.message || 'Export failed')
    }
  }

  const filteredStudentLabel = studentIdParam ? feeLedgerStudentLabel(students, studentIdParam) : ''
  const summaryMonthRange = feeLedgerMonthDateRange(summaryMonth)
  const showChargePeriodColumns = !academicYearIdParam && !chargeTermIdParam

  const chargesEmptyMessage = () => {
    if (students.length === 0) {
      return 'Add students first, then record charges using the form above.'
    }
    const parts = []
    if (academicYearIdParam) {
      const y = years.find((row) => String(row.$id) === String(academicYearIdParam))
      parts.push(y?.label || 'selected year')
    }
    if (chargeTermIdParam) {
      const t = terms.find((row) => String(row.$id) === String(chargeTermIdParam))
      parts.push(t?.name || 'selected term')
    }
    if (studentIdParam) parts.push(filteredStudentLabel || 'selected student')
    if (parts.length) return `No fee charges match ${parts.join(' · ')}.`
    return 'No fee charges yet. Add one using the form above.'
  }

  const paymentsEmptyMessage = () => {
    if (students.length === 0) {
      return 'Add students first, then record payments using the form above.'
    }
    const parts = []
    if (paidFromParam || paidToParam) {
      if (paidFromParam && paidToParam) parts.push(`${paidFromParam} – ${paidToParam}`)
      else if (paidFromParam) parts.push(`from ${paidFromParam}`)
      else parts.push(`to ${paidToParam}`)
    }
    if (studentIdParam) parts.push(filteredStudentLabel || 'selected student')
    if (parts.length) return `No fee payments match ${parts.join(' · ')}.`
    return 'No fee payments yet. Add one using the form above.'
  }

  if (!isLocalDataSource()) {
    return (
      <div className="fee-ledger-page">
        <div className="page-header">
          <h1>Fee ledger</h1>
        </div>
        <p className="page-description">
          The fee ledger runs on the <strong>local desktop / SQLite API</strong>. Use the desktop build or connect
          via LAN with the local API enabled, then return here.
        </p>
      </div>
    )
  }

  if (!currentCompany) {
    return (
      <div className="fee-ledger-page">
        <div className="page-header">
          <h1>Fee ledger</h1>
        </div>
        <p className="page-description">Select a company in the header to manage fees.</p>
      </div>
    )
  }

  return (
    <div className="fee-ledger-page">
      <div className="page-header">
        <h1>Fee ledger</h1>
      </div>
      <p className="page-description">
        Manage <strong>academic years and terms</strong>, <strong>students</strong>, <strong>fee charges</strong>, and{' '}
        <strong>payments</strong> through the local SQLite API (separate from payroll and operational expenses). The
        summary month, active tab, and filters (<strong>student</strong>, <strong>year</strong>, <strong>term</strong> on
        charges; <strong>paid from / to</strong> on payments) stay in the address bar; year and term report rows link to
        filtered charges or payments; summary cards jump to the matching list; opening a row from the activity log adds a
        highlight on the correct tab.
      </p>

      <div
        className="fee-ledger-tabs"
        role="tablist"
        aria-label="Fee ledger sections"
        onKeyDown={handleFeeLedgerTabListKeyDown}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            id={`fee-ledger-tab-${t.id}`}
            role="tab"
            tabIndex={tab === t.id ? 0 : -1}
            aria-selected={tab === t.id}
            aria-controls={`fee-ledger-panel-${t.id}`}
            className={tab === t.id ? 'active' : ''}
            onClick={() => selectFeeLedgerTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && tab !== 'summary' && <p>Loading…</p>}

      <div
        id="fee-ledger-panel-summary"
        role="tabpanel"
        aria-labelledby="fee-ledger-tab-summary"
        hidden={tab !== 'summary'}
      >
      {tab === 'summary' && (
        <>
          <div className="fee-ledger-month">
            <label htmlFor="fee-sum-month">Month</label>
            <input
              id="fee-sum-month"
              type="month"
              value={summaryMonth}
              onChange={(e) => {
                const v = e.target.value
                setSummaryMonth(v)
                setSearchParams(
                  (prev) => {
                    const p = new URLSearchParams(prev)
                    if (v) p.set('month', v)
                    else p.delete('month')
                    return p
                  },
                  { replace: true }
                )
              }}
            />
          </div>
          {summaryLoading && !summary && <p className="fee-ledger-summary-loading">Loading summary…</p>}
          {!summaryLoading && !summary && (
            <p className="fee-ledger-summary-loading">No summary data for this month.</p>
          )}
          {summary && (
            <div className="fee-ledger-summary">
              <Link to="/school/fee-ledger?tab=students" className="fee-ledger-summary-card fee-ledger-summary-card--link">
                <p className="label">Active students</p>
                <p className="value">{summary.active_student_count}</p>
              </Link>
              <Link to="/school/fee-ledger?tab=charges" className="fee-ledger-summary-card fee-ledger-summary-card--link">
                <p className="label">Open / partial charges</p>
                <p className="value">{formatMoneyAmount(summary.open_charges_total, { prefix: 'KES ' })}</p>
              </Link>
              <Link
                to={`/school/fee-ledger?tab=payments${feeLedgerPeriodQuery(summaryMonthRange.from, summaryMonthRange.to)}`}
                className="fee-ledger-summary-card fee-ledger-summary-card--link"
              >
                <p className="label">Payments ({summary.month})</p>
                <p className="value">{formatMoneyAmount(summary.payments_month_total, { prefix: 'KES ' })}</p>
              </Link>
            </div>
          )}
        </>
      )}
      </div>

      <div
        id="fee-ledger-panel-years"
        role="tabpanel"
        aria-labelledby="fee-ledger-tab-years"
        hidden={tab !== 'years'}
      >
      {tab === 'years' && (
        <>
          <form className="fee-ledger-inline-form" onSubmit={handleSaveYear}>
            <input
              placeholder="Label (e.g. 2025/2026)"
              value={yearForm.label}
              onChange={(e) => setYearForm((p) => ({ ...p, label: e.target.value }))}
            />
            <input
              type="date"
              value={yearForm.start_date}
              onChange={(e) => setYearForm((p) => ({ ...p, start_date: e.target.value }))}
            />
            <input
              type="date"
              value={yearForm.end_date}
              onChange={(e) => setYearForm((p) => ({ ...p, end_date: e.target.value }))}
            />
            <label>
              <input
                type="checkbox"
                checked={!!yearForm.is_active}
                onChange={(e) => setYearForm((p) => ({ ...p, is_active: e.target.checked }))}
              />{' '}
              Active
            </label>
            <button type="submit">{editingYearId ? 'Update' : 'Add'} year</button>
            {editingYearId && (
              <button type="button" onClick={resetYearForm}>
                Cancel
              </button>
            )}
          </form>
          <p className="fee-ledger-report-hint">
            Report totals: fee charges linked to the year; payments with paid date within the year start and end dates.
          </p>
          <div className="fee-ledger-toolbar fee-ledger-toolbar--end">
            <button
              type="button"
              className="fee-ledger-toolbar-export"
              onClick={handleExportYearReports}
              disabled={yearReports.length === 0}
            >
              Export report CSV
            </button>
          </div>
          {yearReportsLoading && <p className="fee-ledger-summary-loading">Loading year reports…</p>}
          <div className="fee-ledger-table-wrap fee-ledger-table-wrap--wide">
            <table className="fee-ledger-table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Active</th>
                  <th className="fee-ledger-num">Terms</th>
                  <th className="fee-ledger-num">Charges</th>
                  <th className="fee-ledger-num">Charged</th>
                  <th className="fee-ledger-num">Open</th>
                  <th className="fee-ledger-num">Paid in period</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {years.length === 0 ? (
                  <FeeLedgerEmptyRow
                    colSpan={10}
                    message="No academic years yet. Add one using the form above."
                  />
                ) : (
                years.map((y) => {
                  const rep = yearReportById.get(String(y.$id))
                  return (
                  <tr
                    key={y.$id}
                    id={`fee-ledger-row-${y.$id}`}
                    className={highlightFlashId === String(y.$id) ? 'fee-ledger-row--highlight' : undefined}
                  >
                    <td>{y.label}</td>
                    <td>{String(y.start_date || '').slice(0, 10)}</td>
                    <td>{String(y.end_date || '').slice(0, 10)}</td>
                    <td>{y.is_active ? 'Yes' : 'No'}</td>
                    <td className="fee-ledger-num">{rep != null ? rep.term_count : '—'}</td>
                    <td className="fee-ledger-num">{rep != null ? rep.charge_count : '—'}</td>
                    <td className="fee-ledger-num">
                      {rep != null ? formatMoneyAmount(rep.charges_total, { prefix: 'KES ' }) : '—'}
                    </td>
                    <td className="fee-ledger-num">
                      {rep != null ? formatMoneyAmount(rep.open_charges_total, { prefix: 'KES ' }) : '—'}
                    </td>
                    <td className="fee-ledger-num">
                      {rep != null ? formatMoneyAmount(rep.payments_in_period_total, { prefix: 'KES ' }) : '—'}
                    </td>
                    <td>
                      <div className="fee-ledger-row-actions">
                        <Link
                          to={`/school/fee-ledger?tab=terms&academic_year_id=${encodeURIComponent(y.$id)}`}
                          className="fee-ledger-inline-link"
                        >
                          Terms
                        </Link>
                        <Link
                          to={`/school/fee-ledger?tab=charges&academic_year_id=${encodeURIComponent(y.$id)}`}
                          className="fee-ledger-inline-link"
                        >
                          Charges
                        </Link>
                        {String(y.start_date || '').slice(0, 10) && String(y.end_date || '').slice(0, 10) ? (
                          <>
                            <Link
                              to={`/school/fee-ledger?tab=payments&paid_from=${encodeURIComponent(String(y.start_date).slice(0, 10))}&paid_to=${encodeURIComponent(String(y.end_date).slice(0, 10))}`}
                              className="fee-ledger-inline-link"
                            >
                              Payments
                            </Link>
                            <Link
                              to={buildStudentPeriodReportPath({
                                fromDate: String(y.start_date).slice(0, 10),
                                toDate: String(y.end_date).slice(0, 10)
                              })}
                              className="fee-ledger-inline-link"
                            >
                              Attendance
                            </Link>
                          </>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingYearId(y.$id)
                            setYearForm({
                              label: y.label || '',
                              start_date: String(y.start_date || '').slice(0, 10),
                              end_date: String(y.end_date || '').slice(0, 10),
                              is_active: !!y.is_active
                            })
                          }}
                        >
                          Edit
                        </button>
                        <button type="button" onClick={() => setConfirmDel({ kind: 'year', id: y.$id })}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                }))}
              </tbody>
            </table>
          </div>
        </>
      )}
      </div>

      <div
        id="fee-ledger-panel-terms"
        role="tabpanel"
        aria-labelledby="fee-ledger-tab-terms"
        hidden={tab !== 'terms'}
      >
      {tab === 'terms' && (
        <>
          <form className="fee-ledger-inline-form" onSubmit={handleSaveTerm}>
            <select
              value={termForm.academic_year_id}
              onChange={(e) => setTermForm((p) => ({ ...p, academic_year_id: e.target.value }))}
            >
              <option value="">Academic year…</option>
              {years.map((y) => (
                <option key={y.$id} value={y.$id}>
                  {y.label}
                </option>
              ))}
            </select>
            <input
              placeholder="Term name"
              value={termForm.name}
              onChange={(e) => setTermForm((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              type="date"
              value={termForm.start_date}
              onChange={(e) => setTermForm((p) => ({ ...p, start_date: e.target.value }))}
            />
            <input
              type="date"
              value={termForm.end_date}
              onChange={(e) => setTermForm((p) => ({ ...p, end_date: e.target.value }))}
            />
            <button type="submit">{editingTermId ? 'Update' : 'Add'} term</button>
            {editingTermId && (
              <button type="button" onClick={resetTermForm}>
                Cancel
              </button>
            )}
          </form>
          <p className="fee-ledger-report-hint">
            Report totals: fee charges linked to the term; payments with paid date within the term start and end dates.
          </p>
          <FeeLedgerYearFilterToolbar
            years={years}
            yearId={academicYearIdParam}
            onYearIdChange={setAcademicYearFilter}
            onExport={handleExportTermReports}
            exportDisabled={termReports.length === 0}
          />
          {termReportsLoading && <p className="fee-ledger-summary-loading">Loading term reports…</p>}
          <div className="fee-ledger-table-wrap fee-ledger-table-wrap--wide">
            <table className="fee-ledger-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Name</th>
                  <th>Start</th>
                  <th>End</th>
                  <th className="fee-ledger-num">Charges</th>
                  <th className="fee-ledger-num">Charged</th>
                  <th className="fee-ledger-num">Open</th>
                  <th className="fee-ledger-num">Paid in period</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {terms.length === 0 ? (
                  <FeeLedgerEmptyRow
                    colSpan={9}
                    message={
                      years.length === 0
                        ? 'Add an academic year first, then add terms using the form above.'
                        : academicYearIdParam
                          ? 'No terms for this academic year.'
                          : 'No terms yet. Add one using the form above.'
                    }
                  />
                ) : (
                terms.map((t) => {
                  const yl = years.find((y) => String(y.$id) === String(t.academic_year_id))?.label || '—'
                  const rep = termReportById.get(String(t.$id))
                  return (
                    <tr
                      key={t.$id}
                      id={`fee-ledger-row-${t.$id}`}
                      className={highlightFlashId === String(t.$id) ? 'fee-ledger-row--highlight' : undefined}
                    >
                      <td>{yl}</td>
                      <td>{t.name}</td>
                      <td>{String(t.start_date || '').slice(0, 10)}</td>
                      <td>{String(t.end_date || '').slice(0, 10)}</td>
                      <td className="fee-ledger-num">{rep != null ? rep.charge_count : '—'}</td>
                      <td className="fee-ledger-num">
                        {rep != null ? formatMoneyAmount(rep.charges_total, { prefix: 'KES ' }) : '—'}
                      </td>
                      <td className="fee-ledger-num">
                        {rep != null ? formatMoneyAmount(rep.open_charges_total, { prefix: 'KES ' }) : '—'}
                      </td>
                      <td className="fee-ledger-num">
                        {rep != null ? formatMoneyAmount(rep.payments_in_period_total, { prefix: 'KES ' }) : '—'}
                      </td>
                      <td>
                        <div className="fee-ledger-row-actions">
                          <Link
                            to={`/school/fee-ledger?tab=charges&term_id=${encodeURIComponent(t.$id)}&academic_year_id=${encodeURIComponent(t.academic_year_id || '')}`}
                            className="fee-ledger-inline-link"
                          >
                            Charges
                          </Link>
                          {String(t.start_date || '').slice(0, 10) && String(t.end_date || '').slice(0, 10) ? (
                            <>
                              <Link
                                to={`/school/fee-ledger?tab=payments&paid_from=${encodeURIComponent(String(t.start_date).slice(0, 10))}&paid_to=${encodeURIComponent(String(t.end_date).slice(0, 10))}`}
                                className="fee-ledger-inline-link"
                              >
                                Payments
                              </Link>
                              <Link
                                to={buildStudentPeriodReportPath({
                                  fromDate: String(t.start_date).slice(0, 10),
                                  toDate: String(t.end_date).slice(0, 10)
                                })}
                                className="fee-ledger-inline-link"
                              >
                                Attendance
                              </Link>
                            </>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTermId(t.$id)
                              setTermForm({
                                academic_year_id: t.academic_year_id || '',
                                name: t.name || '',
                                start_date: String(t.start_date || '').slice(0, 10),
                                end_date: String(t.end_date || '').slice(0, 10)
                              })
                            }}
                          >
                            Edit
                          </button>
                          <button type="button" onClick={() => setConfirmDel({ kind: 'term', id: t.$id })}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                }))}
              </tbody>
            </table>
          </div>
        </>
      )}
      </div>

      <div
        id="fee-ledger-panel-students"
        role="tabpanel"
        aria-labelledby="fee-ledger-tab-students"
        hidden={tab !== 'students'}
      >
      {tab === 'students' && (
        <>
          <form className="fee-ledger-inline-form" onSubmit={handleSaveStudent}>
            <input
              placeholder="Student number"
              value={studentForm.student_number}
              onChange={(e) => setStudentForm((p) => ({ ...p, student_number: e.target.value }))}
            />
            <input
              placeholder="Legal name"
              value={studentForm.legal_name}
              onChange={(e) => setStudentForm((p) => ({ ...p, legal_name: e.target.value }))}
            />
            <input
              placeholder="Class / form"
              value={studentForm.class_label}
              onChange={(e) => setStudentForm((p) => ({ ...p, class_label: e.target.value }))}
            />
            <input
              type="email"
              placeholder="Parent / guardian email"
              value={studentForm.guardian_email || ''}
              onChange={(e) => setStudentForm((p) => ({ ...p, guardian_email: e.target.value }))}
            />
            <button type="submit">{editingStudentId ? 'Update' : 'Add'} student</button>
            {editingStudentId && (
              <button type="button" onClick={resetStudentForm}>
                Cancel
              </button>
            )}
          </form>
          <div className="fee-ledger-toolbar fee-ledger-toolbar--end">
            <button
              type="button"
              className="fee-ledger-toolbar-export"
              onClick={handleExportStudents}
              disabled={students.length === 0}
            >
              Export CSV
            </button>
          </div>
          <div className="fee-ledger-table-wrap">
            <table className="fee-ledger-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Name</th>
                  <th>Class</th>
                  <th>Status</th>
                  <th>QR</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <FeeLedgerEmptyRow colSpan={6} message="No students yet. Add one using the form above." />
                ) : (
                students.map((s) => {
                  const classLabel = String(s.class_label || '').trim()
                  const today = format(new Date(), 'yyyy-MM-dd')
                  return (
                  <tr
                    key={s.$id}
                    id={`fee-ledger-row-${s.$id}`}
                    className={highlightFlashId === String(s.$id) ? 'fee-ledger-row--highlight' : undefined}
                  >
                    <td>{s.student_number}</td>
                    <td>{s.legal_name}</td>
                    <td>{s.class_label}</td>
                    <td>{s.status}</td>
                    <td>
                      <FeeLedgerStudentQrCell student={s} />
                    </td>
                    <td>
                      <div className="fee-ledger-row-actions">
                        {classLabel ? (
                          <Link
                            to={buildStudentMarkPath({
                              date: today,
                              classId: classLabel,
                              highlight: s.$id
                            })}
                            className="fee-ledger-inline-link"
                          >
                            Register
                          </Link>
                        ) : null}
                        {canViewStudentAttendance ? (
                          <button
                            type="button"
                            className="fee-ledger-inline-link"
                            onClick={() => setAttendanceHistoryStudent(s)}
                          >
                            View History
                          </button>
                        ) : null}
                        <Link
                          to={`/school/fee-ledger?tab=charges&student_id=${encodeURIComponent(s.$id)}`}
                          className="fee-ledger-inline-link"
                        >
                          Charges
                        </Link>
                        <Link
                          to={`/school/fee-ledger?tab=payments&student_id=${encodeURIComponent(s.$id)}`}
                          className="fee-ledger-inline-link"
                        >
                          Payments
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStudentId(s.$id)
                            setStudentForm({
                              student_number: s.student_number || '',
                              legal_name: s.legal_name || '',
                              class_label: s.class_label || '',
                              guardian_email: s.guardian_email || ''
                            })
                          }}
                        >
                          Edit
                        </button>
                        <button type="button" onClick={() => setConfirmDel({ kind: 'student', id: s.$id })}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                }))}
              </tbody>
            </table>
          </div>
        </>
      )}
      </div>

      <div
        id="fee-ledger-panel-charges"
        role="tabpanel"
        aria-labelledby="fee-ledger-tab-charges"
        hidden={tab !== 'charges'}
      >
      {tab === 'charges' && (
        <>
          <form className="fee-ledger-inline-form" onSubmit={handleSaveCharge}>
            <select
              value={chargeForm.student_id}
              onChange={(e) => setChargeForm((p) => ({ ...p, student_id: e.target.value }))}
            >
              <option value="">Student…</option>
              {students.map((s) => (
                <option key={s.$id} value={s.$id}>
                  {s.student_number} — {s.legal_name}
                </option>
              ))}
            </select>
            <select
              value={chargeForm.academic_year_id}
              onChange={(e) => setChargeForm((p) => ({ ...p, academic_year_id: e.target.value, term_id: '' }))}
            >
              <option value="">Year (optional)</option>
              {years.map((y) => (
                <option key={y.$id} value={y.$id}>
                  {y.label}
                </option>
              ))}
            </select>
            <select
              value={chargeForm.term_id}
              onChange={(e) => setChargeForm((p) => ({ ...p, term_id: e.target.value }))}
            >
              <option value="">Term (optional)</option>
              {termsForYear(chargeForm.academic_year_id).map((t) => (
                <option key={t.$id} value={t.$id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Description"
              value={chargeForm.description}
              onChange={(e) => setChargeForm((p) => ({ ...p, description: e.target.value }))}
            />
            <input
              placeholder="Amount"
              value={chargeForm.amount}
              onChange={(e) => setChargeForm((p) => ({ ...p, amount: e.target.value }))}
            />
            <input
              placeholder="Currency"
              value={chargeForm.currency}
              onChange={(e) => setChargeForm((p) => ({ ...p, currency: e.target.value }))}
            />
            <input
              type="date"
              value={chargeForm.due_date}
              onChange={(e) => setChargeForm((p) => ({ ...p, due_date: e.target.value }))}
            />
            <select
              value={chargeForm.status}
              onChange={(e) => setChargeForm((p) => ({ ...p, status: e.target.value }))}
            >
              <option value="open">open</option>
              <option value="partial">partial</option>
              <option value="settled">settled</option>
              <option value="waived">waived</option>
            </select>
            <button type="submit">{editingChargeId ? 'Update' : 'Add'} charge</button>
            {editingChargeId && (
              <button type="button" onClick={resetChargeForm}>
                Cancel
              </button>
            )}
          </form>
          <FeeLedgerChargesFilterToolbar
            years={years}
            terms={terms}
            academicYearId={academicYearIdParam}
            termId={chargeTermIdParam}
            students={students}
            studentId={studentIdParam}
            onAcademicYearChange={setChargeYearFilter}
            onTermChange={setChargeTermFilter}
            onStudentIdChange={setStudentFilter}
            onExport={handleExportCharges}
            exportDisabled={charges.length === 0}
          />
          <div className="fee-ledger-table-wrap">
            <table className="fee-ledger-table">
              <thead>
                <tr>
                  <th>Student</th>
                  {showChargePeriodColumns ? (
                    <>
                      <th>Year</th>
                      <th>Term</th>
                    </>
                  ) : null}
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {charges.length === 0 ? (
                  <FeeLedgerEmptyRow
                    colSpan={showChargePeriodColumns ? 8 : 6}
                    message={chargesEmptyMessage()}
                  />
                ) : (
                charges.map((c) => {
                  const sn = students.find((s) => String(s.$id) === String(c.student_id))
                  const snLabel = sn ? `${sn.student_number} — ${sn.legal_name}` : c.student_id
                  return (
                    <tr
                      key={c.$id}
                      id={`fee-ledger-row-${c.$id}`}
                      className={highlightFlashId === String(c.$id) ? 'fee-ledger-row--highlight' : undefined}
                    >
                      <td>{snLabel}</td>
                      {showChargePeriodColumns ? (
                        <>
                          <td>{feeLedgerYearLabel(years, c.academic_year_id) || '—'}</td>
                          <td>{feeLedgerTermLabel(terms, c.term_id) || '—'}</td>
                        </>
                      ) : null}
                      <td>{c.description}</td>
                      <td>{formatMoneyAmount(c.amount, { prefix: 'KES ' })}</td>
                      <td>{c.due_date || '—'}</td>
                      <td>{c.status}</td>
                      <td>
                        <div className="fee-ledger-row-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingChargeId(c.$id)
                              setChargeForm({
                                student_id: c.student_id || '',
                                academic_year_id: c.academic_year_id || '',
                                term_id: c.term_id || '',
                                description: c.description || '',
                                amount: String(c.amount ?? ''),
                                currency: c.currency || '',
                                due_date: String(c.due_date || '').slice(0, 10),
                                status: c.status || 'open'
                              })
                            }}
                          >
                            Edit
                          </button>
                          <button type="button" onClick={() => setConfirmDel({ kind: 'charge', id: c.$id })}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                }))}
              </tbody>
            </table>
          </div>
        </>
      )}
      </div>

      <div
        id="fee-ledger-panel-payments"
        role="tabpanel"
        aria-labelledby="fee-ledger-tab-payments"
        hidden={tab !== 'payments'}
      >
      {tab === 'payments' && (
        <>
          <form className="fee-ledger-inline-form" onSubmit={handleSavePayment}>
            <select
              value={paymentForm.student_id}
              onChange={(e) => setPaymentForm((p) => ({ ...p, student_id: e.target.value }))}
            >
              <option value="">Student…</option>
              {students.map((s) => (
                <option key={s.$id} value={s.$id}>
                  {s.student_number} — {s.legal_name}
                </option>
              ))}
            </select>
            <input
              placeholder="Amount"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))}
            />
            <input
              placeholder="Currency"
              value={paymentForm.currency}
              onChange={(e) => setPaymentForm((p) => ({ ...p, currency: e.target.value }))}
            />
            <input
              type="date"
              value={paymentForm.paid_on}
              onChange={(e) => setPaymentForm((p) => ({ ...p, paid_on: e.target.value }))}
            />
            <input
              placeholder="Method"
              value={paymentForm.payment_method}
              onChange={(e) => setPaymentForm((p) => ({ ...p, payment_method: e.target.value }))}
            />
            <input
              placeholder="Reference"
              value={paymentForm.reference}
              onChange={(e) => setPaymentForm((p) => ({ ...p, reference: e.target.value }))}
            />
            <input
              placeholder="Receipt #"
              value={paymentForm.receipt_number}
              onChange={(e) => setPaymentForm((p) => ({ ...p, receipt_number: e.target.value }))}
            />
            <input
              placeholder="Notes"
              value={paymentForm.notes}
              onChange={(e) => setPaymentForm((p) => ({ ...p, notes: e.target.value }))}
            />
            <button type="submit">{editingPaymentId ? 'Update' : 'Add'} payment</button>
            {editingPaymentId && (
              <button type="button" onClick={resetPaymentForm}>
                Cancel
              </button>
            )}
          </form>
          <FeeLedgerPaymentsFilterToolbar
            students={students}
            studentId={studentIdParam}
            paidFrom={paidFromParam}
            paidTo={paidToParam}
            onStudentIdChange={setStudentFilter}
            onPaidFromChange={setPaidFromFilter}
            onPaidToChange={setPaidToFilter}
            onExport={handleExportPayments}
            exportDisabled={payments.length === 0}
          />
          <div className="fee-ledger-table-wrap">
            <table className="fee-ledger-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Amount</th>
                  <th>Paid on</th>
                  <th>Method</th>
                  <th>Receipt</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <FeeLedgerEmptyRow colSpan={6} message={paymentsEmptyMessage()} />
                ) : (
                payments.map((p) => {
                  const sn = students.find((s) => String(s.$id) === String(p.student_id))
                  const snLabel = sn ? `${sn.student_number} — ${sn.legal_name}` : p.student_id
                  return (
                    <tr
                      key={p.$id}
                      id={`fee-ledger-row-${p.$id}`}
                      className={highlightFlashId === String(p.$id) ? 'fee-ledger-row--highlight' : undefined}
                    >
                      <td>{snLabel}</td>
                      <td>{formatMoneyAmount(p.amount, { prefix: 'KES ' })}</td>
                      <td>{p.paid_on}</td>
                      <td>{p.payment_method || '—'}</td>
                      <td>{p.receipt_number || '—'}</td>
                      <td>
                        <div className="fee-ledger-row-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPaymentId(p.$id)
                              setPaymentForm({
                                student_id: p.student_id || '',
                                amount: String(p.amount ?? ''),
                                currency: p.currency || '',
                                paid_on: String(p.paid_on || '').slice(0, 10),
                                payment_method: p.payment_method || '',
                                reference: p.reference || '',
                                receipt_number: p.receipt_number || '',
                                notes: p.notes || ''
                              })
                            }}
                          >
                            Edit
                          </button>
                          <button type="button" onClick={() => setConfirmDel({ kind: 'payment', id: p.$id })}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                }))}
              </tbody>
            </table>
          </div>
        </>
      )}
      </div>

      {attendanceHistoryStudent && companyId && canViewStudentAttendance ? (
        <StudentIndividualHistory
          companyId={companyId}
          student={attendanceHistoryStudent}
          onClose={() => setAttendanceHistoryStudent(null)}
        />
      ) : null}

      <ConfirmDialog
        open={!!confirmDel}
        title="Delete?"
        message="This cannot be undone. Dependent records may block deletion."
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDel(null)}
        onConfirm={runDelete}
      />
    </div>
  )
}

export default FeeLedger
