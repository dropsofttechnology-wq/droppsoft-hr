import { useState, useEffect } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { getCompanySettings } from '../utils/settingsHelper'

const DEFAULT_FACE_SETTINGS = {
  // Quality thresholds (enrollment)
  face_min_brightness: 25,
  face_max_brightness: 95,
  face_min_contrast: 15,
  face_min_sharpness: 35,
  face_min_coverage: 12,
  face_max_coverage: 65,
  face_max_angle: 20,
  // Detection
  face_detection_confidence: 0.4,
  face_detection_throttle_ms: 150,
  // Matching (attendance terminal)
  face_matching_threshold: 0.35,
  face_matching_min_confidence: 65
}

const parseValue = (val, defaultVal) => {
  if (val === undefined || val === null || val === '') return defaultVal
  const num = parseFloat(val)
  return isNaN(num) ? defaultVal : num
}

export const useFaceSettings = () => {
  const { currentCompany } = useCompany()
  const [settings, setSettings] = useState({ ...DEFAULT_FACE_SETTINGS })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentCompany) {
      loadSettings()
    } else {
      setSettings({ ...DEFAULT_FACE_SETTINGS })
      setLoading(false)
    }
  }, [currentCompany])

  const loadSettings = async () => {
    if (!currentCompany) return

    try {
      setLoading(true)
      const faceKeys = Object.keys(DEFAULT_FACE_SETTINGS)
      const rows = await getCompanySettings(currentCompany.$id, faceKeys)

      const loaded = { ...DEFAULT_FACE_SETTINGS }
      faceKeys.forEach((key) => {
        const raw = rows[key]
        if (raw == null || raw === '') return
        const def = DEFAULT_FACE_SETTINGS[key]
        loaded[key] = parseValue(raw, def)
      })

      setSettings(loaded)
    } catch (error) {
      console.error('Error loading face settings:', error)
      setSettings({ ...DEFAULT_FACE_SETTINGS })
    } finally {
      setLoading(false)
    }
  }

  return { settings, loading }
}

export { DEFAULT_FACE_SETTINGS }
