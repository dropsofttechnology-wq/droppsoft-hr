import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import { isLocalDataSource } from '../config/dataSource'
import { getCompanySettings, saveCompanySettingsBulk, testCompanySmtpConnection } from '../utils/settingsHelper'
import { dispatchCompanySettingsUpdated } from '../utils/companySettingsEvents'
import './Settings.css'

/** Keys persisted for the Settings page (must match state fields below). */
const SETTINGS_PAGE_KEYS = [
  'pay_date',
  'standard_allowance',
  'housing_allowance',
  'housing_allowance_type',
  'overtime_rate',
  'overtime_rate_type',
  'shif_rate',
  'shif_minimum',
  'nssf_tier1_limit',
  'nssf_tier2_limit',
  'ahl_rate',
  'personal_relief',
  'working_hours',
  'official_reporting_time',
  'reporting_grace_minutes',
  'clock_in_earliest',
  'clock_in_latest',
  'clock_out_earliest',
  'clock_out_latest',
  'minimum_time_gap',
  'require_geolocation',
  'face_min_brightness',
  'face_max_brightness',
  'face_min_contrast',
  'face_min_sharpness',
  'face_min_coverage',
  'face_max_coverage',
  'face_max_angle',
  'face_detection_confidence',
  'face_detection_throttle_ms',
  'face_matching_threshold',
  'face_matching_min_confidence',
  'smtp_host',
  'smtp_port',
  'smtp_secure',
  'smtp_user',
  'smtp_pass',
  'smtp_from',
  'email_payslips_on_save',
  'annual_leave_rollover',
  'pdf_letterhead_logo_enabled',
  'pdf_watermark_opacity',
  'pdf_payslip_watermark_opacity'
]

/** Appwrite cloud only — local install uses System maintenance for auto-logout. */
const CLOUD_AUTO_LOGOUT_KEYS = ['auto_logout_minutes']

const normalizeEmail = (value) => String(value || '').trim().toLowerCase()

const inferSmtpDefaultsFromEmail = (email) => {
  const e = normalizeEmail(email)
  if (!e || !e.includes('@')) return null
  const domain = e.split('@')[1] || ''
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return { host: 'smtp.gmail.com', port: '587', secure: false }
  }
  if (
    domain === 'outlook.com' ||
    domain === 'hotmail.com' ||
    domain === 'live.com' ||
    domain === 'office365.com' ||
    domain.endsWith('.onmicrosoft.com')
  ) {
    return { host: 'smtp.office365.com', port: '587', secure: false }
  }
  if (domain === 'yahoo.com' || domain === 'ymail.com') {
    return { host: 'smtp.mail.yahoo.com', port: '465', secure: true }
  }
  if (domain === 'zoho.com') {
    return { host: 'smtp.zoho.com', port: '465', secure: true }
  }
  return null
}

