import { describe, it, expect } from 'vitest'
import { isValidEmail, resolveGuardianEmail } from './guardianEmail.js'

describe('guardianEmail', () => {
  it('prefers guardian_email when valid', () => {
    expect(
      resolveGuardianEmail({
        guardian_email: 'Parent@School.org',
        guardian_summary: 'other@x.com'
      })
    ).toBe('parent@school.org')
  })

  it('extracts email from guardian_summary or notes', () => {
    expect(
      resolveGuardianEmail({
        guardian_summary: 'Jane Doe — jane.doe@example.com'
      })
    ).toBe('jane.doe@example.com')
    expect(
      resolveGuardianEmail({
        notes: 'Contact: guardian@test.co.ke'
      })
    ).toBe('guardian@test.co.ke')
  })

  it('returns empty when no email found', () => {
    expect(resolveGuardianEmail({ guardian_summary: 'No email here' })).toBe('')
    expect(resolveGuardianEmail(null)).toBe('')
  })

  it('validates emails', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('bad')).toBe(false)
    expect(isValidEmail('has space@x.com')).toBe(false)
  })
})
