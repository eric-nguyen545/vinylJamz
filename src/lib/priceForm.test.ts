import { describe, expect, it } from 'vitest'
import { emptyPriceForm, formToObservation } from './priceForm'

const today = '2026-03-10'
describe('price form', () => {
  it('requires a positive price', () => {
    for (const price of ['', '0', '-5', 'abc']) expect(formToObservation({ ...emptyPriceForm('USD', today), price }, 'a1', today).ok).toBe(false)
  })
  it('rejects future and malformed dates', () => {
    expect(formToObservation({ ...emptyPriceForm('USD', today), price: '10', observedAt: '2026-03-11' }, 'a1', today).ok).toBe(false)
    expect(formToObservation({ ...emptyPriceForm('USD', today), price: '10', observedAt: 'yesterday' }, 'a1', today).ok).toBe(false)
  })
  it('builds a manual observation with the chosen meaning', () => {
    const r = formToObservation({ ...emptyPriceForm('EUR', today), type: 'listing', price: '45.5', copyId: 'c1', condition: 'VG+' }, 'a1', today)
    expect(r.ok && r.value).toMatchObject({ albumId: 'a1', copyId: 'c1', provider: 'manual', observationType: 'listing', price: 45.5, currency: 'EUR', condition: 'VG+', dataQuality: 'manual' })
  })
  it('treats a blank copy as album-level and rejects bad URLs', () => {
    const r = formToObservation({ ...emptyPriceForm('USD', today), price: '10' }, 'a1', today)
    expect(r.ok && r.value.copyId).toBeUndefined()
    expect(formToObservation({ ...emptyPriceForm('USD', today), price: '10', sourceUrl: 'not a url' }, 'a1', today).ok).toBe(false)
  })
})
