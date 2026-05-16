/**
 * When true, the app uses the local Express + SQLite API instead of Appwrite.
 * - Electron desktop: window.droppsoftDesktop.isDesktop
 * - Browser dev: copy `.env.example` to `.env.local`, set VITE_USE_LOCAL_API=true and VITE_LOCAL_API_URL
 *   to match `HR_API_PORT` (see `.env.example`). Run `npm run server` then `npm run dev`.
 */
export function isLocalDataSource() {
  if (import.meta.env.VITE_USE_LOCAL_API === 'true') return true
  if (typeof window !== 'undefined' && window.droppsoftDesktop?.isDesktop) return true
  return false
}
