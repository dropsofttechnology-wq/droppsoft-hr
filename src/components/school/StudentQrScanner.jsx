import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Html5Qrcode } from 'html5-qrcode'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import { isLocalDataSource } from '../../config/dataSource'
import { hasPermission } from '../../utils/permissions'
import { parseStudentQrPayload, shouldIgnoreFastScanDuplicate } from '../../utils/studentQr'
import { buildStudentMarkPath } from '../../utils/studentAttendanceNav'
import * as feeApi from '../../services/schoolFeeLedgerService'
import * as attendanceApi from '../../services/schoolStudentAttendanceService'
import './StudentQrScanner.css'

const SCANNER_REGION_ID = 'student-school-qr-camera-host'

const STORAGE_FAST_MODE = 'studentQrScanner.fastMode'
const STORAGE_FAST_ACTION = 'studentQrScanner.fastAction'

const FAST_ACTION = Object.freeze({
  mark_present: 'mark_present',
  open_ledger: 'open_ledger'
})

/** Standard UX beep when opening split-action flow */
function playScanBeep() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.frequency.value = 880
    g.gain.setValueAtTime(0.07, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
    o.start(ctx.currentTime)
    o.stop(ctx.currentTime + 0.12)
  } catch {
    /* ignore */
  }
}

function playFastSuccessBeep() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.connect(g)
    g.connect(ctx.destination)
    o.frequency.value = 1560
    g.gain.setValueAtTime(0.1, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)
    o.start(ctx.currentTime)
    o.stop(ctx.currentTime + 0.055)
  } catch {
    /* ignore */
  }
}

function playErrorBuzz() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'square'
    o.connect(g)
    g.connect(ctx.destination)
    o.frequency.value = 185
    g.gain.setValueAtTime(0.06, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22)
    o.start(ctx.currentTime)
    o.stop(ctx.currentTime + 0.24)
  } catch {
    /* ignore */
  }
}

function readInitialFastAction(canAttendance, canFeeLedger) {
  try {
    const v = localStorage.getItem(STORAGE_FAST_ACTION)
    const want = v === FAST_ACTION.open_ledger ? FAST_ACTION.open_ledger : FAST_ACTION.mark_present
    if (want === FAST_ACTION.open_ledger && canFeeLedger) return FAST_ACTION.open_ledger
    if (want === FAST_ACTION.mark_present && canAttendance) return FAST_ACTION.mark_present
  } catch {
    /* ignore */
  }
  if (canAttendance) return FAST_ACTION.mark_present
  if (canFeeLedger) return FAST_ACTION.open_ledger
  return FAST_ACTION.mark_present
}

function persistFastMode(enabled) {
  try {
    localStorage.setItem(STORAGE_FAST_MODE, enabled ? 'true' : 'false')
  } catch {
    /* ignore */
  }
}

function persistFastAction(action) {
  try {
    localStorage.setItem(STORAGE_FAST_ACTION, action)
  } catch {
    /* ignore */
  }
}

/**
 * Isolated student roster QR scanner (separate from staff attendance terminal).
 * @param {{ companyId: string, onClose: () => void, user: object | null }} props
 */
