import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'
import { isLocalDataSource } from '../config/dataSource'
import { getCompanySettingNumber } from '../utils/settingsHelper'
import { localApiFetch } from '../services/localApi'
import {
  onCompanySettingsUpdated,
  onSystemSettingsUpdated
} from '../utils/companySettingsEvents'

const EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'wheel']

const MAX_MINUTES = 7 * 24 * 60

async function fetchLocalSystemAutoLogoutMinutes() {
  try {
    const r = await localApiFetch('/api/subscription/status')
    if (!r.ok) return 0
    const d = await r.json()
    const n = Math.floor(Number(d.autoLogoutMinutes ?? 0))
    return Math.min(MAX_MINUTES, Math.max(0, n))
  } catch {
    return 0
  }
}

/**
 * Local (PC/Electron): `auto_logout_minutes` from System maintenance (SQLite app_settings).
 * Cloud (Appwrite): per-company Company settings.
 */
export function useAutoLogout() {
  const { user, logout } = useAuth()
  const { currentCompany } = useCompany()
  const [idleMinutes, setIdleMinutes] = useState(0)
  const timerRef = useRef(null)
  const throttleRef = useRef(0)
  const idleMinutesRef = useRef(0)
  const logoutRef = useRef(logout)
  const companyId = currentCompany?.$id

  useEffect(() => {
    logoutRef.current = logout
  }, [logout])

  useEffect(() => {
    idleMinutesRef.current = idleMinutes
  }, [idleMinutes])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const loadMinutes = useCallback(async () => {
    if (!user) {
      setIdleMinutes(0)
      return
    }
    if (isLocalDataSource()) {
      const m = await fetchLocalSystemAutoLogoutMinutes()
      setIdleMinutes(m)
      return
    }
    if (!companyId) {
      setIdleMinutes(0)
      return
    }
    const n = await getCompanySettingNumber(companyId, 'auto_logout_minutes', 0)
    const m = Math.min(Math.max(0, Math.floor(Number(n) || 0)), MAX_MINUTES)
    setIdleMinutes(m)
  }, [user, companyId])

  useEffect(() => {
    loadMinutes()
  }, [loadMinutes])

  useEffect(() => {
    return onCompanySettingsUpdated((cid) => {
      if (!isLocalDataSource() && companyId && cid === companyId) {
        loadMinutes()
      }
    })
  }, [companyId, loadMinutes])

  useEffect(() => {
    return onSystemSettingsUpdated(() => {
      if (isLocalDataSource() && user) {
        loadMinutes()
      }
    })
  }, [user, loadMinutes])

  const armTimer = useCallback(() => {
    clearTimer()
    const m = idleMinutesRef.current
    if (!m || m <= 0) return
    const ms = m * 60 * 1000
    timerRef.current = setTimeout(() => {
      clearTimer()
      toast('You were logged out due to inactivity.', { duration: 4500 })
      logoutRef.current()
    }, ms)
  }, [clearTimer])

  useEffect(() => {
    if (!user || !idleMinutes || idleMinutes <= 0) {
      clearTimer()
      return
    }
    if (!isLocalDataSource() && !companyId) {
      clearTimer()
      return
    }

    const reset = () => {
      const now = Date.now()
      if (now - throttleRef.current < 800) return
      throttleRef.current = now
      armTimer()
    }

    armTimer()
    EVENTS.forEach((e) => window.addEventListener(e, reset, true))
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, reset, true))
      clearTimer()
    }
  }, [user, companyId, idleMinutes, armTimer, clearTimer])
}
