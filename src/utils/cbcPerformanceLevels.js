/** Kenyan CBC performance scale (1–4) — mirrors server constants. */

export const CBC_PERFORMANCE_LEVELS = Object.freeze([
  { level: 4, abbreviation: 'EE', label: 'Exceeding Expectations', description: 'Exceptional ability consistently demonstrated.' },
  { level: 3, abbreviation: 'ME', label: 'Meeting Expectations', description: 'Required competencies demonstrated skillfully.' },
  { level: 2, abbreviation: 'AE', label: 'Approaching Expectations', description: 'Most basics met; needs support.' },
  { level: 1, abbreviation: 'BE', label: 'Below Expectations', description: 'Requires purposeful intervention.' }
])

/**
 * @param {number | null | undefined} level
 */
export function cbcLevelMeta(level) {
  const n = Number(level)
  return CBC_PERFORMANCE_LEVELS.find((l) => l.level === n) || null
}

/**
 * @param {number} level
 */
export function cbcLevelButtonClass(level) {
  const map = { 4: 'ee', 3: 'me', 2: 'ae', 1: 'be' }
  return map[Number(level)] || ''
}
