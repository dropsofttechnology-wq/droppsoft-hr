import { describe, expect, it } from 'vitest'
import { formatMoneyAmount } from './formatMoney.js'

describe('formatMoneyAmount', () => {
  it('formats with KES prefix', () => {
    expect(formatMoneyAmount(12500.5, { prefix: 'KES ' })).toMatch(/KES\s*12,50/)
  })

  it('returns em dash for invalid values', () => {
    expect(formatMoneyAmount('n/a')).toBe('—')
    expect(formatMoneyAmount(null)).toBe('—')
  })
})
