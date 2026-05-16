/**
 * Base URL for the local HR API (no trailing slash).
 * Electron: main process sets apiPort before the window loads, but IPC can briefly return '' — retry.
 * Capacitor Android: VITE_ANDROID_API_URL or Preferences key hr_api_base_url (set from app settings later).
 */
export async function getApiBaseUrl() {
  // Capacitor first: do not use VITE_LOCAL_API_URL (often 127.0.0.1 from .env.local) on a real phone —
  // 127.0.0.1 is the device itself, not your HR PC.
  if (import.meta.env.VITE_CAPACITOR === 'true') {
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (Capacitor.isNativePlatform()) {
        const { Preferences } = await import('@capacitor/preferences')
        const { value } = await Preferences.get({ key: 'hr_api_base_url' })
        if (value && String(value).trim()) {
          return String(value).trim().replace(/\/$/, '')
        }
      }
    } catch (e) {
      console.warn('Capacitor API base URL:', e)
    }
    const androidUrl = import.meta.env.VITE_ANDROID_API_URL
    if (androidUrl && String(androidUrl).trim()) {
      return String(androidUrl).trim().replace(/\/$/, '')
    }
    return ''
  }

  // Packaged Electron serves the UI from the same Express process (http://127.0.0.1:<port>/ or remote HR URL).
  // API is always same-origin — never use a baked VITE_LOCAL_API_URL (wrong port breaks login and health checks).
  if (
    import.meta.env.PROD &&
    typeof window !== 'undefined' &&
    window.droppsoftDesktop?.isDesktop === true &&
    window.location?.origin &&
    (window.location.protocol === 'http:' || window.location.protocol === 'https:')
  ) {
    return String(window.location.origin).replace(/\/$/, '')
  }

  // Electron file:// (rare) or extra safety: URL from main process
  if (typeof window !== 'undefined' && window.droppsoftDesktop?.getApiBaseUrl) {
    for (let i = 0; i < 50; i += 1) {
      const u = await window.droppsoftDesktop.getApiBaseUrl()
      if (u) return String(u).replace(/\/$/, '')
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  const envUrl = import.meta.env.VITE_LOCAL_API_URL
  if (envUrl && String(envUrl).trim()) {
    return String(envUrl).replace(/\/$/, '')
  }
  // Browser or dev: UI served from the same host as the API (e.g. Vercel / single server)
  if (
    import.meta.env.PROD &&
    typeof window !== 'undefined' &&
    window.location?.protocol &&
    window.location.protocol !== 'file:' &&
    window.location.origin
  ) {
    return String(window.location.origin).replace(/\/$/, '')
  }
  return ''
}
