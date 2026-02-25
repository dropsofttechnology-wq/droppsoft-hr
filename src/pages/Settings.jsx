import { useState, useEffect } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { Query } from 'appwrite'
import './Settings.css'

const Settings = () => {
  const { currentCompany } = useCompany()
  const [settings, setSettings] = useState({
    // Payroll Settings
    standard_allowance: '0',
    housing_allowance: '0',
    housing_allowance_type: 'fixed', // 'fixed' or 'percentage'
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
    require_geolocation: false
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
            </select>
          </div>

          <div className="form-group">
            <label>
              Housing Allowance {settings.housing_allowance_type === 'percentage' ? '(%)' : '(KES)'}
            </label>
            <input
              type="number"
              name="housing_allowance"
              value={settings.housing_allowance}
              onChange={handleInputChange}
              min="0"
              step={settings.housing_allowance_type === 'percentage' ? '0.1' : '0.01'}
            />
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
      </div>
    </div>
  )
}

export default Settings
