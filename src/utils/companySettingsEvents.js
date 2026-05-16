export const COMPANY_SETTINGS_UPDATED = 'dropsoft:company-settings-updated'

/**
 * @param {string} companyId
 */
export function dispatchCompanySettingsUpdated(companyId) {
  if (typeof window === 'undefined' || !companyId) return
  window.dispatchEvent(
    new CustomEvent(COMPANY_SETTINGS_UPDATED, { detail: { companyId } })
  )
}

/**
 * @param {(companyId: string) => void} handler
 * @returns {() => void} unsubscribe
 */
export function onCompanySettingsUpdated(handler) {
  if (typeof window === 'undefined') {
    return () => {}
  }
  const fn = (e) => {
    const id = e?.detail?.companyId
    if (id) handler(id)
  }
  window.addEventListener(COMPANY_SETTINGS_UPDATED, fn)
  return () => window.removeEventListener(COMPANY_SETTINGS_UPDATED, fn)
}

/** Local install: system maintenance (e.g. auto-logout) changed */
export const SYSTEM_SETTINGS_UPDATED = 'dropsoft:system-settings-updated'

export function dispatchSystemSettingsUpdated() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SYSTEM_SETTINGS_UPDATED))
}

/**
 * @param {() => void} handler
 * @returns {() => void} unsubscribe
 */
export function onSystemSettingsUpdated(handler) {
  if (typeof window === 'undefined') {
    return () => {}
  }
  window.addEventListener(SYSTEM_SETTINGS_UPDATED, handler)
  return () => window.removeEventListener(SYSTEM_SETTINGS_UPDATED, handler)
}
