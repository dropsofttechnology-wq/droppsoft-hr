/** @type {((html: string) => Promise<Buffer>) | null} */
let printHtmlToPdfImpl = null

/**
 * Called from Electron main before HTTP server starts.
 * @param {((html: string) => Promise<Buffer>) | null} fn
 */
export function registerElectronPdfImpl(fn) {
  printHtmlToPdfImpl = typeof fn === 'function' ? fn : null
}

export function isElectronPdfAvailable() {
  return typeof printHtmlToPdfImpl === 'function'
}

/**
 * @param {string} html
 * @returns {Promise<Buffer | null>} Buffer when Electron printing is wired; null to use PDFKit fallback.
 */
export async function printTranscriptHtmlToPdfBuffer(html) {
  if (!printHtmlToPdfImpl) return null
  return printHtmlToPdfImpl(String(html || ''))
}
