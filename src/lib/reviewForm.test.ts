import { describe, expect, it } from 'vitest'
import { addVibe, emptyReviewForm, formToReview, normalizeVibe, reviewToForm } from './reviewForm'

describe('review form', () => {
  it('saves an empty form as an unrated review', () => {
    const r = formToReview(emptyReviewForm(), 10, [])
    expect(r.ok).toBe(true)
    if (r.ok) { expect(r.value.rating).toBeUndefined(); expect(r.value.vibes).toEqual([]); expect(r.value.isFavorite).toBe(false) }
  })
  it('stores ratings on the canonical 0-10 scale', () => {
    const r = formToReview({ ...emptyReviewForm(), rating: '4.5' }, 5, [])
    expect(r.ok && r.value.rating).toBe(9)
  })
  it('rejects out-of-range, non-numeric and off-step ratings', () => {
    for (const rating of ['11', '-1', 'abc', '7.35']) {
      const r = formToReview({ ...emptyReviewForm(), rating }, 10, [])
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.errors.rating).toBeTruthy()
    }
    expect(formToReview({ ...emptyReviewForm(), rating: '84' }, 100, []).ok).toBe(true)
    expect(formToReview({ ...emptyReviewForm(), rating: '84.5' }, 100, []).ok).toBe(false)
    expect(formToReview({ ...emptyReviewForm(), rating: '7.3' }, 10, []).ok).toBe(true)
  })
  it('drops top tracks that no longer exist and caps at three', () => {
    const r = formToReview({ ...emptyReviewForm(), topThreeTrackIds: ['a', 'gone', 'b'] }, 10, ['a', 'b', 'c'])
    expect(r.ok && r.value.topThreeTrackIds).toEqual(['a', 'b'])
    expect(formToReview({ ...emptyReviewForm(), topThreeTrackIds: ['a', 'b', 'c', 'd'] }, 10, ['a', 'b', 'c', 'd']).ok).toBe(false)
  })
  it('round-trips a stored rating into the display scale', () => {
    expect(reviewToForm({ rating: 9 }, 5).rating).toBe('4.5')
    expect(reviewToForm({ rating: 7.3 }, 10).rating).toBe('7.3')
    expect(reviewToForm(null, 10)).toEqual(emptyReviewForm())
  })
  it('normalizes and dedupes vibe tags', () => {
    expect(normalizeVibe('  Late   Night ')).toBe('late night')
    expect(addVibe(['late night'], 'LATE night')).toEqual(['late night'])
    expect(addVibe([], '   ')).toEqual([])
    expect(addVibe(['a'], 'b')).toEqual(['a', 'b'])
  })
})