const Settings = () => {
  const { currentCompany } = useCompany()
  const { user } = useAuth()
  const role = user?.prefs?.role || 'admin'
  const showUsersLink =
    isLocalDataSource() && (role === 'admin' || role === 'super_admin' || role === 'manager')
  const [settings, setSettings] = useState({
    // Payroll Settings
    pay_date: '25',
    standard_allowance: '0',
    housing_allowance: '0',
    housing_allowance_type: 'fixed', // 'fixed', 'percentage', or 'percentage_gross'
    overtime_rate: '0',
    overtime_rate_type: 'fixed', // 'fixed' or 'percentage'
    
    // Statutory Rates
    shif_rate: '2.75',
    shif_minimum: '300',
    nssf_tier1_limit: '7000',
    nssf_tier2_limit: '36000',
    ahl_rate: '1.5',
    personal_relief: '2400',
    
    // Attendance Settings
    working_hours: '8',
    official_reporting_time: '08:00',
    reporting_grace_minutes: '15',
    clock_in_earliest: '06:00',
    clock_in_latest: '10:00',
    clock_out_earliest: '16:00',
    clock_out_latest: '20:00',
    minimum_time_gap: '1.5',
    require_geolocation: false,

    // Face Recognition Settings
    face_min_brightness: '25',
    face_max_brightness: '95',
    face_min_contrast: '15',
    face_min_sharpness: '35',
    face_min_coverage: '12',
    face_max_coverage: '65',
    face_max_angle: '20',
    face_detection_confidence: '0.4',
    face_detection_throttle_ms: '150',
    face_matching_threshold: '0.35',
    face_matching_min_confidence: '65',

    smtp_host: '',
    smtp_port: '587',
    smtp_secure: false,
    smtp_user: '',
    smtp_pass: '',
    smtp_from: '',
    email_payslips_on_save: false,

    // Leave: when true, employees may book against current + next calendar year pool; when false, only this year's balance
    annual_leave_rollover: true,

    // Session: 0 = no automatic logout
    auto_logout_minutes: '0',

    // PDF: letterhead uses company logo from Companies; diagonal watermark always on PDFs (not CSV)
    pdf_letterhead_logo_enabled: true,
    pdf_watermark_opacity: '0.52',
    pdf_payslip_watermark_opacity: ''
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (currentCompany) {
      loadSettings()
    }
  }, [currentCompany])

  const getSettingsLoadKeys = () =>
    isLocalDataSource() ? SETTINGS_PAGE_KEYS : [...SETTINGS_PAGE_KEYS, ...CLOUD_AUTO_LOGOUT_KEYS]

  const loadSettings = async () => {
    if (!currentCompany) return

    try {
      setLoading(true)
      const keys = getSettingsLoadKeys()
      const loaded = await getCompanySettings(currentCompany.$id, keys)

      setSettings((prev) => {
        const next = { ...prev }
        for (const key of keys) {
          const v = loaded[key]
          if (v == null || v === undefined) continue
          if (
            key === 'require_geolocation' ||
            key === 'smtp_secure' ||
            key === 'email_payslips_on_save' ||
            key === 'annual_leave_rollover' ||
            key === 'pdf_letterhead_logo_enabled'
          ) {
            next[key] = v === true || v === 'true'
          } else {
            next[key] = v
          }
        }

        if (isLocalDataSource()) {
          const companyEmail = normalizeEmail(currentCompany?.email || '')
          if (!next.smtp_user && companyEmail) next.smtp_user = companyEmail
          if (!next.smtp_from && companyEmail) next.smtp_from = companyEmail

          const basisEmail = next.smtp_user || next.smtp_from || companyEmail
          const inferred = inferSmtpDefaultsFromEmail(basisEmail)
          if (inferred) {
            if (!next.smtp_host) next.smtp_host = inferred.host
            if (!next.smtp_port || String(next.smtp_port).trim() === '0') next.smtp_port = inferred.port
            if (loaded.smtp_secure == null) next.smtp_secure = inferred.secure
          }
        }
        return next
      })
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!currentCompany) return

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const keys = getSettingsLoadKeys()
      const payload = {}
      for (const k of keys) {
        if (k in settings) payload[k] = settings[k]
      }
      await saveCompanySettingsBulk(currentCompany.$id, payload)

      dispatchCompanySettingsUpdated(currentCompany.$id)
      toast.success('Settings saved successfully!')
    } catch (error) {
      toast.error('Failed to save settings: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setSettings((prev) => {
      const next = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }

      // Autofill SMTP defaults from sender mailbox where fields are missing.
      if (name === 'smtp_user' || name === 'smtp_from') {
        const basisEmail = normalizeEmail(name === 'smtp_user' ? value : next.smtp_user) ||
          normalizeEmail(name === 'smtp_from' ? value : next.smtp_from)
        const inferred = inferSmtpDefaultsFromEmail(basisEmail)
        if (inferred) {
          if (!next.smtp_host) next.smtp_host = inferred.host
          if (!next.smtp_port || String(next.smtp_port).trim() === '0') next.smtp_port = inferred.port
          if (name === 'smtp_user' && !next.smtp_from && basisEmail) next.smtp_from = basisEmail
          if (name === 'smtp_from' && !next.smtp_user && basisEmail) next.smtp_user = basisEmail
        }
      }
      return next
    })
  }

  const handlePrefillSmtpFromCompany = () => {
    const companyEmail = normalizeEmail(currentCompany?.email || '')
    if (!companyEmail || !companyEmail.includes('@')) {
      toast.error('Company email is missing or invalid. Update company email first.')
      return
    }

    setSettings((prev) => {
      const next = { ...prev }
      let changed = 0

      if (!next.smtp_user) {
        next.smtp_user = companyEmail
        changed += 1
      }
      if (!next.smtp_from) {
        next.smtp_from = companyEmail
        changed += 1
      }

      const inferred = inferSmtpDefaultsFromEmail(next.smtp_user || next.smtp_from || companyEmail)
      if (inferred) {
        if (!next.smtp_host) {
          next.smtp_host = inferred.host
          changed += 1
        }
        if (!next.smtp_port || String(next.smtp_port).trim() === '0') {
          next.smtp_port = inferred.port
          changed += 1
        }
        if (!next.smtp_secure) {
          next.smtp_secure = inferred.secure
          changed += inferred.secure ? 1 : 0
        }
      }

      if (changed > 0) {
        toast.success(`SMTP prefill applied (${changed} field${changed === 1 ? '' : 's'} updated).`)
      } else {
        toast('SMTP fields already filled. No changes made.')
      }
      return next
    })
  }

  const handleTestSmtpConnection = async () => {
    if (!currentCompany?.$id) return
    try {
      setTestingSmtp(true)
      setError('')
      const result = await testCompanySmtpConnection(currentCompany.$id)
      const cfg = result?.config || {}
      toast.success('SMTP test successful.')
      setSuccess(
        `SMTP connected: ${cfg.host || 'host'}:${cfg.port || ''} | secure=${cfg.secure ? 'yes' : 'no'} | from=${cfg.from || 'n/a'}`
      )
    } catch (e) {
      const msg = e?.message || 'SMTP test failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setTestingSmtp(false)
    }
  }

  if (!currentCompany) {
    return (
      <div className="settings-page">
        <div className="alert alert-warning">
          Please select a company first.
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="loading">Loading settings...</div>
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Company Settings</h1>
        {showUsersLink && (
          <p className="settings-users-shortcut">
            <Link to="/settings/user-roles">Users &amp; roles</Link> — add logins and assign access.
          </p>
        )}
        {isLocalDataSource() && (
          <p className="settings-users-shortcut">
            <Link to="/settings/pairing">Mobile pairing (QR)</Link> — show a QR code so the Android app can connect to this
            server.
          </p>
        )}
        <button
          className="btn-primary"
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      <div className="settings-sections">
        {/* Payroll Settings */}
        <div className="settings-section">
          <h2>Payroll Settings</h2>
          
          <div className="form-group">
            <label>Pay Date (for Projected Pay)</label>
            <input
              type="number"
              name="pay_date"
              value={settings.pay_date}
              onChange={handleInputChange}
              min="1"
              max="31"
            />
            <small>
              Day of month (e.g., 25 = pay on 25th). The day when employees are paid. 
              Actual earnings: 1st to (pay date - 1). Projected earnings: pay date to end of month.
            </small>
          </div>

          <div className="form-group">
            <label>Standard Allowance (KES)</label>
            <input
              type="number"
              name="standard_allowance"
              value={settings.standard_allowance}
              onChange={handleInputChange}
              min="0"
              step="0.01"
            />
            <small>Fixed allowance applied to all employees</small>
          </div>

          <div className="form-group">
            <label>Housing Allowance Type</label>
            <select
              name="housing_allowance_type"
              value={settings.housing_allowance_type}
              onChange={handleInputChange}
            >
              <option value="fixed">Fixed Amount</option>
              <option value="percentage">Percentage of Basic Salary</option>
              <option value="percentage_gross">Percentage of Gross Salary</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              Housing Allowance {
                settings.housing_allowance_type === 'percentage' ? '(%)' : 
                settings.housing_allowance_type === 'percentage_gross' ? '(%)' : 
                '(KES)'
              }
            </label>
            <input
              type="number"
              name="housing_allowance"
              value={settings.housing_allowance}
              onChange={handleInputChange}
              min="0"
              step={settings.housing_allowance_type === 'percentage' || settings.housing_allowance_type === 'percentage_gross' ? '0.1' : '0.01'}
            />
            <small>
              {settings.housing_allowance_type === 'percentage_gross' 
                ? 'Calculated as percentage of Gross Salary (Basic + Standard Allowance + Housing Allowance)'
                : settings.housing_allowance_type === 'percentage'
                ? 'Calculated as percentage of Basic Salary'
                : 'Fixed amount applied to all employees'}
            </small>
          </div>

          <div className="form-group">
            <label>Overtime Rate Type</label>
            <select
              name="overtime_rate_type"
              value={settings.overtime_rate_type}
              onChange={handleInputChange}
            >
              <option value="fixed">Fixed Amount per Hour</option>
              <option value="percentage">Percentage of Gross Salary</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              Overtime Rate {settings.overtime_rate_type === 'percentage' ? '(%)' : '(KES/hour)'}
            </label>
            <input
              type="number"
              name="overtime_rate"
              value={settings.overtime_rate}
              onChange={handleInputChange}
              min="0"
              step={settings.overtime_rate_type === 'percentage' ? '0.1' : '0.01'}
            />
          </div>
        </div>

        <div className="settings-section">
          <h2>PDF &amp; reports (branding)</h2>
          <p className="settings-hint" style={{ marginBottom: '1rem' }}>
            Upload or change the <strong>company logo</strong> and PDF watermark strength on the{' '}
            <Link to="/companies">Companies</Link> page (same settings apply here). All PDF exports include a diagonal
            watermark; CSV exports do not.
          </p>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                name="pdf_letterhead_logo_enabled"
                checked={settings.pdf_letterhead_logo_enabled}
                onChange={handleInputChange}
              />
              Show company logo in PDF letterhead (top of payslips, payroll list, statutory reports)
            </label>
          </div>
          <div className="form-group">
            <label>Watermark strength — payroll list &amp; reports (0.15–1.25)</label>
            <input
              type="number"
              name="pdf_watermark_opacity"
              value={settings.pdf_watermark_opacity}
              onChange={handleInputChange}
              min="0.15"
              max="1.25"
              step="0.01"
            />
            <small>Default 0.52. Higher = more visible diagonal watermark on large PDFs.</small>
          </div>
          <div className="form-group">
            <label>Payslip watermark strength (0.15–1.25)</label>
            <input
              type="number"
              name="pdf_payslip_watermark_opacity"
              value={settings.pdf_payslip_watermark_opacity}
              onChange={handleInputChange}
              min="0.15"
              max="1.25"
              step="0.01"
              placeholder="Auto"
            />
            <small>
              Individual payslips use a denser layout — use a higher value (e.g. 0.82–1.0) for a clearer stamp. Leave
              empty for automatic strength based on the general watermark setting above.
            </small>
          </div>
        </div>

        {/* Statutory Rates */}
        <div className="settings-section">
          <h2>Statutory Deduction Rates</h2>
          
          <div className="form-group">
            <label>S.H.I.F rate (%)</label>
            <input
              type="number"
              name="shif_rate"
              value={settings.shif_rate}
              onChange={handleInputChange}
              min="0"
              max="100"
              step="0.01"
            />
            <small>Default: 2.75%</small>
          </div>

          <div className="form-group">
            <label>S.H.I.F minimum (KES)</label>
            <input
              type="number"
              name="shif_minimum"
              value={settings.shif_minimum}
              onChange={handleInputChange}
              min="0"
              step="0.01"
            />
            <small>Default: 300.00</small>
          </div>

          <div className="form-group">
            <label>NSSF Tier I Limit (KES)</label>
            <input
              type="number"
              name="nssf_tier1_limit"
              value={settings.nssf_tier1_limit}
              onChange={handleInputChange}
              min="0"
              step="0.01"
            />
            <small>Default: 7,000.00</small>
          </div>

          <div className="form-group">
            <label>NSSF Tier II Upper Limit (KES)</label>
            <input
              type="number"
              name="nssf_tier2_limit"
              value={settings.nssf_tier2_limit}
              onChange={handleInputChange}
              min="0"
              step="0.01"
            />
            <small>Default: 36,000.00 (29,000 for 2025/2026)</small>
          </div>

          <div className="form-group">
            <label>AHL Rate (%)</label>
            <input
              type="number"
              name="ahl_rate"
              value={settings.ahl_rate}
              onChange={handleInputChange}
              min="0"
              max="100"
              step="0.01"
            />
            <small>Default: 1.5%</small>
          </div>

          <div className="form-group">
            <label>Personal Relief (KES)</label>
            <input
              type="number"
              name="personal_relief"
              value={settings.personal_relief}
              onChange={handleInputChange}
              min="0"
              step="0.01"
            />
            <small>Default: 2,400.00</small>
          </div>
        </div>

        {!isLocalDataSource() && (
        <div className="settings-section">
          <h2>Session &amp; security</h2>
          <div className="form-group">
            <label>Automatic logout after inactivity (minutes)</label>
            <input
              type="number"
              name="auto_logout_minutes"
              value={settings.auto_logout_minutes}
              onChange={handleInputChange}
              min="0"
              max="10080"
              step="1"
            />
            <small>
              0 = never log out automatically. When set, users are signed out after this many minutes
              of no mouse, keyboard, or scroll activity. Maximum 10,080 (7 days). Applies to this company
              for all users. On the local PC app, configure this under Settings → System maintenance.
            </small>
          </div>
        </div>
        )}

        {/* Leave */}
        <div className="settings-section">
          <h2>Leave</h2>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                name="annual_leave_rollover"
                checked={settings.annual_leave_rollover}
                onChange={handleInputChange}
              />
              Allow annual leave rollover (book using next year&apos;s entitlement)
            </label>
            <small>
              When enabled, employees can request leave up to their current-year balance plus unused next-year pool (as
              shown on the leave request form). When disabled, requests are limited to this calendar year&apos;s accrued
              balance only; unused days do not carry forward for booking purposes.
            </small>
          </div>
        </div>

        {/* Attendance Settings */}
        <div className="settings-section">
          <h2>Attendance Settings</h2>
          
          <div className="form-group">
            <label>Standard Working Hours per Day</label>
            <input
              type="number"
              name="working_hours"
              value={settings.working_hours}
              onChange={handleInputChange}
              min="1"
              max="24"
              step="0.5"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Official Reporting Time</label>
              <input
                type="time"
                name="official_reporting_time"
                value={settings.official_reporting_time}
                onChange={handleInputChange}
              />
              <small>Expected time staff should report (e.g. 08:00)</small>
            </div>
            <div className="form-group">
              <label>Reporting Grace Period (minutes)</label>
              <input
                type="number"
                name="reporting_grace_minutes"
                value={settings.reporting_grace_minutes}
                onChange={handleInputChange}
                min="0"
                max="120"
                step="1"
              />
              <small>Clock-in within this many minutes after official time still counts as on time (e.g. 15)</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Earliest Clock-In Time</label>
              <input
                type="time"
                name="clock_in_earliest"
                value={settings.clock_in_earliest}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label>Latest Clock-In Time</label>
              <input
                type="time"
                name="clock_in_latest"
                value={settings.clock_in_latest}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Earliest Clock-Out Time</label>
              <input
                type="time"
                name="clock_out_earliest"
                value={settings.clock_out_earliest}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label>Latest Clock-Out Time</label>
              <input
                type="time"
                name="clock_out_latest"
                value={settings.clock_out_latest}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Minimum Time Gap Between Clock-Ins (seconds)</label>
            <input
              type="number"
              name="minimum_time_gap"
              value={settings.minimum_time_gap}
              onChange={handleInputChange}
              min="0"
              step="0.1"
            />
            <small>Prevents duplicate clock-ins</small>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                name="require_geolocation"
                checked={settings.require_geolocation}
                onChange={handleInputChange}
              />
              Require Geolocation for Attendance
            </label>
            <small>Employees must enable location services to clock in/out</small>
          </div>
        </div>

        {/* Face Recognition Settings */}
        <div className="settings-section">
          <h2>Face Recognition Settings</h2>
          <p className="settings-section-desc">
            Adjust these to make face enrollment and attendance less or more strict. Lower values = more lenient.
          </p>

          <h3>Quality Thresholds (Enrollment)</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Min Brightness (%)</label>
              <input
                type="number"
                name="face_min_brightness"
                value={settings.face_min_brightness}
                onChange={handleInputChange}
                min="0"
                max="100"
              />
              <small>Default: 25. Lower = darker images allowed</small>
            </div>
            <div className="form-group">
              <label>Max Brightness (%)</label>
              <input
                type="number"
                name="face_max_brightness"
                value={settings.face_max_brightness}
                onChange={handleInputChange}
                min="0"
                max="100"
              />
              <small>Default: 95. Higher = brighter images allowed</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Min Contrast</label>
              <input
                type="number"
                name="face_min_contrast"
                value={settings.face_min_contrast}
                onChange={handleInputChange}
                min="0"
                max="100"
              />
              <small>Default: 15. Lower = less contrast required</small>
            </div>
            <div className="form-group">
              <label>Min Sharpness</label>
              <input
                type="number"
                name="face_min_sharpness"
                value={settings.face_min_sharpness}
                onChange={handleInputChange}
                min="0"
                max="200"
              />
              <small>Default: 35. Lower = blurrier images allowed</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Min Face Size (%)</label>
              <input
                type="number"
                name="face_min_coverage"
                value={settings.face_min_coverage}
                onChange={handleInputChange}
                min="5"
                max="80"
              />
              <small>Default: 12. % of frame. Lower = smaller faces OK</small>
            </div>
            <div className="form-group">
              <label>Max Face Size (%)</label>
              <input
                type="number"
                name="face_max_coverage"
                value={settings.face_max_coverage}
                onChange={handleInputChange}
                min="10"
                max="90"
              />
              <small>Default: 65. Higher = larger faces OK</small>
            </div>
          </div>

          <div className="form-group">
            <label>Max Face Angle (°)</label>
            <input
              type="number"
              name="face_max_angle"
              value={settings.face_max_angle}
              onChange={handleInputChange}
              min="5"
              max="45"
            />
            <small>Default: 20. Higher = more head tilt allowed</small>
          </div>

          <h3>Detection</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Detection Confidence (0–1)</label>
              <input
                type="number"
                name="face_detection_confidence"
                value={settings.face_detection_confidence}
                onChange={handleInputChange}
                min="0.1"
                max="0.9"
                step="0.05"
              />
              <small>Default: 0.4. Lower = detect more faces (may be less accurate)</small>
            </div>
            <div className="form-group">
              <label>Detection Interval (ms)</label>
              <input
                type="number"
                name="face_detection_throttle_ms"
                value={settings.face_detection_throttle_ms}
                onChange={handleInputChange}
                min="50"
                max="500"
              />
              <small>Default: 150. Lower = faster but more CPU</small>
            </div>
          </div>

          <h3>Attendance Matching</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Matching Threshold (0–1)</label>
              <input
                type="number"
                name="face_matching_threshold"
                value={settings.face_matching_threshold}
                onChange={handleInputChange}
                min="0.2"
                max="0.6"
                step="0.05"
              />
              <small>Default: 0.35. Higher = looser match (more false positives)</small>
            </div>
            <div className="form-group">
              <label>Min Match Confidence (%)</label>
              <input
                type="number"
                name="face_matching_min_confidence"
                value={settings.face_matching_min_confidence}
                onChange={handleInputChange}
                min="50"
                max="95"
              />
              <small>Default: 65. Lower = easier to match</small>
            </div>
          </div>
        </div>

        {isLocalDataSource() && (
          <div className="settings-section">
            <h2>Payslip email (SMTP)</h2>
            <p className="settings-section-desc">
              Configure outgoing mail so payslips can be sent as PDF attachments to each employee&apos;s{' '}
              <strong>work email</strong> (field on the employee profile). You can also enable automatic sends after
              payroll is saved. For Gmail or Outlook, use an app password if required.
            </p>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="email_payslips_on_save"
                  checked={!!settings.email_payslips_on_save}
                  onChange={handleInputChange}
                />{' '}
                Automatically email payslips when payroll is saved for a period
              </label>
            </div>
            <div className="form-group">
              <button
                type="button"
                className="btn-secondary"
                onClick={handlePrefillSmtpFromCompany}
              >
                Prefill from company email
              </button>
              <small>
                Uses company email to autofill sender and common provider defaults (Gmail, Outlook, Yahoo, Zoho) without
                overwriting existing values.
              </small>
            </div>
            <div className="form-group">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleTestSmtpConnection}
                disabled={testingSmtp}
              >
                {testingSmtp ? 'Testing SMTP…' : 'Test SMTP connection'}
              </button>
              <small>
                Verifies connection and login to the configured SMTP server without sending any employee email.
              </small>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>SMTP host</label>
                <input
                  type="text"
                  name="smtp_host"
                  value={settings.smtp_host}
                  onChange={handleInputChange}
                  placeholder="smtp.example.com"
                  autoComplete="off"
                />
              </div>
              <div className="form-group">
                <label>Port</label>
                <input
                  type="number"
                  name="smtp_port"
                  value={settings.smtp_port}
                  onChange={handleInputChange}
                  min="1"
                  max="65535"
                />
              </div>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="smtp_secure"
                  checked={!!settings.smtp_secure}
                  onChange={handleInputChange}
                />{' '}
                Use TLS/SSL (typical for port 465)
              </label>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>SMTP username (optional)</label>
                <input
                  type="text"
                  name="smtp_user"
                  value={settings.smtp_user}
                  onChange={handleInputChange}
                  autoComplete="off"
                />
              </div>
              <div className="form-group">
                <label>SMTP password (optional)</label>
                <input
                  type="password"
                  name="smtp_pass"
                  value={settings.smtp_pass}
                  onChange={handleInputChange}
                  autoComplete="new-password"
                  placeholder="App password if required"
                />
              </div>
            </div>
            <div className="form-group">
              <label>From address</label>
              <input
                type="email"
                name="smtp_from"
                value={settings.smtp_from}
                onChange={handleInputChange}
                placeholder="hr@yourcompany.com"
              />
              <small>Shown as the sender. Often matches the mailbox used to send.</small>
            </div>
            <p className="settings-section-desc">
              <small>
                Optional: set environment variables <code>HR_SMTP_HOST</code>, <code>HR_SMTP_PORT</code>,{' '}
                <code>HR_SMTP_USER</code>, <code>HR_SMTP_PASS</code>, <code>HR_SMTP_FROM</code>,{' '}
                <code>HR_SMTP_SECURE</code> (true/false) to override stored values on this machine.
              </small>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Settings
