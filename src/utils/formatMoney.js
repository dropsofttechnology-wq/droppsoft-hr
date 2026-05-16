/**
 * @param {unknown} value
 * @param {{ prefix?: string, minimumFractionDigits?: number, maximumFractionDigits?: number }} [opts]
 */
export function formatMoneyAmount(value, opts = {}) {
  const {
    prefix = '',
    minimumFractionDigits = 0,
    maximumFractionDigits = 2
  } = opts
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  const formatted = n.toLocaleString(undefined, { minimumFractionDigits, maximumFractionDigits })
  return prefix ? `${prefix}${formatted}` : formatted
}
