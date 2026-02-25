import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'

/**
 * Get company setting with fallback to default
 */
export const getCompanySetting = async (companyId, settingKey, defaultValue = null) => {
  try {
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
