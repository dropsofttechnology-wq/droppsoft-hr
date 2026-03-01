import { useState, useEffect } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { Query } from 'appwrite'
import './Settings.css'

const Settings = () => {
  const { currentCompany } = useCompany()
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
    face_matching_min_confidence: '65'
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (currentCompany) {
      loadSettings()
    }
  }, [currentCompany])

  const loadSettings = async () => {
    if (!currentCompany) return

    try {
      setLoading(true)
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.SETTINGS,
        [
          Query.equal('company_id', currentCompany.$id),
          Query.limit(5000)
        ]
      )

      const loadedSettings = {}
      response.documents.forEach(doc => {
        loadedSettings[doc.setting_key] = doc.setting_value
      })

      setSettings(prev => ({
        ...prev,
        ...loadedSettings
      }))
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

      // Get existing settings
      const existing = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.SETTINGS,
        [
          Query.equal('company_id', currentCompany.$id),
          Query.limit(5000)
        ]
      )

      const existingMap = {}
      existing.documents.forEach(doc => {
        existingMap[doc.setting_key] = doc.$id
      })

      // Save or update each setting
      for (const [key, value] of Object.entries(settings)) {
        const settingValue = String(value)
        
        if (existingMap[key]) {
          // Update existing
          await databases.updateDocument(
            DATABASE_ID,
            COLLECTIONS.SETTINGS,
            existingMap[key],
            {
              setting_value: settingValue,
              updated_at: new Date().toISOString()
            }
          )
        } else {
          // Create new
          await databases.createDocument(
            DATABASE_ID,
            COLLECTIONS.SETTINGS,
            'unique()',
            {
              company_id: currentCompany.$id,
              setting_key: key,
              setting_value: settingValue,
              updated_at: new Date().toISOString()
            }
          )
        }
      }

      setSuccess('Settings saved successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Failed to save settings: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
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

        {/* Statutory Rates */}
        <div className="settings-section">
          <h2>Statutory Deduction Rates</h2>
          
          <div className="form-group">
            <label>SHIF Rate (%)</label>
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
            <label>SHIF Minimum (KES)</label>
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
      </div>
    </div>
  )
}

export default Settings
