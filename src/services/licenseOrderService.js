import { getApiBaseUrl } from '../config/api'
import { LOCAL_USER_ID_KEY } from '../config/constants'

async function subscriptionFetch(path, options = {}) {
  const base = await getApiBaseUrl()
  if (!base) throw new Error('API not configured')
  const id = localStorage.getItem(LOCAL_USER_ID_KEY)
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(id ? { 'x-user-id': id } : {}),
    ...(options.headers || {})
  }
  const r = await fetch(`${base}${path}`, { ...options, headers })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || 'Request failed')
  return data
}

export async function fetchLicenseCatalog() {
  return subscriptionFetch('/api/subscription/catalog')
}

export async function quoteLicensePackage(payload) {
  return subscriptionFetch('/api/subscription/quote', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export async function submitLicenseOrder(payload) {
  return subscriptionFetch('/api/subscription/orders', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export async function fetchLicenseOrders() {
  return subscriptionFetch('/api/subscription/orders')
}

/**
 * @param {string} orderId
 * @returns {Promise<Blob>}
 */
export async function downloadLicenseProformaPdf(orderId) {
  const base = await getApiBaseUrl()
  if (!base) throw new Error('API not configured')
  const id = localStorage.getItem(LOCAL_USER_ID_KEY)
  const r = await fetch(`${base}/api/subscription/orders/${encodeURIComponent(orderId)}/proforma`, {
    headers: id ? { 'x-user-id': id } : {}
  })
  const ct = r.headers.get('content-type') || ''
  if (!r.ok) {
    const data = await r.json().catch(() => ({}))
    throw new Error(data.error || 'Could not download proforma')
  }
  if (!ct.includes('application/pdf')) {
    const data = await r.json().catch(() => ({}))
    throw new Error(data.error || 'Invalid proforma response')
  }
  return r.blob()
}
