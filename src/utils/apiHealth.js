/**
 * Health check against the local HR Express API (`GET /api/health`).
 */
export async function fetchHrApiHealth(baseUrl, timeoutMs = 4000) {
  const base = String(baseUrl || '').trim().replace(/\/$/, '')
  if (!base) return { ok: false }
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), timeoutMs)
  try {
    const r = await fetch(`${base}/api/health`, { signal: c.signal })
    return { ok: r.ok }
  } catch {
    return { ok: false }
  } finally {
    clearTimeout(t)
  }
}

export async function waitForHrApiHealth(baseUrl, maxAttempts = 120, intervalMs = 400) {
  for (let i = 0; i < maxAttempts; i += 1) {
    if ((await fetchHrApiHealth(baseUrl)).ok) return true
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}
