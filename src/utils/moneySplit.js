/**
 * Split a monetary total into `parts` equal slices (last items absorb cent remainder).
 * @param {number} total
 * @param {number} parts — min 1, max 60
 * @returns {number[]}
 */
export function splitMoneyIntoInstallments(total, parts) {
  const num = Math.max(0, Number(total) || 0)
  const n = Math.max(1, Math.min(60, Math.floor(Number(parts) || 1)))
  if (n === 1) return [Math.round(num * 100) / 100]
  const cents = Math.round(num * 100)
  const base = Math.floor(cents / n)
  let rem = cents - base * n
  const out = []
  for (let i = 0; i < n; i++) {
    const c = base + (rem > 0 ? 1 : 0)
    if (rem > 0) rem -= 1
    out.push(c / 100)
  }
  return out
}

/**
 * Parse user-provided installment amounts (comma/newline separated).
 * Example: "10000,5000,5000,5000,5000"
 * @param {string} raw
 * @returns {number[]}
 */
export function parseInstallmentPlan(raw) {
  const text = String(raw || '').trim()
  if (!text) return []
  return text
    .split(/[\n,]+/)
    .map((chunk) => Number.parseFloat(chunk.trim().replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => Math.round(n * 100) / 100)
}

/**
 * True when custom plan adds up exactly to total.
 * @param {number[]} plan
 * @param {number} total
 * @returns {boolean}
 */
export function installmentPlanMatchesTotal(plan, total) {
  const planCents = Math.round((plan || []).reduce((sum, n) => sum + Number(n || 0), 0) * 100)
  const totalCents = Math.round((Number(total) || 0) * 100)
  return planCents === totalCents
}
