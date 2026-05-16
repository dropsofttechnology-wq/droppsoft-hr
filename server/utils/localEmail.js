/**
 * Local auth stores emails; bare usernames map to @dropsoft.local (e.g. dropsuper → dropsuper@dropsoft.local).
 */
export function normalizeLocalEmail(raw) {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return s
  if (s.includes('@')) return s
  return `${s}@dropsoft.local`
}
