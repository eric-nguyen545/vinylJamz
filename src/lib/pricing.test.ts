import { describe, expect, it } from 'vitest'
import { collectionValue, latestByType, pickValue } from './pricing'

const o = (observationType: 'sold' | 'listing' | 'estimate' | 'manual', price: number, observedAt: string, extra: { albumId?: string; copyId?: string; currency?: string } = {}) =>
  ({ albumId: extra.albumId ?? 'a', copyId: extra.copyId, price, currency: extra.currency ?? 'USD', observationType, observedAt })

describe('pricing', () => {
  it('keeps the newest observation of each type separate', () => {
    const l = latestByType([o('sold', 30, '2025-01-01'), o('sold', 35, '2025-06-01'), o('listing', 80, '2025-03-01')])
    expect(l.sold?.price).toBe(35)
    expect(l.listing?.price).toBe(80)
    expect(l.estimate).toBeUndefined()
  })
  it('prefers sold over estimate over asking price, regardless of date', () => {
    expect(pickValue([o('listing', 90, '2025-09-01'), o('estimate', 50, '2025-01-01')])?.observationType).toBe('estimate')
    expect(pickValue([o('estimate', 50, '2025-09-01'), o('sold', 40, '2024-01-01')])?.observationType).toBe('sold')
    expect(pickValue([])).toBeUndefined()
  })
})

describe('collectionValue', () => {
  const copies = [{ id: 'c1', albumId: 'a' }, { id: 'c2', albumId: 'a' }, { id: 'c3', albumId: 'b' }, { id: 'c4', albumId: 'z' }]
  const obs = [
    o('sold', 40, '2025-02-01'),                                    // album-level for a
    o('sold', 100, '2025-03-01', { copyId: 'c2' }),                 // copy-specific for c2
    o('listing', 25, '2025-04-01', { albumId: 'b', currency: 'EUR' }),
  ]
  it('uses copy-specific prices first, then album-level, and sums per currency', () => {
    const v = collectionValue(copies, obs)
    expect(v.rows.find((r) => r.currency === 'USD')).toMatchObject({ total: 140, valuedCopies: 2, basis: { sold: 2, estimate: 0, listing: 0, manual: 0 } })
    expect(v.rows.find((r) => r.currency === 'EUR')).toMatchObject({ total: 25, valuedCopies: 1, basis: { listing: 1 } })
  })
  it('reports copies without any price', () => {
    const v = collectionValue(copies, obs)
    expect(v.unvalued).toBe(1)
    expect(v.totalCopies).toBe(4)
  })
  it('never mixes currencies into one total', () => { expect(collectionValue(copies, obs).rows).toHaveLength(2) })
})
