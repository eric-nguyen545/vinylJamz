import { wantlistInputSchema, WANT_STATUSES, type WantStatus } from './schemas'
import type { FormErrors, Result } from './formState'
import type { WantEditable } from './wantlistRepo'

export interface WantFormState {
  priority: 'low' | 'medium' | 'high'
  status: WantStatus
  targetPrice: string
  currency: string
  desiredPressingNotes: string
  notes: string
  desiredReleaseId: string
}

export const STATUS_LABEL: Record<WantStatus, string> = {
  want: 'Want', researching: 'Researching', found: 'Found one', purchased: 'Purchased', 'no-longer-interested': 'No longer interested',
}
export const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' } as const
export const PRIORITY_RANK = { high: 3, medium: 2, low: 1 } as const

export const emptyWantForm = (currency = 'USD'): WantFormState => ({
  priority: 'medium', status: 'want', targetPrice: '', currency, desiredPressingNotes: '', notes: '', desiredReleaseId: '',
})

export function wantToForm(w: Partial<WantEditable>, currency = 'USD'): WantFormState {
  return {
    priority: w.priority ?? 'medium', status: w.status ?? 'want',
    targetPrice: w.targetPrice === undefined ? '' : String(w.targetPrice), currency: w.currency ?? currency,
    desiredPressingNotes: w.desiredPressingNotes ?? '', notes: w.notes ?? '', desiredReleaseId: w.desiredReleaseId ?? '',
  }
}

export function formToWant(f: WantFormState): Result<WantEditable> {
  const price = f.targetPrice.trim() === '' ? undefined : Number(f.targetPrice)
  const parsed = wantlistInputSchema.omit({ albumId: true, albumTitle: true, primaryArtist: true, artworkUrl: true, releaseYear: true, purchasedCopyId: true }).safeParse({
    priority: f.priority, status: f.status, targetPrice: price, currency: price !== undefined ? f.currency : undefined,
    desiredPressingNotes: f.desiredPressingNotes.trim() || undefined, notes: f.notes.trim() || undefined,
    desiredReleaseId: f.desiredReleaseId.trim() || undefined,
  })
  if (parsed.success) return { ok: true, value: parsed.data }
  const errors: FormErrors = {}
  for (const i of parsed.error.issues) errors[String(i.path[0] ?? 'form')] ??= i.message
  return { ok: false, errors }
}

export { WANT_STATUSES }