function StudentQrScannerModal({ companyId, onClose, user }) {
  const navigate = useNavigate()
  const canFeeLedger = !!user && hasPermission(user, 'fee_ledger')
  const canAttendance = !!user && hasPermission(user, 'school_attendance')
  const scannerInstRef = useRef(null)
  const startingRef = useRef(false)
  const processingRef = useRef(false)
  const fastModeRef = useRef(false)
  const fastActionRef = useRef(readInitialFastAction(canAttendance, canFeeLedger))
  /** @type {React.MutableRefObject<{ studentId: string, scannedAtMs: number } | null>} */
  const lastFastScanRef = useRef(null)
  const studentsCacheRef = useRef(null)
  const overlayClearTimerRef = useRef(null)
  const successExitTimerRef = useRef(null)

  const [scanError, setScanError] = useState('')
  const [phase, setPhase] = useState('scan')
  const [studentRecord, setStudentRecord] = useState(null)
  const [scanSession, setScanSession] = useState(0)
  const [fastMode, setFastMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_FAST_MODE) === 'true'
    } catch {
      return false
    }
  })
  const [fastAction, setFastAction] = useState(() => readInitialFastAction(canAttendance, canFeeLedger))
  const [fastOverlay, setFastOverlay] = useState(null)

  const canCbc = !!user && hasPermission(user, 'cbc_grading')

  useEffect(() => {
    const next = readInitialFastAction(canAttendance, canFeeLedger)
    setFastAction(next)
    persistFastAction(next)
  }, [companyId, canAttendance, canFeeLedger])

  useEffect(() => {
    fastModeRef.current = fastMode
  }, [fastMode])
  useEffect(() => {
    fastActionRef.current = fastAction
  }, [fastAction])

  const clearOverlaySoon = useCallback((ms) => {
    if (overlayClearTimerRef.current) window.clearTimeout(overlayClearTimerRef.current)
    if (successExitTimerRef.current) window.clearTimeout(successExitTimerRef.current)
    successExitTimerRef.current = null
    overlayClearTimerRef.current = window.setTimeout(() => {
      setFastOverlay(null)
      overlayClearTimerRef.current = null
    }, ms)
  }, [])

  const showFastSuccessOverlay = useCallback(
    (message) => {
      if (overlayClearTimerRef.current) window.clearTimeout(overlayClearTimerRef.current)
      if (successExitTimerRef.current) window.clearTimeout(successExitTimerRef.current)
      setFastOverlay({ type: 'success', message, leaving: false })
      successExitTimerRef.current = window.setTimeout(() => {
        setFastOverlay((prev) => (prev && prev.type === 'success' ? { ...prev, leaving: true } : prev))
        successExitTimerRef.current = null
      }, 1200)
      overlayClearTimerRef.current = window.setTimeout(() => {
        setFastOverlay(null)
        overlayClearTimerRef.current = null
      }, 1500)
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    feeApi.getStudents(companyId).then((rows) => {
      if (!cancelled) studentsCacheRef.current = rows
    })
    return () => {
      cancelled = true
    }
  }, [companyId])

  useEffect(() => {
    return () => {
      if (overlayClearTimerRef.current) window.clearTimeout(overlayClearTimerRef.current)
      if (successExitTimerRef.current) window.clearTimeout(successExitTimerRef.current)
    }
  }, [])

  const resolveStudentRow = useCallback(
    async (studentId) => {
      let rows = studentsCacheRef.current
      let row = rows?.find((s) => String(s.$id || s.id) === String(studentId))
      if (!row) {
        rows = await feeApi.getStudents(companyId)
        studentsCacheRef.current = rows
        row = rows.find((s) => String(s.$id || s.id) === String(studentId))
      }
      return row && String(row.status || '') === 'active' ? row : null
    },
    [companyId]
  )

  const stopScanner = useCallback(async () => {
    const inst = scannerInstRef.current
    scannerInstRef.current = null
    if (!inst) return
    try {
      await inst.stop()
      await inst.clear()
    } catch {
      /* ignore */
    }
  }, [])

  const resetFastScanUi = useCallback(() => {
    if (overlayClearTimerRef.current) window.clearTimeout(overlayClearTimerRef.current)
    if (successExitTimerRef.current) window.clearTimeout(successExitTimerRef.current)
    overlayClearTimerRef.current = null
    successExitTimerRef.current = null
    lastFastScanRef.current = null
    setFastOverlay(null)
    setScanError('')
  }, [])

  const cleanupAndClose = useCallback(async () => {
    await stopScanner()
    processingRef.current = false
    resetFastScanUi()
    setStudentRecord(null)
    setPhase('scan')
    onClose()
  }, [onClose, resetFastScanUi, stopScanner])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        void cleanupAndClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [cleanupAndClose])

  useEffect(() => {
    if (phase !== 'scan') return undefined

    let cancelled = false
    startingRef.current = false
    processingRef.current = false

    const run = async () => {
      if (scannerInstRef.current || startingRef.current) return
      startingRef.current = true
      setScanError('')

      const showFastError = (message) => {
        playErrorBuzz()
        setFastOverlay({ type: 'error', message })
        clearOverlaySoon(2000)
      }

      const handleFastMarkPresent = async (row) => {
        if (!hasPermission(user, 'school_attendance')) {
          showFastError('❌ Scan Failed: attendance permission required.')
          return
        }
        const classLabel = String(row.class_label || '').trim()
        if (!classLabel) {
          showFastError('❌ Scan Failed: Student unassigned to a class.')
          return
        }
        const today = format(new Date(), 'yyyy-MM-dd')
        try {
          await attendanceApi.upsertStudentPresentForDate(companyId, {
            date: today,
            classId: classLabel,
            studentId: String(row.$id || row.id)
          })
        } catch (e) {
          showFastError(`❌ Scan Failed: ${e.message || 'Could not save attendance.'}`)
          return
        }
        playFastSuccessBeep()
        const nm = String(row.legal_name || 'Student').trim()
        showFastSuccessOverlay(`✅ ${nm} marked present`)
      }

      const onDecoded = async (decodedText) => {
        if (cancelled) return

        const parsed = parseStudentQrPayload(decodedText)
        if (!parsed) {
          if (fastModeRef.current) {
            showFastError('❌ Scan Failed: not a student ID badge.')
          } else {
            toast.error('This QR is not a student ID badge.')
          }
          return
        }

        if (fastModeRef.current) {
          const now = Date.now()
          if (shouldIgnoreFastScanDuplicate(lastFastScanRef.current, parsed.studentId, now)) {
            return
          }
          lastFastScanRef.current = { studentId: parsed.studentId, scannedAtMs: now }

          const row = await resolveStudentRow(parsed.studentId)
          if (!row) {
            showFastError('❌ Scan Failed: student not found or inactive.')
            return
          }

          const action = fastActionRef.current
          if (action === FAST_ACTION.open_ledger) {
            if (!canFeeLedger) {
              showFastError('❌ Scan Failed: fee ledger access required.')
              return
            }
            processingRef.current = true
            await stopScanner()
            if (cancelled) return
            const id = String(row.$id || row.id)
            onClose()
            navigate(`/school/fee-ledger?tab=students&highlight=${encodeURIComponent(id)}`)
            return
          }

          await handleFastMarkPresent(row)
          return
        }

        if (processingRef.current || cancelled) return
        processingRef.current = true
        await stopScanner()
        if (cancelled) return
        playScanBeep()
        try {
          const row = await resolveStudentRow(parsed.studentId)
          if (!row) {
            toast.error('Student not found or inactive in this company.')
            processingRef.current = false
            setScanSession((s) => s + 1)
            return
          }
          setStudentRecord(row)
          setPhase('actions')
        } catch (e) {
          if (!cancelled) toast.error(e.message || 'Failed to look up student')
          processingRef.current = false
          setScanSession((s) => s + 1)
        }
      }

      const onScanError = () => {}

      try {
        const scanner = new Html5Qrcode(SCANNER_REGION_ID)
        scannerInstRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 12, qrbox: { width: 220, height: 220 } },
          onDecoded,
          onScanError
        )
      } catch {
        try {
          const scanner = new Html5Qrcode(SCANNER_REGION_ID)
          scannerInstRef.current = scanner
          const cameras = await Html5Qrcode.getCameras()
          if (!cameras?.length) throw new Error('No camera found.')
          const preferred =
            cameras.find((c) => /back|rear|environment/i.test(c.label || ''))?.id || cameras[0].id
          await scanner.start(
            preferred,
            { fps: 12, qrbox: { width: 220, height: 220 } },
            onDecoded,
            onScanError
          )
        } catch (e) {
          if (!cancelled) {
            setScanError(e?.message || 'Could not start the camera. Check permissions and try again.')
          }
          scannerInstRef.current = null
        }
      } finally {
        startingRef.current = false
      }
    }

    void run()

    return () => {
      cancelled = true
      void stopScanner()
    }
  }, [
    phase,
    scanSession,
    companyId,
    stopScanner,
    resolveStudentRow,
    navigate,
    onClose,
    clearOverlaySoon,
    canFeeLedger,
    user,
    showFastSuccessOverlay
  ])

  const goFeeLedger = async () => {
    if (!studentRecord) return
    const id = String(studentRecord.$id)
    await cleanupAndClose()
    navigate(`/school/fee-ledger?tab=students&highlight=${encodeURIComponent(id)}`)
  }

  const goAttendance = async () => {
    if (!studentRecord) return
    const id = String(studentRecord.$id)
    const cls = String(studentRecord.class_label || '').trim()
    const today = format(new Date(), 'yyyy-MM-dd')
    await cleanupAndClose()
    navigate(buildStudentMarkPath({ date: today, classId: cls, highlight: id }))
  }

  const goCbc = async () => {
    if (!studentRecord) return
    const id = String(studentRecord.$id)
    const cls = String(studentRecord.class_label || '').trim()
    await cleanupAndClose()
    const p = new URLSearchParams()
    p.set('tab', 'report')
    p.set('student_id', id)
    if (cls) p.set('class_id', cls)
    navigate(`/school/cbc-grading?${p.toString()}`)
  }

  const handleBackToScan = () => {
    resetFastScanUi()
    setStudentRecord(null)
    processingRef.current = false
    setPhase('scan')
    setScanSession((s) => s + 1)
  }

  return (
    <div className="student-qr-scanner-overlay" role="dialog" aria-modal="true" aria-labelledby="student-qr-scanner-title">
      <div className="student-qr-scanner-backdrop" onClick={() => void cleanupAndClose()} aria-hidden />
      <div className="student-qr-scanner-modal" onClick={(e) => e.stopPropagation()}>
        <header className="student-qr-scanner-header">
          <div className="student-qr-scanner-header-top">
            <h2 id="student-qr-scanner-title">Scan student ID</h2>
            <button type="button" className="student-qr-scanner-close" onClick={() => void cleanupAndClose()} aria-label="Close">
              ×
            </button>
          </div>
          <div className="student-qr-scanner-toolbar">
            <label className="student-qr-fast-toggle">
              <input
                type="checkbox"
                role="switch"
                aria-checked={fastMode}
                checked={fastMode}
                onChange={(e) => {
                  const v = e.target.checked
                  setFastMode(v)
                  persistFastMode(v)
                }}
              />
              <span className="student-qr-fast-toggle__slider" aria-hidden />
              <span className="student-qr-fast-toggle__label">⚡ Fast Mode</span>
            </label>
            {fastMode ? (
              <div className="student-qr-fast-action" role="group" aria-label="Action on Scan">
                <span className="student-qr-fast-action__label" id="student-qr-fast-action-label">
                  Action on Scan
                </span>
                <div className="student-qr-fast-action-segments" aria-labelledby="student-qr-fast-action-label">
                  <button
                    type="button"
                    className={`student-qr-fast-action-seg${fastAction === FAST_ACTION.mark_present ? ' student-qr-fast-action-seg--active' : ''}`}
                    disabled={!canAttendance}
                    title={!canAttendance ? 'Requires student attendance access' : ''}
                    onClick={() => {
                      if (!canAttendance) return
                      setFastAction(FAST_ACTION.mark_present)
                      persistFastAction(FAST_ACTION.mark_present)
                    }}
                  >
                    Mark Present Today
                  </button>
                  <button
                    type="button"
                    className={`student-qr-fast-action-seg${fastAction === FAST_ACTION.open_ledger ? ' student-qr-fast-action-seg--active' : ''}`}
                    disabled={!canFeeLedger}
                    title={!canFeeLedger ? 'Requires fee ledger access' : ''}
                    onClick={() => {
                      if (!canFeeLedger) return
                      setFastAction(FAST_ACTION.open_ledger)
                      persistFastAction(FAST_ACTION.open_ledger)
                    }}
                  >
                    Open Financial Ledger
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        {phase === 'scan' ? (
          <>
            <div className="student-qr-scanner-view-wrap">
              {fastOverlay ? (
                fastOverlay.type === 'error' ? (
                  <div className="student-qr-fast-banner student-qr-fast-banner--error" role="alert">
                    {fastOverlay.message}
                  </div>
                ) : (
                  <div
                    className={`student-qr-fast-toast student-qr-fast-toast--success${
                      fastOverlay.leaving ? ' student-qr-fast-toast--leaving' : ''
                    }`}
                    role="status"
                  >
                    {fastOverlay.message}
                  </div>
                )
              ) : null}
              <div className="student-qr-scanner-bracket" aria-hidden />
              <div id={SCANNER_REGION_ID} />
            </div>
            <p className="student-qr-scanner-hint">Point at a learner QR from the fee ledger roster.</p>
            {scanError ? <p className="student-qr-scanner-error">{scanError}</p> : null}
          </>
        ) : (
          <div className="student-qr-scanner-actions-panel">
            <h3>{String(studentRecord?.legal_name || 'Student')}</h3>
            <p className="sub">
              Admission no. <strong>{String(studentRecord?.student_number || '—')}</strong>
            </p>
            <div className="student-qr-scanner-action-btns">
              <button type="button" disabled={!canFeeLedger} onClick={() => void goFeeLedger()} title={!canFeeLedger ? 'Requires fee ledger access' : ''}>
                💰 Financial Ledger
              </button>
              <button
                type="button"
                disabled={!canAttendance}
                onClick={() => void goAttendance()}
                title={!canAttendance ? 'Requires student attendance access' : ''}
              >
                📝 Attendance Record
              </button>
              <button type="button" disabled={!canCbc} onClick={() => void goCbc()} title={!canCbc ? 'Requires CBC grading access' : ''}>
                📊 CBC Progress Report
              </button>
            </div>
            <button type="button" className="student-qr-scanner-cancel" onClick={handleBackToScan}>
              Scan another
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Toolbar entry: opens student QR scanner when permitted (fee ledger or student attendance).
 */
export function StudentQrScanToolbarButton() {
  const { user } = useAuth()
  const { currentCompany } = useCompany()
  const companyId = currentCompany?.$id
  const [open, setOpen] = useState(false)

  const canUse =
    isLocalDataSource() &&
    !!companyId &&
    !!user &&
    (hasPermission(user, 'fee_ledger') || hasPermission(user, 'school_attendance'))

  if (!canUse) return null

  return (
    <>
      <button type="button" className="school-toolbar-scan-student-btn" onClick={() => setOpen(true)}>
        📷 Scan Student ID
      </button>
      {open ? <StudentQrScannerModal companyId={companyId} user={user} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

export default StudentQrScanToolbarButton
