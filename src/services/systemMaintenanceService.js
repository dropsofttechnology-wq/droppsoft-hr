import { getApiBaseUrl } from '../config/api'
import { LOCAL_USER_ID_KEY } from '../config/constants'
import { localApiFetch } from './localApi'

export async function fetchSubscriptionStatus() {
  const r = await localApiFetch('/api/subscription/status')
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Failed to load subscription')
  return data
}

export async function updateSubscription(plan, periodStart) {
  const r = await localApiFetch('/api/subscription', {
    method: 'PUT',
    body: JSON.stringify({ plan, periodStart: periodStart || undefined })
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Update failed')
  return data
}

/**
 * Local install: minutes of inactivity before automatic logout (0 = off). Super admin only.
 * @param {number} autoLogoutMinutes
 */
export async function updateSessionSettings(autoLogoutMinutes) {
  const r = await localApiFetch('/api/subscription/session', {
    method: 'PUT',
    body: JSON.stringify({ autoLogoutMinutes })
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Failed to save session settings')
  return data
}

/**
 * Super admin: activate subscription from a signed DHR1 license (LAN server deployment-bound).
 * @param {string} license — full DHR1… token
 */
export async function activateSubscriptionLicense(license) {
  const r = await localApiFetch('/api/subscription/activate', {
    method: 'POST',
    body: JSON.stringify({ license: String(license || '').trim() })
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Activation failed')
  return data
}

/**
 * @param {string} password — min 8 characters; used to encrypt the backup (AES-256-GCM).
 */
export async function downloadBackup(password) {
  const base = await getApiBaseUrl()
  if (!base) throw new Error('API not configured')
  const id = localStorage.getItem(LOCAL_USER_ID_KEY)
  const headers = {
    'Content-Type': 'application/json',
    ...(id ? { 'x-user-id': id } : {})
  }
  const r = await fetch(`${base}/api/backup/download`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ password })
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(err.error || 'Download failed')
  }
  const blob = await r.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dropsoft-hr-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.dhrbackup`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * @param {File} file — encrypted .dhrbackup or legacy plain .zip
 * @param {string} [password] — required to decrypt .dhrbackup files
 */
export async function fetchBackupSchedule() {
  const r = await localApiFetch('/api/backup/schedule')
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Failed to load backup schedule')
  return data
}

export async function saveBackupSchedule(payload) {
  const r = await localApiFetch('/api/backup/schedule', {
    method: 'PUT',
    body: JSON.stringify(payload)
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Failed to save backup schedule')
  return data
}

export async function uploadRestore(file, password = '') {
  const base = await getApiBaseUrl()
  if (!base) throw new Error('API not configured')
  const id = localStorage.getItem(LOCAL_USER_ID_KEY)
  const fd = new FormData()
  fd.append('file', file)
  if (password) {
    fd.append('password', password)
  }
  const r = await fetch(`${base}/api/backup/restore`, {
    method: 'POST',
    headers: id ? { 'x-user-id': id } : {},
    body: fd
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Restore upload failed')
  return data
}
