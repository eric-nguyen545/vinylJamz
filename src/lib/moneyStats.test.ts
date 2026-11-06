import { describe, expect, it } from 'vitest'
import { cumulativeInvestment, currenciesIn, gearByCategory, gearWithoutPrice, genrePie, investmentTotals, purchasePoints, undatedCount } from './stats'

const copies = [
  { albumId: 'a', purchasePrice: 20, currency: 'USD', purchaseDate: '2025-01-05' },
  { albumId: 'b', purchasePrice: 30, currency: 'USD', purchaseDate: '2025-03-20' },
  { albumId: 'c', purchasePrice: 15, currency: 'EUR', purchaseDate: '2025-03-02' },
  { albumId: 'd', purchasePrice: 10, currency: 'USD' },
  { albumId: 'e' },
]
const gear = [
  { category: 'turntable', purchasePrice: 300, currency: 'USD', purchaseDate: '2025-02-14' },
  { category: 'speakers', purchasePrice: 500, currency: 'USD', purchaseDate: '2025-02-20' },
  { category: 'cables', purchasePrice: 25.5, currency: 'USD' },
  { category: 'accessories' },
  { category: 'amplifier', purchasePrice: 200, currency: 'EUR', purchaseDate: '2025-05-01' },
]

describe('investmentTotals', () => {
  it('splits records and gear per currency and never mixes currencies', () => {
    const t = investmentTotals(copies, gear)
    expect(t.find((r) => r.currency === 'USD')).toEqual({ currency: 'USD', records: 60, gear: 825.5, total: 885.5, recordCopies: 3, gearItems: 3 })
    expect(t.find((r) => r.currency === 'EUR')).toEqual({ currency: 'EUR', records: 15, gear: 200, total: 215, recordCopies: 1, gearItems: 1 })
    expect(t).toHaveLength(2)
  })
  it('lists currencies with the most-used first', () => { expect(currenciesIn(copies, gear)).toEqual(['USD', 'EUR']) })
  it('counts unpriced gear so it can be disclosed', () => { expect(gearWithoutPrice(gear)).toBe(1) })
  it('handles no data', () => { expect(investmentTotals([], [])).toEqual([]) })
})

describe('gearByCategory', () => {
  it('totals per category in one currency, largest first', () => {
    expect(gearByCategory(gear, 'USD')).toEqual([{ category: 'speakers', total: 500, items: 1 }, { category: 'turntable', total: 300, items: 1 }, { category: 'cables', total: 25.5, items: 1 }])
  })
})

describe('genrePie', () => {
  it('counts each album once under its first genre so slices sum to the collection', () => {
    const p = genrePie([{ genres: ['Jazz', 'Bop'] }, { genres: ['jazz'] }, { genres: ['Rock', 'Jazz'] }, { genres: [] }, { genres: ['  '] }])
    expect(p.reduce((n, s) => n + s.count, 0)).toBe(5)
    expect(p[0]).toEqual({ name: 'Jazz', count: 2 })
    expect(p).toContainEqual({ name: 'No genre', count: 2 })
  })
  it('merges the tail into Other past the top N', () => {
    const albums = ['A', 'B', 'C', 'D', 'E'].flatMap((g, i) => Array.from({ length: 5 - i }, () => ({ genres: [g] })))
    const p = genrePie(albums, 3)
    expect(p.map((s) => s.name)).toEqual(['A', 'B', 'C', 'Other'])
    expect(p.at(-1)!.count).toBe(3)
  })
})

describe('cumulativeInvestment', () => {
  it('builds running totals, fills empty months, and keeps records and gear separate', () => {
    const s = cumulativeInvestment(copies, gear, 'USD')
    expect(s.map((x) => x.month)).toEqual(['2025-01', '2025-02', '2025-03'])
    expect(s[0]).toEqual({ month: '2025-01', records: 20, gear: 0, total: 20 })
    expect(s[1]).toEqual({ month: '2025-02', records: 20, gear: 800, total: 820 })
    expect(s[2]).toEqual({ month: '2025-03', records: 50, gear: 800, total: 850 })
  })
  it('fills gaps between purchases', () => {
    const s = cumulativeInvestment([{ purchasePrice: 10, currency: 'USD', purchaseDate: '2025-01-01' }, { purchasePrice: 5, currency: 'USD', purchaseDate: '2025-04-01' }], [], 'USD')
    expect(s.map((x) => x.total)).toEqual([10, 10, 10, 15])
  })
  it('crosses year boundaries and returns nothing for an empty currency', () => {
    const s = cumulativeInvestment([{ purchasePrice: 1, currency: 'USD', purchaseDate: '2024-12-31' }, { purchasePrice: 1, currency: 'USD', purchaseDate: '2025-02-01' }], [], 'USD')
    expect(s.map((x) => x.month)).toEqual(['2024-12', '2025-01', '2025-02'])
    expect(cumulativeInvestment(copies, gear, 'JPY')).toEqual([])
  })
  it('counts priced items with no usable date', () => {
    expect(undatedCount(copies, 'USD')).toBe(1)
    expect(undatedCount(gear, 'USD')).toBe(1)
  })
})

describe('purchasePoints', () => {
  it('returns dated, priced purchases in one currency in date order with titles', () => {
    const pts = purchasePoints(copies, (id) => `Album ${id}`, 'USD')
    expect(pts.map((p) => [p.date, p.price, p.title])).toEqual([['2025-01-05', 20, 'Album a'], ['2025-03-20', 30, 'Album b']])
    expect(pts[0]!.t).toBeLessThan(pts[1]!.t)
  })
})
