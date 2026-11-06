import { describe, expect, it } from 'vitest'
import { albumInputSchema, copyInputSchema, defaultPreferences, priceObservationInputSchema, reviewInputSchema, wantlistInputSchema } from './schemas'

describe('schemas', () => {
  it('requires album title and at least one artist', () => {
    expect(albumInputSchema.safeParse({ title: '', sortTitle: '', artistNames: [], primaryArtist: '' }).success).toBe(false)
  })
  it('applies safe defaults', () => {
    const a = albumInputSchema.parse({ title: 'T', sortTitle: 't', artistNames: ['A'], primaryArtist: 'A' })
    expect(a.genres).toEqual([]); expect(a.archived).toBe(false)
  })
  it('keeps copies separate from albums and validates dates', () => {
    expect(copyInputSchema.safeParse({ albumId: 'a', purchaseDate: '01/02/2024' }).success).toBe(false)
    expect(copyInputSchema.safeParse({ albumId: 'a', purchaseDate: '2024-01-02', purchasePrice: 25, currency: 'USD' }).success).toBe(true)
  })
  it('limits top tracks to three', () => {
    expect(reviewInputSchema.safeParse({ topThreeTrackIds: ['1', '2', '3', '4'] }).success).toBe(false)
  })
  it('wantlist defaults to medium priority / want status', () => {
    const w = wantlistInputSchema.parse({ albumId: 'a' })
    expect(w.priority).toBe('medium'); expect(w.status).toBe('want')
  })
  it('distinguishes observation types and rejects bad currency', () => {
    const base = { albumId: 'a', provider: 'manual', price: 10, observedAt: '2025-01-01', currency: 'USD' }
    expect(priceObservationInputSchema.safeParse({ ...base, observationType: 'sold' }).success).toBe(true)
    expect(priceObservationInputSchema.safeParse({ ...base, observationType: 'average' }).success).toBe(false)
    expect(priceObservationInputSchema.safeParse({ ...base, observationType: 'sold', currency: 'dollars' }).success).toBe(false)
  })
  it('default preferences are a 0-10 scale in USD', () => {
    expect(defaultPreferences).toEqual({ ratingMax: 10, defaultCurrency: 'USD' })
  })
})
