/**
 * Parse QR / deep-link payloads so the Android app can connect to the HR API.
 * Supported: plain http(s) URL, JSON { dropsoftHrApi | hrApiBase | api | baseUrl }, custom scheme.
 */

function toApiBase(raw) {
  let s = String(raw || '').trim()
  if (!s) return ''
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`
  try {
    const u = new URL(s)
    return u.origin
  } catch {
    return ''
  }
}

/** Normalized API origin (scheme + host + port), same as pairing QR payload. */
export function normalizeApiOrigin(raw) {
  return toApiBase(raw)
}

/**
 * True if the host is localhost / 127.0.0.1 / ::1 — unusable from a physical phone (means "this device").
 */
export function isLoopbackApiUrl(raw) {
  const o = toApiBase(raw)
  if (!o) return false
  try {
    const u = new URL(o)
    const h = u.hostname.toLowerCase()
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1'
  } catch {
    return false
  }
}

/** Android emulator alias for host loopback — wrong on a real phone on Wi‑Fi. */
export function isEmulatorBridgeHostUrl(raw) {
  const o = toApiBase(raw)
  if (!o) return false
  try {
    return new URL(o).hostname === '10.0.2.2'
  } catch {
    return false
  }
}

/**
 * @param {string} raw - Scanned text or pasted string
 * @returns {string|null} Normalized API base URL (origin only) or null
 */
export function parsePairingPayload(raw) {
  const s = String(raw || '').trim()
  if (!s) return null

  try {
    const j = JSON.parse(s)
    const u =
      j.dropsoftHrApi ||
      j.hrApiBase ||
      j.api ||
      j.baseUrl ||
      j.url ||
      j.base
    if (u) {
      const n = toApiBase(u)
      return n || null
    }
  } catch {
    /* not JSON */
  }

  if (/^https?:\/\//i.test(s)) {
    const n = toApiBase(s)
    return n || null
  }

  const scheme = s.match(/^dropsofthr:\/\/(?:connect\/?)?(?:\?|#)?(.*)$/i)
  if (scheme && scheme[1]) {
    const q = scheme[1]
    const urlParam = q.match(/(?:^|[&?])url=([^&]+)/i)
    if (urlParam) {
      try {
        const decoded = decodeURIComponent(urlParam[1].replace(/\+/g, ' '))
        const n = toApiBase(decoded)
        if (n) return n
      } catch {
        /* ignore */
      }
    }
  }

  return null
}
