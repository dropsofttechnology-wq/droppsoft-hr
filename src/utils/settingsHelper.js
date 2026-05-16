import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { isLocalDataSource } from '../config/dataSource'
import { localApiFetch } from '../services/localApi'

/**
 * Get company setting with fallback to default
 */
export const getCompanySetting = async (companyId, settingKey, defaultValue = null) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(
        `/api/settings?company_id=${encodeURIComponent(companyId)}`
      )
      if (!res.ok) return defaultValue
      const rows = await res.json()
      const row = rows.find((r) => r.setting_key === settingKey)
      return row ? row.setting_value : defaultValue
    }
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.SETTINGS,
      [
        Query.equal('company_id', companyId),
        Query.equal('setting_key', settingKey),
        Query.limit(1)
      ]
    )

    if (response.documents.length > 0) {
      return response.documents[0].setting_value
    }

    return defaultValue
  } catch (error) {
    console.error('Error getting company setting:', error)
    return defaultValue
  }
}

/**
 * Get multiple company settings at once
 */
export const getCompanySettings = async (companyId, settingKeys) => {
  try {
    if (isLocalDataSource()) {
      const res = await localApiFetch(
        `/api/settings?company_id=${encodeURIComponent(companyId)}`
      )
      if (!res.ok) return {}
      const rows = await res.json()
      const settings = {}
      settingKeys.forEach((key) => {
        const row = rows.find((r) => r.setting_key === key)
        settings[key] = row ? row.setting_value : null
      })
      return settings
    }
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.SETTINGS,
      [
        Query.equal('company_id', companyId),
        Query.limit(5000)
      ]
    )

    const settings = {}
    settingKeys.forEach(key => {
      const doc = response.documents.find(d => d.setting_key === key)
      settings[key] = doc ? doc.setting_value : null
    })

    return settings
  } catch (error) {
    console.error('Error getting company settings:', error)
    return {}
  }
}

/**
 * Save many settings at once (used by Settings page; supports local API bulk upsert).
 */
export const saveCompanySettingsBulk = async (companyId, values) => {
  const toStr = (v) => (typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v ?? ''))

  if (isLocalDataSource()) {
    const payload = {}
    for (const [k, v] of Object.entries(values)) {
      payload[k] = toStr(v)
    }
    const res = await localApiFetch('/api/settings/bulk', {
      method: 'PUT',
      body: JSON.stringify({ company_id: companyId, values: payload })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to save settings')
    }
    return
  }

  const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SETTINGS, [
    Query.equal('company_id', companyId),
    Query.limit(5000)
  ])
  const existingMap = {}
  existing.documents.forEach((doc) => {
    existingMap[doc.setting_key] = doc.$id
  })

  const now = new Date().toISOString()
  for (const [key, value] of Object.entries(values)) {
    const settingValue = toStr(value)
    if (existingMap[key]) {
      await databases.updateDocument(DATABASE_ID, COLLECTIONS.SETTINGS, existingMap[key], {
        setting_value: settingValue,
        updated_at: now
      })
    } else {
      await databases.createDocument(DATABASE_ID, COLLECTIONS.SETTINGS, 'unique()', {
        company_id: companyId,
        setting_key: key,
        setting_value: settingValue,
        updated_at: now
      })
    }
  }
}

/**
 * Test SMTP connection for the selected company (local desktop API only).
 * Returns effective SMTP config used for verification.
 */
export const testCompanySmtpConnection = async (companyId) => {
  if (isLocalDataSource()) {
    const res = await localApiFetch('/api/settings/smtp-test', {
      method: 'POST',
      body: JSON.stringify({ company_id: companyId })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.error || 'SMTP test failed')
    }
    return data
  }
  throw new Error('SMTP test is available in the local desktop app only.')
}

/**
 * Get setting as number
 */
export const getCompanySettingNumber = async (companyId, settingKey, defaultValue = 0) => {
  const value = await getCompanySetting(companyId, settingKey, defaultValue)
  return parseFloat(value) || defaultValue
}

/**
 * Get setting as boolean
 */
export const getCompanySettingBoolean = async (companyId, settingKey, defaultValue = false) => {
  const value = await getCompanySetting(companyId, settingKey, defaultValue)
  return value === 'true' || value === true
}
