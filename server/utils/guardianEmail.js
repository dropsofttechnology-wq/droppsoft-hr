/**
 * Resolve parent/guardian email from student fee-ledger fields.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/

export function isValidEmail(value) {
  const s = String(value || '').trim()
  return s.length > 3 && s.includes('@') && !s.includes(' ')
}

/**
 * @param {{ guardian_email?: string, guardian_summary?: string, notes?: string } | null | undefined} student
 */
export function resolveGuardianEmail(student) {
  if (!student) return ''
  const direct = String(student.guardian_email || '').trim()
  if (isValidEmail(direct)) return direct.toLowerCase()
  for (const field of [student.guardian_summary, student.notes]) {
    const text = String(field || '')
    const match = text.match(EMAIL_RE)
    if (match && isValidEmail(match[0])) return match[0].toLowerCase()
  }
  return ''
}
