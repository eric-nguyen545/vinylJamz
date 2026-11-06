import type { PriceObservationInput } from './schemas'

export type ObsType = PriceObservationInput['observationType']
export type Obs = Pick<PriceObservationInput, 'albumId' | 'copyId' | 'price' | 'currency' | 'observationType' | 'observedAt'>

export const TYPE_LABEL: Record<ObsType, string> = { sold: 'Sold price', estimate: 'Estimate', listing: 'Asking price', manual: 'Noted price' }
export const TYPE_HELP: Record<ObsType, string> = {
  sold: 'What a copy actually sold for.',
  estimate: 'A guide price from a source or your own judgment.',
  listing: 'What sellers are asking. Not what records sell for.',
  manual: 'A price you noted without saying what it means.',
}
/** When one number is needed, completed sales outrank estimates, which outrank asking prices. */
export const TYPE_PREFERENCE: ObsType[] = ['sold', 'estimate', 'listing', 'manual']

const newest = <T extends Pick<Obs, 'observedAt'>>(list: T[]) => [...list].sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0]

/** Newest observation of each type. Types are never merged. */
export function latestByType<T extends Obs>(obs: T[]): Partial<Record<ObsType, T>> {
  const out: Partial<Record<ObsType, T>> = {}
  for (const t of TYPE_PREFERENCE) { const hit = newest(obs.filter((o) => o.observationType === t)); if (hit) out[t] = hit }
  return out
}

export function pickValue<T extends Obs>(obs: T[]): T | undefined {
  const latest = latestByType(obs)
  for (const t of TYPE_PREFERENCE) if (latest[t]) return latest[t]
  return undefined
}

export interface ValueRow { currency: string; total: number; valuedCopies: number; basis: Record<ObsType, number> }
export interface CollectionValue { rows: ValueRow[]; unvalued: number; totalCopies: number }

/**
 * Rough collection value. For each copy: observations tied to that copy win; otherwise the album-level
 * observations apply. One price per copy is chosen by type preference, then summed per currency.
 */
export function collectionValue(copies: { id: string; albumId: string }[], obs: Obs[]): CollectionValue {
  const rows = new Map<string, ValueRow>()
  let unvalued = 0
  for (const c of copies) {
    const own = obs.filter((o) => o.copyId === c.id)
    const pool = own.length ? own : obs.filter((o) => !o.copyId && o.albumId === c.albumId)
    const v = pickValue(pool)
    if (!v) { unvalued++; continue }
    const r = rows.get(v.currency) ?? { currency: v.currency, total: 0, valuedCopies: 0, basis: { sold: 0, estimate: 0, listing: 0, manual: 0 } }
    r.total = Math.round((r.total + v.price) * 100) / 100
    r.valuedCopies++
    r.basis[v.observationType]++
    rows.set(v.currency, r)
  }
  return { rows: [...rows.values()].sort((a, b) => b.valuedCopies - a.valuedCopies), unvalued, totalCopies: copies.length }
}
