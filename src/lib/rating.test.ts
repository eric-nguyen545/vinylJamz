import { describe, expect, it } from 'vitest'
import { averageRating, formatRating, fromCanonical, ratingStep, toCanonical } from './rating'

describe('rating', () => {
  it('averages canonical ratings and ignores unrated albums', () => {
    expect(averageRating([undefined])).toBeUndefined()
    expect(averageRating([8, 9, undefined])).toBe(8.5)
  })
  it('converts to and from the canonical 0-10 scale', () => {
    expect(toCanonical(4, 5)).toBe(8)
    expect(toCanonical(80, 100)).toBe(8)
    expect(toCanonical(7.5, 10)).toBe(7.5)
    expect(fromCanonical(8, 5)).toBe(4)
    expect(fromCanonical(7.3, 10)).toBe(7.5)
    expect(fromCanonical(8.4, 100)).toBe(84)
  })
  it('keeps the same album rating when the display scale changes', () => {
    const stored = toCanonical(4.5, 5)
    expect(fromCanonical(stored, 10)).toBe(9)
    expect(fromCanonical(stored, 100)).toBe(90)
  })
  it('formats for the chosen scale', () => {
    expect(formatRating(9, 10)).toBe('9 / 10')
    expect(formatRating(7.5, 10)).toBe('7.5 / 10')
    expect(formatRating(9, 5)).toBe('4.5 / 5')
    expect(formatRating(undefined, 10)).toBe('')
  })
  it('uses half-point steps except on 0-100', () => { expect(ratingStep(10)).toBe(0.5); expect(ratingStep(100)).toBe(1) })
})
