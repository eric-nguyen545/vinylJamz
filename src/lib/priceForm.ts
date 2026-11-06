import { priceObservationInputSchema, type PriceObservationInput } from './schemas'
import type { FormErrors, Result } from './formState'
import { todayLocal } from './format'

export interface PriceFormState {
  type: 'sold' | 'listing' | 'estimate'
  price: string; currency: string; observedAt: string; copyId: string; condition: string; sourceUrl: string
}

export const emptyPriceForm = (currency = 'USD', today = todayLocal()): PriceFormState => ({ type: 'sold', price: '', currency, observedAt: today, copyId: '', condition: '', sourceUrl: '' })

export function formToObservation(f: PriceFormState, albumId: string, today = todayLocal()): Result<PriceObservationInput> {
  const errors: FormErrors = {}
  const price = f.price.trim() === '' ? NaN : Number(f.price)
  if (!Number.isFinite(price) || price <= 0) errors.price = 'Enter a price greater than 0.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.observedAt)) errors.observedAt = 'Enter a valid date.'
  else if (f.observedAt > today) errors.observedAt = 'The date can’t be in the future.'
  if (Object.keys(errors).length) return { ok: false, errors }
  const parsed = priceObservationInputSchema.safeParse({
    albumId, copyId: f.copyId || undefined, provider: 'manual', observationType: f.type, price, currency: f.currency,
    condition: f.condition.trim() || undefined, observedAt: f.observedAt, sourceUrl: f.sourceUrl.trim() || undefined, dataQuality: 'manual',
  })
  if (parsed.success) return { ok: true, value: parsed.data }
  for (const i of parsed.error.issues) errors[String(i.path[0] ?? 'form')] ??= i.message
  return { ok: false, errors }
}
