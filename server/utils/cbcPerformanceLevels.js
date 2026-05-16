/** Kenyan CBC performance scale (1–4). */

export const CBC_PERFORMANCE_LEVELS = Object.freeze([
  { level: 4, abbreviation: 'EE', label: 'Exceeding Expectations', description: 'Exceptional ability consistently demonstrated.' },
  { level: 3, abbreviation: 'ME', label: 'Meeting Expectations', description: 'Required competencies demonstrated skillfully.' },
  { level: 2, abbreviation: 'AE', label: 'Approaching Expectations', description: 'Most basics met; needs support.' },
  { level: 1, abbreviation: 'BE', label: 'Below Expectations', description: 'Requires purposeful intervention.' }
])

export function cbcLevelMeta(level) {
  const n = Number(level)
  return CBC_PERFORMANCE_LEVELS.find((l) => l.level === n) || null
}

export function isValidCbcLevel(level) {
  const n = Number(level)
  return Number.isInteger(n) && n >= 1 && n <= 4
}
