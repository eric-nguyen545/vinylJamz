import { describe, expect, it } from 'vitest'
import { copiesWithoutPrice, decadeCounts, genreCounts, locationStats, priciest, ratingDistribution, spendingByMonth, spendingTotals, topArtists } from './stats'

const copies = [
  { albumId: 'a', purchasePrice: 20, currency: 'USD', purchaseDate: '2025-01-05', purchaseLocationId: 'L1' },
  { albumId: 'b', purchasePrice: 30.5, currency: 'USD', purchaseDate: '2025-01-20', purchaseLocationId: 'L1' },
  { albumId: 'c', purchasePrice: 15, currency: 'EUR', purchaseDate: '2025-03-02', purchaseLocationId: 'L2' },
  { albumId: 'a', purchasePrice: undefined, currency: undefined, purchaseDate: undefined, purchaseLocationId: 'L1' },
]

describe('spending', () => {
  it('totals per currency without mixing them', () => {
    const t = spendingTotals(copies)
    expect(t.find((x) => x.currency === 'USD')).toEqual({ currency: 'USD', total: 50.5, copies: 2, average: 25.25 })
    expect(t.find((x) => x.currency === 'EUR')).toMatchObject({ total: 15, copies: 1 })
  })
  it('counts copies with no price so they can be disclosed', () => { expect(copiesWithoutPrice(copies)).toBe(1) })
  it('groups by month for one currency and skips undated copies', () => {
    expect(spendingByMonth(copies, 'USD')).toEqual([{ month: '2025-01', total: 50.5 }])
    expect(spendingByMonth(copies, 'EUR')).toEqual([{ month: '2025-03', total: 15 }])
  })
  it('lists priciest copies in one currency', () => {
    expect(priciest(copies, 'USD', 1).map((c) => c.purchasePrice)).toEqual([30.5])
  })
})

describe('collection breakdowns', () => {
  it('counts each genre once per album, case-insensitively', () => {
    const g = genreCounts([{ genres: ['Jazz', 'jazz', 'Bop'] }, { genres: ['JAZZ'] }, { genres: [] }])
    expect(g[0]).toEqual({ name: 'jazz', count: 2 })
    expect(g).toContainEqual({ name: 'bop', count: 1 })
  })
  it('ranks artists', () => {
    expect(topArtists([{ primaryArtist: 'A' }, { primaryArtist: 'B' }, { primaryArtist: 'A' }])[0]).toEqual({ name: 'A', count: 2 })
  })
  it('buckets decades and reports albums without a year', () => {
    expect(decadeCounts([{ releaseYear: 1959 }, { releaseYear: 1961 }, { releaseYear: 1969 }, {}])).toEqual({
      rows: [{ decade: '1950s', count: 1 }, { decade: '1960s', count: 2 }], missing: 1,
    })
  })
  it('buckets ratings 0-10, putting 10 in the top bucket and ignoring unrated', () => {
    const d = ratingDistribution([{ rating: 0 }, { rating: 7.5 }, { rating: 10 }, { rating: 9.9 }, {}])
    expect(d).toHaveLength(10)
    expect(d[0]!.count).toBe(1); expect(d[7]!.count).toBe(1); expect(d[9]!.count).toBe(2)
  })
})

describe('locationStats', () => {
  it('rolls up copies, distinct albums and spend per location', () => {
    const m = locationStats([{ id: 'L1' }, { id: 'L2' }, { id: 'L3' }], copies)
    expect(m.get('L1')).toEqual({ copyCount: 3, albumIds: ['a', 'b'], spend: { USD: 50.5 } })
    expect(m.get('L2')).toEqual({ copyCount: 1, albumIds: ['c'], spend: { EUR: 15 } })
    expect(m.get('L3')).toEqual({ copyCount: 0, albumIds: [], spend: {} })
  })
})
