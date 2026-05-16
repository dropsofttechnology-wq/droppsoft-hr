import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import toast from 'react-hot-toast'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import { isLocalDataSource } from '../config/dataSource'
import * as cbcApi from '../services/schoolCbcGradingService'
import * as feeApi from '../services/schoolFeeLedgerService'
import { cbcLevelMeta } from '../utils/cbcPerformanceLevels'
import { hasPermission } from '../utils/permissions'
import './SchoolCbc.css'

const emptyMailForm = () => ({
  host: '',
  port: '587',
  secure: false,
  auth_user: '',
  auth_pass: '',
  sender_name: '',
  sender_email: ''
})

const initialModal = () => ({
  open: false,
  phase: 'idle',
  current: 0,
  total: 0,
  successCount: 0,
  skippedCount: 0,
  failures: []
})

export default function SchoolCbcReport() {
  const { currentCompany } = useCompany()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const companyId = currentCompany?.$id
  const canConfigureSchoolMail = !!user && hasPermission(user, 'cbc_grading')
  const deepLinkStudentRef = useRef('')
  const [years, setYears] = useState([])
  const [terms, setTerms] = useState([])
  const [students, setStudents] = useState([])
  const [yearId, setYearId] = useState('')
  const [termId, setTermId] = useState('')
  const [classId, setClassId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [transcript, setTranscript] = useState(null)
  const [loading, setLoading] = useState(false)
  const [emailStatus, setEmailStatus] = useState({})
  const [sendingEmail, setSendingEmail] = useState(false)
  const [bulkModal, setBulkModal] = useState(initialModal)
  const [mailPanelOpen, setMailPanelOpen] = useState(false)
  const [mailForm, setMailForm] = useState(emptyMailForm)
  const [mailAuthPassSet, setMailAuthPassSet] = useState(false)
  const [mailPasswordDirty, setMailPasswordDirty] = useState(false)
  const [mailSettingsLoading, setMailSettingsLoading] = useState(false)
  const [mailSettingsSaving, setMailSettingsSaving] = useState(false)
  const [mailSettingsResetting, setMailSettingsResetting] = useState(false)

  const classOptions = useMemo(() => {
    const set = new Set()
    for (const s of students) {
      const c = String(s.class_label || '').trim()
      if (c) set.add(c)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [students])

  const studentsInClass = useMemo(() => {
    if (!classId) return students
    return students.filter((s) => String(s.class_label || '').trim() === classId)
  }, [students, classId])

  const studentsById = useMemo(() => {
    const m = new Map()
    for (const s of students) m.set(s.$id, s)
    return m
  }, [students])

  useEffect(() => {
    deepLinkStudentRef.current = ''
  }, [companyId])

  useEffect(() => {
    const sid = searchParams.get('student_id')?.trim() || ''
    const classFromUrl = searchParams.get('class_id')?.trim() || ''
    if (!sid) {
      deepLinkStudentRef.current = ''
      return
    }
    if (!students.length) return
    if (deepLinkStudentRef.current === sid) return
    const st = students.find((s) => String(s.$id) === String(sid))
    if (!st) {
      toast.error('Student not found for this link.')
      deepLinkStudentRef.current = sid
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.delete('student_id')
          p.delete('class_id')
          return p
        },
        { replace: true }
      )
      return
    }
    deepLinkStudentRef.current = sid
    const cls = classFromUrl || String(st.class_label || '').trim()
    if (cls) setClassId(cls)
    setStudentId(st.$id)
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.delete('student_id')
        p.delete('class_id')
        return p
      },
      { replace: true }
    )
  }, [searchParams, students, setSearchParams])

  useEffect(() => {
    if (!companyId || !isLocalDataSource()) return
    Promise.all([feeApi.getAcademicYears(companyId), feeApi.getStudents(companyId)])
      .then(([y, st]) => {
        setYears(y)
        setStudents(st.filter((s) => s.status === 'active'))
      })
      .catch((e) => toast.error(e.message || 'Failed to load data'))
  }, [companyId])

  useEffect(() => {
    if (!companyId || !yearId) {
      setTerms([])
      return
    }
    feeApi.getAcademicTerms(companyId, yearId).then(setTerms).catch(() => setTerms([]))
  }, [companyId, yearId])

  const loadEmailStatus = useCallback(async () => {
    if (!companyId || !yearId || !termId) {
      setEmailStatus({})
      return
    }
    try {
      const data = await cbcApi.getCbcTranscriptEmailStatus(companyId, {
        academicYearId: yearId,
        termId,
        classId: classId || undefined
      })
      const map = {}
      for (const row of data.sent || []) {
        map[row.student_id] = row
      }
      setEmailStatus(map)
    } catch {
      setEmailStatus({})
    }
  }, [companyId, yearId, termId, classId])

  useEffect(() => {
    loadEmailStatus()
  }, [loadEmailStatus])

  const loadTranscript = useCallback(async () => {
    if (!companyId || !studentId || !yearId || !termId) {
      setTranscript(null)
      return
    }
    try {
      setLoading(true)
      const data = await cbcApi.getCbcTranscript(companyId, {
        studentId,
        academicYearId: yearId,
        termId
      })
      setTranscript(data?.success ? data : null)
    } catch (e) {
      toast.error(e.message || 'Failed to load report')
      setTranscript(null)
    } finally {
      setLoading(false)
    }
  }, [companyId, studentId, yearId, termId])

  useEffect(() => {
    loadTranscript()
  }, [loadTranscript])

  const mailFormLocked = mailSettingsLoading || mailSettingsSaving || mailSettingsResetting
  const mailConfigureToggleLocked = mailSettingsSaving || mailSettingsResetting

  const applyMailSettingsToForm = useCallback((data) => {
    const s = data?.settings || data || {}
    setMailForm({
      host: s.host != null ? String(s.host) : '',
      port: String(s.port != null ? s.port : 587),
      secure: !!(s.secure === true || s.secure === 1),
      auth_user: s.auth_user != null ? String(s.auth_user) : '',
      auth_pass: '',
      sender_name: s.sender_name != null ? String(s.sender_name) : '',
      sender_email: s.sender_email != null ? String(s.sender_email) : ''
    })
    setMailAuthPassSet(!!s.auth_pass_set)
    setMailPasswordDirty(false)
  }, [])

  const fetchSchoolMailSettings = useCallback(async () => {
    if (!companyId || !canConfigureSchoolMail) return
    setMailSettingsLoading(true)
    try {
      const res = await cbcApi.getSchoolCbcEmailSettings(companyId)
      applyMailSettingsToForm(res)
    } catch (e) {
      toast.error(e.message || 'Failed to load school mail settings')
    } finally {
      setMailSettingsLoading(false)
    }
  }, [companyId, canConfigureSchoolMail, applyMailSettingsToForm])

  useEffect(() => {
    if (mailPanelOpen && companyId && canConfigureSchoolMail) {
      fetchSchoolMailSettings()
    }
  }, [mailPanelOpen, companyId, canConfigureSchoolMail, fetchSchoolMailSettings])

  const toggleMailPanel = () => {
    if (!canConfigureSchoolMail) return
    setMailPanelOpen((o) => !o)
  }

  const handleSaveMailSettings = async (e) => {
    e.preventDefault()
    if (!companyId || !canConfigureSchoolMail || mailFormLocked) return
    const host = String(mailForm.host || '').trim()
    if (!host) {
      toast.error('SMTP host is required to save school mail, or use Reset to defaults.')
      return
    }
    setMailSettingsSaving(true)
    try {
      const payload = {
        host,
        port: Math.max(1, parseInt(String(mailForm.port), 10) || 587),
        secure: !!mailForm.secure,
        auth_user: String(mailForm.auth_user || '').trim(),
        sender_name: String(mailForm.sender_name || '').trim(),
        sender_email: String(mailForm.sender_email || '').trim()
      }
      if (mailPasswordDirty) {
        payload.auth_pass = mailForm.auth_pass
      }
      await cbcApi.putSchoolCbcEmailSettings(companyId, payload)
      toast.success('School mail settings saved.')
      await fetchSchoolMailSettings()
    } catch (err) {
      toast.error(err.message || 'Failed to save settings')
    } finally {
      setMailSettingsSaving(false)
    }
  }

  const handleResetMailToDefaults = async () => {
    if (!companyId || !canConfigureSchoolMail || mailFormLocked) return
    if (
      !window.confirm(
        'Remove school-specific SMTP? Progress report emails will use global HR / payslip mail settings until you configure again.'
      )
    ) {
      return
    }
    setMailSettingsResetting(true)
    try {
      await cbcApi.putSchoolCbcEmailSettings(companyId, { host: '' })
      toast.success('School mail cleared. Using global mail configuration.')
      await fetchSchoolMailSettings()
    } catch (err) {
      toast.error(err.message || 'Failed to reset settings')
    } finally {
      setMailSettingsResetting(false)
    }
  }

  const handlePrint = () => window.print()

  const handleEmailParent = async (force = false) => {
    if (!companyId || !studentId || !yearId || !termId) return
    try {
      setSendingEmail(true)
      const result = await cbcApi.emailCbcTranscripts(companyId, {
        student_ids: [studentId],
        academic_year_id: yearId,
        term_id: termId,
        force
      })
      if (result.skippedCount > 0 && result.successCount === 0 && (!result.failures || result.failures.length === 0)) {
        toast('Report was already emailed for this term.', { icon: 'ℹ️' })
      } else if (result.failures?.length) {
        toast.error(result.failures[0].error || 'Failed to send email')
      } else {
        toast.success('Progress report emailed to parent/guardian.')
      }
      await loadEmailStatus()
    } catch (e) {
      toast.error(e.message || 'Failed to send email')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleBulkEmailAll = async () => {
    if (!companyId || !yearId || !termId || !classId) {
      toast.error('Select academic year, term, and class to email all parents in that class.')
      return
    }
    const roster = studentsInClass
    if (!roster.length) {
      toast.error('No students in this class.')
      return
    }
    if (
      !window.confirm(
        `Email CBC progress reports (PDF) to parents for ${roster.length} student(s) in ${classId}? This runs one send at a time and may take a few minutes.`
      )
    ) {
      return
    }

    const ids = roster.map((s) => s.$id)
    setBulkModal({
      open: true,
      phase: 'sending',
      current: 0,
      total: ids.length,
      successCount: 0,
      skippedCount: 0,
      failures: []
    })

    let successCount = 0
    let skippedCount = 0
    const failures = []

    for (let i = 0; i < ids.length; i++) {
      const sid = ids[i]
      setBulkModal((m) => ({ ...m, current: i + 1 }))
      try {
        const result = await cbcApi.emailCbcTranscripts(companyId, {
          student_ids: [sid],
          academic_year_id: yearId,
          term_id: termId,
          force: false
        })
        successCount += result.successCount || 0
        skippedCount += result.skippedCount || 0
        if (result.failures?.length) failures.push(...result.failures)
      } catch (e) {
        failures.push({ studentId: sid, error: e.message || 'Request failed' })
      }
    }

    await loadEmailStatus()
    setBulkModal({
      open: true,
      phase: 'done',
      current: ids.length,
      total: ids.length,
      successCount,
      skippedCount,
      failures
    })
  }

  const closeBulkModal = () => setBulkModal(initialModal)

  if (!isLocalDataSource()) {
    return <p className="page-description">CBC reports require the local API.</p>
  }

  const yearLabel = years.find((y) => y.$id === yearId)?.label || ''
  const termLabel = terms.find((t) => t.$id === termId)?.name || ''
  const currentSent = emailStatus[studentId]
  const selectedStudent = students.find((s) => s.$id === studentId)
  const bulkBusy = bulkModal.open && bulkModal.phase === 'sending'

  return (
    <div>
      <div className="school-cbc-form school-cbc-no-print">
        <label>
          Academic year
          <select
            value={yearId}
            onChange={(e) => {
              setYearId(e.target.value)
              setTermId('')
            }}
          >
            <option value="">Select…</option>
            {years.map((y) => (
              <option key={y.$id} value={y.$id}>
                {y.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Term
          <select value={termId} onChange={(e) => setTermId(e.target.value)} disabled={!yearId}>
            <option value="">Select…</option>
            {terms.map((t) => (
              <option key={t.$id} value={t.$id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Class / grade
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value)
              setStudentId('')
            }}
          >
            <option value="">All classes</option>
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Student
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Select…</option>
            {studentsInClass.map((s) => {
              const sent = emailStatus[s.$id]
              return (
                <option key={s.$id} value={s.$id}>
                  {s.student_number} — {s.legal_name}
                  {sent ? ' ✓ Sent' : ''}
                </option>
              )
            })}
          </select>
        </label>
      </div>

      <div className="school-cbc-report-actions school-cbc-no-print">
        <button type="button" className="school-cbc-btn school-cbc-btn--primary" onClick={handlePrint} disabled={!transcript}>
          Print
        </button>
        <button
          type="button"
          className="school-cbc-btn school-cbc-btn--primary"
          onClick={() => handleEmailParent(false)}
          disabled={!transcript?.learning_areas?.length || sendingEmail || bulkBusy}
        >
          {sendingEmail ? 'Sending…' : 'Email to Parent'}
        </button>
        {currentSent ? (
          <button
            type="button"
            className="school-cbc-btn school-cbc-btn--muted"
            onClick={() => handleEmailParent(true)}
            disabled={sendingEmail || bulkBusy}
            title={`Last sent ${new Date(currentSent.sent_at).toLocaleString()} to ${currentSent.recipient_email}`}
          >
            Resend
          </button>
        ) : null}
      </div>

      <div className="school-cbc-bulk-banner school-cbc-no-print">
        <div className="school-cbc-bulk-banner__toolbar">
          <p className="school-cbc-bulk-banner__label">Bulk action</p>
          <div className="school-cbc-bulk-banner__toolbar-btns">
            {canConfigureSchoolMail ? (
              <button
                type="button"
                className={`school-cbc-btn school-cbc-btn--configure ${mailPanelOpen ? 'is-open' : ''}`}
                onClick={toggleMailPanel}
                disabled={mailConfigureToggleLocked}
                aria-expanded={mailPanelOpen}
              >
                ⚙️ Configure Mail Server
              </button>
            ) : null}
            <button
              type="button"
              className="school-cbc-btn school-cbc-btn--bulk"
              onClick={handleBulkEmailAll}
              disabled={!classId || !yearId || !termId || bulkBusy || sendingEmail}
            >
              {bulkBusy ? 'Sending transcripts…' : 'Email All Transcripts to Parents'}
            </button>
          </div>
        </div>

        {canConfigureSchoolMail && mailPanelOpen ? (
          <div className="school-cbc-mail-card">
            <p className="school-cbc-mail-card__intro">
              SMTP used for CBC progress report emails for this company. Leave password unchanged unless you enter a new
              one. Clearing the saved row falls back to Settings → Payslip email / HR_SMTP_*.
            </p>
            {mailSettingsLoading ? (
              <p className="school-cbc-mail-card__loading">Loading settings…</p>
            ) : (
              <form className="school-cbc-mail-form" onSubmit={handleSaveMailSettings}>
                <div className="school-cbc-mail-form__grid">
                  <label className="school-cbc-mail-form__field">
                    <span>SMTP host</span>
                    <input
                      type="text"
                      name="host"
                      autoComplete="off"
                      placeholder="e.g. smtp.gmail.com"
                      value={mailForm.host}
                      onChange={(e) => setMailForm((f) => ({ ...f, host: e.target.value }))}
                      disabled={mailFormLocked}
                    />
                  </label>
                  <label className="school-cbc-mail-form__field school-cbc-mail-form__field--narrow">
                    <span>Port</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      name="port"
                      placeholder="587"
                      value={mailForm.port}
                      onChange={(e) => setMailForm((f) => ({ ...f, port: e.target.value }))}
                      disabled={mailFormLocked}
                    />
                  </label>
                  <label className="school-cbc-mail-form__field school-cbc-mail-form__field--check">
                    <span>Secure (SSL / TLS)</span>
                    <input
                      type="checkbox"
                      name="secure"
                      checked={mailForm.secure}
                      onChange={(e) => setMailForm((f) => ({ ...f, secure: e.target.checked }))}
                      disabled={mailFormLocked}
                    />
                  </label>
                  <label className="school-cbc-mail-form__field">
                    <span>Auth username / email</span>
                    <input
                      type="text"
                      name="auth_user"
                      autoComplete="username"
                      value={mailForm.auth_user}
                      onChange={(e) => setMailForm((f) => ({ ...f, auth_user: e.target.value }))}
                      disabled={mailFormLocked}
                    />
                  </label>
                  <label className="school-cbc-mail-form__field">
                    <span>Auth password</span>
                    <input
                      type="password"
                      name="auth_pass"
                      autoComplete="new-password"
                      placeholder={mailAuthPassSet && !mailPasswordDirty ? '••••••••' : 'SMTP password'}
                      value={mailForm.auth_pass}
                      onChange={(e) => {
                        setMailPasswordDirty(true)
                        setMailForm((f) => ({ ...f, auth_pass: e.target.value }))
                      }}
                      disabled={mailFormLocked}
                    />
                  </label>
                  <label className="school-cbc-mail-form__field">
                    <span>Sender display name</span>
                    <input
                      type="text"
                      name="sender_name"
                      placeholder='e.g. "Nakuru Academy"'
                      value={mailForm.sender_name}
                      onChange={(e) => setMailForm((f) => ({ ...f, sender_name: e.target.value }))}
                      disabled={mailFormLocked}
                    />
                  </label>
                  <label className="school-cbc-mail-form__field">
                    <span>Sender email address</span>
                    <input
                      type="email"
                      name="sender_email"
                      autoComplete="email"
                      placeholder="no-reply@school.example"
                      value={mailForm.sender_email}
                      onChange={(e) => setMailForm((f) => ({ ...f, sender_email: e.target.value }))}
                      disabled={mailFormLocked}
                    />
                  </label>
                </div>
                <div className="school-cbc-mail-form__actions">
                  <button
                    type="submit"
                    className="school-cbc-btn school-cbc-btn--primary"
                    disabled={mailFormLocked}
                  >
                    {mailSettingsSaving ? 'Saving…' : 'Save configurations'}
                  </button>
                  <button
                    type="button"
                    className="school-cbc-btn school-cbc-btn--outline"
                    onClick={handleResetMailToDefaults}
                    disabled={mailFormLocked}
                  >
                    {mailSettingsResetting ? 'Resetting…' : 'Reset to Default'}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : null}

        <p className="school-cbc-bulk-banner__hint">Select a class above, then email every learner in that class for the chosen term.</p>
      </div>

      {selectedStudent && currentSent ? (
        <p className="school-cbc-sent-badge school-cbc-no-print">
          <span className="school-cbc-sent-badge__pill">Sent</span>
          Emailed {new Date(currentSent.sent_at).toLocaleString()} to {currentSent.recipient_email}
        </p>
      ) : null}

      {loading && <p className="page-description">Loading report…</p>}

      {!loading && studentId && yearId && termId && !transcript?.learning_areas?.length ? (
        <p className="page-description">
          No CBC assessments recorded for this learner in the selected term. Use the Assessments tab to enter
          ratings.
        </p>
      ) : null}

      {transcript?.learning_areas?.length > 0 ? (
        <article className="school-cbc-transcript">
          <h2>Learner&apos;s Progress Report</h2>
          <p className="school-cbc-transcript-sub">
            {transcript.legal_name} · {transcript.student_number} · {transcript.class_label || '—'}
            <br />
            {yearLabel} — {termLabel}
          </p>
          <p style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>
            Kenyan CBC scale: EE (4) · ME (3) · AE (2) · BE (1)
          </p>
          {transcript.learning_areas.map((area) => (
            <section key={area.subject_id} className="school-cbc-transcript-area">
              <h3>
                {area.subject_name}
                {area.average_level != null ? ` · avg level ${area.average_level}` : ''}
              </h3>
              <table className="school-cbc-table">
                <thead>
                  <tr>
                    <th>Strand</th>
                    <th>Level</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {area.strands.map((st, i) => {
                    const meta = cbcLevelMeta(st.performance_level)
                    return (
                      <tr key={`${st.strand_name}-${i}`}>
                        <td>{st.strand_name}</td>
                        <td>
                          {meta ? `${meta.abbreviation} (${st.performance_level})` : st.performance_level}
                        </td>
                        <td>{st.teacher_remarks?.trim() || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </article>
      ) : null}

      {bulkModal.open ? (
        <div className="school-cbc-modal-root" role="dialog" aria-modal="true" aria-labelledby="cbc-email-modal-title">
          <div className="school-cbc-modal-backdrop" />
          <div className="school-cbc-modal">
            <h2 id="cbc-email-modal-title" className="school-cbc-modal__title">
              {bulkModal.phase === 'sending' ? 'Emailing progress reports' : 'Bulk send finished'}
            </h2>
            {bulkModal.phase === 'sending' ? (
              <>
                <p className="school-cbc-modal__progress">
                  Sending {bulkModal.current} of {bulkModal.total} transcripts…
                </p>
                <p className="school-cbc-modal__warn">Please do not close the app until this finishes.</p>
                <div className="school-cbc-modal__bar">
                  <div
                    className="school-cbc-modal__bar-fill"
                    style={{
                      width: bulkModal.total ? `${Math.round((100 * bulkModal.current) / bulkModal.total)}%` : '0%'
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <ul className="school-cbc-modal__summary">
                  <li>
                    <strong>{bulkModal.successCount}</strong> sent successfully
                  </li>
                  {bulkModal.skippedCount > 0 ? (
                    <li>
                      <strong>{bulkModal.skippedCount}</strong> skipped (already emailed this term)
                    </li>
                  ) : null}
                  {bulkModal.failures.length > 0 ? (
                    <li className="school-cbc-modal__summary--bad">
                      <strong>{bulkModal.failures.length}</strong> failed
                    </li>
                  ) : null}
                </ul>
                {bulkModal.failures.length > 0 ? (
                  <div className="school-cbc-modal__failures">
                    <p className="school-cbc-modal__failures-title">Failed sends</p>
                    <ul>
                      {bulkModal.failures.map((f) => {
                        const st = studentsById.get(f.studentId)
                        const label = st ? `${st.student_number} — ${st.legal_name}` : f.studentId
                        return (
                          <li key={`${f.studentId}-${f.error}`}>
                            <span className="school-cbc-modal__fail-student">{label}</span>
                            <span className="school-cbc-modal__fail-msg">{f.error}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : null}
                <button type="button" className="school-cbc-btn school-cbc-btn--primary school-cbc-modal__close" onClick={closeBulkModal}>
                  OK
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
