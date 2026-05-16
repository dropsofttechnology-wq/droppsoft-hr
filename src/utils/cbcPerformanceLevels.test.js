import { describe, it, expect } from 'vitest'
import { CBC_PERFORMANCE_LEVELS, cbcLevelMeta } from './cbcPerformanceLevels'

describe('cbcPerformanceLevels', () => {
  it('defines four CBC levels', () => {
    expect(CBC_PERFORMANCE_LEVELS).toHaveLength(4)
    expect(cbcLevelMeta(4)?.abbreviation).toBe('EE')
    expect(cbcLevelMeta(1)?.abbreviation).toBe('BE')
  })
})
