import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { isLocalDataSource } from '../config/dataSource'
import { dispatchSystemSettingsUpdated } from '../utils/companySettingsEvents'
import {
  fetchSubscriptionStatus,
  updateSubscription,
  updateSessionSettings,
  activateSubscriptionLicense,
  fetchBackupSchedule,
  saveBackupSchedule,
  downloadBackup,
  uploadRestore
} from '../services/systemMaintenanceService'
import './SystemMaintenance.css'

const PLANS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly (3 months)' },
  { value: 'yearly', label: 'Yearly' }
]

const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
]

const SystemMaintenance = () => {
  const { logout } = useAuth()
  const [status, setStatus] = useState(null)
  const [plan, setPlan] = useState('monthly')
  const [periodStart, setPeriodStart] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [backupPassword, setBackupPassword] = useState('')
  const [backupPassword2, setBackupPassword2] = useState('')
  const [restorePassword, setRestorePassword] = useState('')

  const [schedEnabled, setSchedEnabled] = useState(false)
  const [schedDay, setSchedDay] = useState(1)
  const [schedTime, setSchedTime] = useState('02:00')
  const [schedPassword, setSchedPassword] = useState('')
  const [schedOutputDir, setSchedOutputDir] = useState('')
  const [schedHasPassword, setSchedHasPassword] = useState(false)
  const [schedSaving, setSchedSaving] = useState(false)
  const [sessionAutoLogout, setSessionAutoLogout] = useState('0')
  const [sessionSaving, setSessionSaving] = useState(false)

  const [licenseToken, setLicenseToken] = useState('')
  const [licenseActivating, setLicenseActivating] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const s = await fetchSubscriptionStatus()
      setStatus(s)
      if (s && typeof s.autoLogoutMinutes === 'number') {
        setSessionAutoLogout(String(s.autoLogoutMinutes))
      } else {
        setSessionAutoLogout('0')
      }
      if (s.plan) setPlan(s.plan)
      try {
        const sch = await fetchBackupSchedule()
        setSchedEnabled(!!sch.enabled)
        setSchedDay(Number.isInteger(sch.dayOfWeek) ? sch.dayOfWeek : 1)
        setSchedTime(sch.time || '02:00')
        setSchedOutputDir(sch.outputDir || '')
        setSchedHasPassword(!!sch.hasPassword)
      } catch {
        /* schedule API may fail if not super admin / old server */
      }
    } catch (e) {
      toast.error(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleSaveSession = async (e) => {
    e.preventDefault()
    const n = parseInt(String(sessionAutoLogout).trim(), 10)
    if (!Number.isFinite(n) || n < 0 || n > 10080) {
      toast.error('Enter a value between 0 and 10,080 minutes (7 days), or 0 to disable')
      return
    }
    try {
      setSessionSaving(true)
      await updateSessionSettings(n)
      dispatchSystemSettingsUpdated()
      toast.success('Automatic logout setting saved')
      await load()
    } catch (err) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSessionSaving(false)
    }
  }

  const handleCopyDeploymentId = async () => {
    const id = status?.deploymentId
    if (!id) return
    try {
      await navigator.clipboard.writeText(id)
      toast.success('Deployment ID copied')
    } catch {
      toast.error('Could not copy — select and copy manually')
    }
  }

  const handleActivateLicense = async (e) => {
    e.preventDefault()
    const raw = licenseToken.trim()
    if (!raw) {
      toast.error('Paste the license token from Dropsoft')
      return
    }
    try {
      setLicenseActivating(true)
      await activateSubscriptionLicense(raw)
      setLicenseToken('')
      toast.success('License activated — subscription updated')
      await load()
    } catch (err) {
      toast.error(err.message || 'Activation failed')
    } finally {
      setLicenseActivating(false)
    }
  }

  const handleSaveSubscription = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      await updateSubscription(
        plan,
        periodStart ? new Date(periodStart).toISOString() : undefined
      )
      toast.success('Subscription period updated')
      setPeriodStart('')
      await load()
    } catch (err) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = async (e) => {
    e?.preventDefault?.()
    if (backupPassword.length < 8) {
      toast.error('Backup password must be at least 8 characters')
      return
    }
    if (backupPassword !== backupPassword2) {
      toast.error('Passwords do not match')
      return
    }
    try {
      await downloadBackup(backupPassword)
      toast.success('Encrypted backup download started')
      setBackupPassword('')
      setBackupPassword2('')
    } catch (err) {
      toast.error(err.message || 'Download failed')
    }
  }

  const handleSaveSchedule = async (e) => {
    e.preventDefault()
    if (schedEnabled && !schedHasPassword && schedPassword.length < 8) {
      toast.error('Set an encryption password (min 8 characters) for automatic backups, or disable the schedule')
      return
    }
    if (schedPassword && schedPassword.length > 0 && schedPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    try {
      setSchedSaving(true)
      const payload = {
        enabled: schedEnabled,
        dayOfWeek: schedDay,
        time: schedTime,
        outputDir: schedOutputDir.trim() || undefined
      }
      if (schedPassword.trim()) {
        payload.password = schedPassword.trim()
      }
      const out = await saveBackupSchedule(payload)
      setSchedHasPassword(!!out.hasPassword)
      setSchedPassword('')
      toast.success('Automatic backup settings saved')
    } catch (err) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSchedSaving(false)
    }
  }

  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const lower = file.name.toLowerCase()
    const isEncryptedName = lower.endsWith('.dhrbackup')
    const isLegacyZip = lower.endsWith('.zip')
    if (!isEncryptedName && !isLegacyZip) {
      toast.error('Choose a .dhrbackup (encrypted) or legacy .zip backup')
      return
    }
    if (isEncryptedName && restorePassword.length < 8) {
      toast.error('Enter the backup password (min 8 characters) to decrypt this file')
      return
    }
    try {
      setRestoring(true)
      const res = await uploadRestore(file, restorePassword)
      toast.success(res.message || 'Restore scheduled — restart the app to finish.')
      setRestorePassword('')
    } catch (err) {
      toast.error(err.message || 'Restore failed')
    } finally {
      setRestoring(false)
    }
  }

  if (loading) {
    return (
      <div className="system-maint">
        <p>Loading…</p>
      </div>
    )
  }

  return (
    <div className="system-maint">
      <div className="system-maint__head">
        <h1>System maintenance</h1>
        <button
          type="button"
          className="system-maint__logout"
          onClick={() => logout()}
        >
          Logout
        </button>
      </div>
      <p className="system-maint-lead">
        Super admin only — subscription billing period and full data backup / restore (local database).
      </p>

      {isLocalDataSource() && (
        <section className="system-maint-card">
          <h2>Automatic logout (this PC / server)</h2>
          <p className="system-maint-hint">
            After this many minutes of no keyboard, mouse, or scroll activity, users are signed out. Use{' '}
            <strong>0</strong> to turn automatic logout off. This applies to this installation (all companies).
            Maximum <strong>10,080</strong> minutes (7 days).
          </p>
          <form onSubmit={handleSaveSession} className="system-maint-form">
            <label>
              Minutes of inactivity before logout
              <input
                type="number"
                min="0"
                max="10080"
                step="1"
                value={sessionAutoLogout}
                onChange={(e) => setSessionAutoLogout(e.target.value)}
              />
            </label>
            <button type="submit" disabled={sessionSaving} className="system-maint-btn primary">
              {sessionSaving ? 'Saving…' : 'Save auto-logout'}
            </button>
          </form>
        </section>
      )}

      {isLocalDataSource() && (
        <section className="system-maint-card">
          <h2>LAN license activation</h2>
          <p className="system-maint-hint">
            This installation is identified by a <strong>Deployment ID</strong>. Send that ID to Dropsoft when you
            purchase or renew. You will receive a single-line license token (<code>DHR1…</code>). Paste it below to
            activate — no internet required.
          </p>
          {status?.deploymentId && (
            <div className="system-maint-deployment">
              <label>
                Deployment ID (send this to Dropsoft for licensing)
                <div className="system-maint-deployment-row">
                  <input type="text" readOnly value={status.deploymentId} className="system-maint-deployment-input" />
                  <button type="button" className="system-maint-btn" onClick={handleCopyDeploymentId}>
                    Copy
                  </button>
                </div>
              </label>
            </div>
          )}
          <form onSubmit={handleActivateLicense} className="system-maint-form">
            <label>
              License token
              <textarea
                rows={4}
                value={licenseToken}
                onChange={(e) => setLicenseToken(e.target.value)}
                placeholder="DHR1.…"
                className="system-maint-license-textarea"
                spellCheck={false}
              />
            </label>
            <button type="submit" disabled={licenseActivating} className="system-maint-btn primary">
              {licenseActivating ? 'Activating…' : 'Activate license'}
            </button>
          </form>
        </section>
      )}

      <section className="system-maint-card">
        <h2>Subscription period {isLocalDataSource() && '(manual — support only)'}</h2>
        <p className="system-maint-hint">
          {isLocalDataSource()
            ? 'Normally use LAN license activation above. Manual dates are for emergencies or internal testing.'
            : 'Choose how long the organisation may use this installation. The period starts from the date you set (defaults to today).'}
        </p>
        {status && (
          <div className="system-maint-status">
            <div>
              <strong>Current plan:</strong> {status.plan || '—'}
            </div>
            <div>
              <strong>Active:</strong> {status.active ? 'Yes' : 'No'}
            </div>
            <div>
              <strong>Period ends:</strong>{' '}
              {status.periodEnd ? new Date(status.periodEnd).toLocaleString() : '—'}
            </div>
            {status.daysRemaining != null && (
              <div>
                <strong>Days remaining:</strong> {status.daysRemaining}
              </div>
            )}
          </div>
        )}
        <form onSubmit={handleSaveSubscription} className="system-maint-form">
          <label>
            Billing period
            <select value={plan} onChange={(e) => setPlan(e.target.value)}>
              {PLANS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Period starts (optional)
            <input
              type="datetime-local"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              placeholder="Leave empty for now"
            />
          </label>
          <button type="submit" disabled={saving} className="system-maint-btn primary">
            {saving ? 'Saving…' : 'Apply new period'}
          </button>
        </form>
      </section>

      <section className="system-maint-card">
        <h2>Automatic backup (schedule)</h2>
        <p className="system-maint-hint">
          While Dropsoft HR is running, the app can write an encrypted <code>.dhrbackup</code> each week at the day and
          time you choose (this PC&apos;s local clock). Leave the app open or ensure it runs in the background at that
          time. Default folder is <code>…\DropsoftHR\backups</code> under your profile unless you set a custom path.
        </p>
        <form className="system-maint-form" onSubmit={handleSaveSchedule}>
          <label className="system-maint-checkbox">
            <input
              type="checkbox"
              checked={schedEnabled}
              onChange={(e) => setSchedEnabled(e.target.checked)}
            />{' '}
            Enable weekly automatic backup
          </label>
          <label>
            Day of week
            <select value={schedDay} onChange={(e) => setSchedDay(parseInt(e.target.value, 10))}>
              {WEEKDAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Time (local)
            <input
              type="time"
              value={schedTime}
              onChange={(e) => setSchedTime(e.target.value)}
            />
          </label>
          <label>
            Encryption password {schedHasPassword && '(leave blank to keep existing)'}
            <input
              type="password"
              autoComplete="new-password"
              value={schedPassword}
              onChange={(e) => setSchedPassword(e.target.value)}
              placeholder={schedHasPassword ? '••••••••' : 'Min 8 characters'}
            />
          </label>
          <label>
            Save backups to folder (optional)
            <input
              type="text"
              value={schedOutputDir}
              onChange={(e) => setSchedOutputDir(e.target.value)}
              placeholder="e.g. D:\HR-Backups (empty = default backups folder)"
            />
          </label>
          <button type="submit" disabled={schedSaving} className="system-maint-btn primary">
            {schedSaving ? 'Saving…' : 'Save schedule'}
          </button>
        </form>
      </section>

      <section className="system-maint-card">
        <h2>Backup</h2>
        <p className="system-maint-hint">
          Downloads an <strong>encrypted</strong> file (<code>.dhrbackup</code>) containing the database (
          <code>hr.db</code>) and uploads. You must set a password — the same password is required to restore. Without
          the password the data cannot be extracted.
        </p>
        <form className="system-maint-form" onSubmit={handleDownload}>
          <label>
            Backup password (min 8 characters)
            <input
              type="password"
              autoComplete="new-password"
              value={backupPassword}
              onChange={(e) => setBackupPassword(e.target.value)}
              placeholder="Choose a strong password"
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              value={backupPassword2}
              onChange={(e) => setBackupPassword2(e.target.value)}
              placeholder="Re-enter password"
            />
          </label>
          <button type="submit" className="system-maint-btn">
            Download encrypted backup (.dhrbackup)
          </button>
        </form>
      </section>

      <section className="system-maint-card">
        <h2>Restore</h2>
        <p className="system-maint-hint">
          Upload an encrypted <code>.dhrbackup</code> from this screen (enter the password you used when downloading),
          or a legacy plain <code>.zip</code> from older versions. After upload,{' '}
          <strong>close and reopen Dropsoft HR</strong> (or restart the HR API) to apply the restore. Your current
          database is copied with a timestamp before replace.
        </p>
        <label>
          Password (required for <code>.dhrbackup</code> files only)
          <input
            type="password"
            autoComplete="off"
            value={restorePassword}
            onChange={(e) => setRestorePassword(e.target.value)}
            placeholder="Leave empty for legacy .zip"
          />
        </label>
        <label className="system-maint-file" style={{ marginTop: 12, display: 'block' }}>
          <span className="system-maint-btn">{restoring ? 'Uploading…' : 'Choose backup file'}</span>
          <input
            type="file"
            accept=".dhrbackup,.zip,application/octet-stream"
            disabled={restoring}
            onChange={handleRestoreFile}
            hidden
          />
        </label>
      </section>
    </div>
  )
}

export default SystemMaintenance
