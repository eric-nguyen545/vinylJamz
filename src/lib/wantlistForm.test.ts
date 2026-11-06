import { describe, expect, it } from 'vitest'
import { emptyWantForm, formToWant, wantToForm, PRIORITY_RANK } from './wantlistForm'
import { ACTIVE_WANT_STATUSES, wantlistInputSchema } from './schemas'

describe('wantlist form', () => {
  it('accepts an empty form with medium priority and want status', () => {
    const r = formToWant(emptyWantForm())
    expect(r.ok).toBe(true)
    if (r.ok) { expect(r.value.priority).toBe('medium'); expect(r.value.status).toBe('want'); expect(r.value.targetPrice).toBeUndefined(); expect(r.value.currency).toBeUndefined() }
  })
  it('keeps currency only with a target price', () => {
    const r = formToWant({ ...emptyWantForm('EUR'), targetPrice: '35.5' })
    expect(r.ok && [r.value.targetPrice, r.value.currency]).toEqual([35.5, 'EUR'])
  })
  it('rejects negative or non-numeric prices', () => {
    for (const targetPrice of ['-1', 'abc']) {
      const r = formToWant({ ...emptyWantForm(), targetPrice })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.errors.targetPrice).toBeTruthy()
    }
  })
  it('round-trips stored values into the form', () => {
    const f = wantToForm({ priority: 'high', status: 'found', targetPrice: 40, currency: 'GBP', notes: 'n', desiredReleaseId: 'r1' })
    expect(f).toMatchObject({ priority: 'high', status: 'found', targetPrice: '40', currency: 'GBP', notes: 'n', desiredReleaseId: 'r1' })
  })
  it('ranks priorities and treats purchased/passed items as inactive', () => {
    expect(PRIORITY_RANK.high).toBeGreaterThan(PRIORITY_RANK.medium)
    expect(PRIORITY_RANK.medium).toBeGreaterThan(PRIORITY_RANK.low)
    expect(ACTIVE_WANT_STATUSES).toEqual(['want', 'researching', 'found'])
  })
  it('schema carries a display snapshot but still requires an albumId', () => {
    expect(wantlistInputSchema.safeParse({ albumTitle: 'T' }).success).toBe(false)
    expect(wantlistInputSchema.safeParse({ albumId: 'a', albumTitle: 'T', primaryArtist: 'A', releaseYear: 1979 }).success).toBe(true)
  })
})
