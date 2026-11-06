import { describe, expect, it } from 'vitest'
import { monthStart, randomStart } from './useDashboard'

describe('dashboard helpers', () => {
  it('finds the first day of the month in local time', () => {
    expect(monthStart(new Date(2026, 2, 17))).toBe('2026-03-01')
    expect(monthStart(new Date(2026, 11, 31))).toBe('2026-12-01')
    expect(monthStart(new Date(2027, 0, 1))).toBe('2027-01-01')
  })
  it('picks a letter across the whole alphabet', () => {
    expect(randomStart(() => 0)).toBe('a')
    expect(randomStart(() => 0.999999)).toBe('z')
    expect(randomStart(() => 0.5)).toBe('n')
  })
})
