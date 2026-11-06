import type { AlbumInput, CopyInput, ReviewInput } from './schemas'
import type { StoredLocation } from './locationsRepo'

type PricedCopy = Pick<CopyInput, 'purchasePrice' | 'currency' | 'purchaseDate'>
const round2 = (n: number) => Math.round(n * 100) / 100

export interface CurrencyTotal { currency: string; total: number; copies: number; average: number }

/** Totals per currency. Currencies are never mixed or converted. */
export function spendingTotals(copies: PricedCopy[]): CurrencyTotal[] {
  const acc = new Map<string, { total: number; copies: number }>()
  for (const c of copies) {
    if (c.purchasePrice === undefined || !c.currency) continue
    const e = acc.get(c.currency) ?? { total: 0, copies: 0 }
    e.total += c.purchasePrice; e.copies += 1
    acc.set(c.currency, e)
  }
  return [...acc].map(([currency, e]) => ({ currency, total: round2(e.total), copies: e.copies, average: round2(e.total / e.copies) }))
    .sort((a, b) => b.copies - a.copies)
}

export const copiesWithoutPrice = (copies: PricedCopy[]) => copies.filter((c) => c.purchasePrice === undefined).length

export function spendingByMonth(copies: PricedCopy[], currency: string): { month: string; total: number }[] {
  const acc = new Map<string, number>()
  for (const c of copies) {
    if (c.purchasePrice === undefined || c.currency !== currency || !c.purchaseDate || !/^\d{4}-\d{2}/.test(c.purchaseDate)) continue
    const m = c.purchaseDate.slice(0, 7)
    acc.set(m, (acc.get(m) ?? 0) + c.purchasePrice)
  }
  return [...acc].map(([month, total]) => ({ month, total: round2(total) })).sort((a, b) => a.month.localeCompare(b.month))
}

const top = (counts: Map<string, number>, n: number) =>
  [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, n)

/** An album with several genres counts once toward each. */
export function genreCounts(albums: Pick<AlbumInput, 'genres'>[], n = 10) {
  const m = new Map<string, number>()
  for (const a of albums) for (const g of new Set(a.genres.map((x) => x.trim().toLowerCase()).filter(Boolean))) m.set(g, (m.get(g) ?? 0) + 1)
  return top(m, n)
}

export function topArtists(albums: Pick<AlbumInput, 'primaryArtist'>[], n = 10) {
  const m = new Map<string, number>()
  for (const a of albums) m.set(a.primaryArtist, (m.get(a.primaryArtist) ?? 0) + 1)
  return top(m, n)
}

export function decadeCounts(albums: Pick<AlbumInput, 'releaseYear'>[]): { rows: { decade: string; count: number }[]; missing: number } {
  const m = new Map<number, number>()
  let missing = 0
  for (const a of albums) {
    if (a.releaseYear === undefined) { missing++; continue }
    const d = Math.floor(a.releaseYear / 10) * 10
    m.set(d, (m.get(d) ?? 0) + 1)
  }
  return { rows: [...m].sort((a, b) => a[0] - b[0]).map(([d, count]) => ({ decade: `${d}s`, count })), missing }
}

/** Ratings are canonical 0-10; bucketed 0-1 ... 9-10 (10 falls in the top bucket). */
export function ratingDistribution(reviews: Pick<ReviewInput, 'rating'>[]): { bucket: string; count: number }[] {
  const counts = Array.from({ length: 10 }, () => 0)
  for (const r of reviews) if (r.rating !== undefined) counts[Math.min(9, Math.floor(r.rating))]!++
  return counts.map((count, i) => ({ bucket: `${i}–${i + 1}`, count }))
}

export function priciest<T extends PricedCopy>(copies: T[], currency: string, n = 5): T[] {
  return copies.filter((c) => c.currency === currency && c.purchasePrice !== undefined)
    .sort((a, b) => (b.purchasePrice ?? 0) - (a.purchasePrice ?? 0)).slice(0, n)
}

export interface LocationStat { copyCount: number; albumIds: string[]; spend: Record<string, number> }

/** Per-location rollup used by map popups and the location list. */
export function locationStats(
  locations: Pick<StoredLocation, 'id'>[], copies: Array<Pick<CopyInput, 'albumId' | 'purchaseLocationId' | 'purchasePrice' | 'currency'>>,
): Map<string, LocationStat> {
  const out = new Map<string, LocationStat>(locations.map((l) => [l.id, { copyCount: 0, albumIds: [], spend: {} }]))
  for (const c of copies) {
    const s = c.purchaseLocationId ? out.get(c.purchaseLocationId) : undefined
    if (!s) continue
    s.copyCount++
    if (!s.albumIds.includes(c.albumId)) s.albumIds.push(c.albumId)
    if (c.purchasePrice !== undefined && c.currency) s.spend[c.currency] = round2((s.spend[c.currency] ?? 0) + c.purchasePrice)
  }
  return out
}

/* ---------------- money: records + gear ---------------- */
type PricedGear = { purchasePrice?: number; currency?: string; purchaseDate?: string; category: string }

export interface InvestmentRow { currency: string; records: number; gear: number; total: number; recordCopies: number; gearItems: number }

/** Records and gear spend per currency. Currencies are never converted or summed together. */
export function investmentTotals(copies: PricedCopy[], gear: PricedGear[]): InvestmentRow[] {
  const m = new Map<string, InvestmentRow>()
  const row = (c: string) => { let r = m.get(c); if (!r) { r = { currency: c, records: 0, gear: 0, total: 0, recordCopies: 0, gearItems: 0 }; m.set(c, r) } return r }
  for (const c of copies) if (c.purchasePrice !== undefined && c.currency) { const r = row(c.currency); r.records += c.purchasePrice; r.recordCopies++ }
  for (const g of gear) if (g.purchasePrice !== undefined && g.currency) { const r = row(g.currency); r.gear += g.purchasePrice; r.gearItems++ }
  return [...m.values()].map((r) => ({ ...r, records: round2(r.records), gear: round2(r.gear), total: round2(r.records + r.gear) }))
    .sort((a, b) => b.recordCopies + b.gearItems - (a.recordCopies + a.gearItems))
}

export function gearByCategory(gear: PricedGear[], currency: string): { category: string; total: number; items: number }[] {
  const m = new Map<string, { total: number; items: number }>()
  for (const g of gear) {
    if (g.purchasePrice === undefined || g.currency !== currency) continue
    const e = m.get(g.category) ?? { total: 0, items: 0 }
    e.total += g.purchasePrice; e.items++
    m.set(g.category, e)
  }
  return [...m].map(([category, e]) => ({ category, total: round2(e.total), items: e.items })).sort((a, b) => b.total - a.total)
}

export const gearWithoutPrice = (gear: PricedGear[]) => gear.filter((g) => g.purchasePrice === undefined).length

const OTHER_COLOR_KEY = 'Other'
/**
 * Slices for a "genres you own" pie. Each album counts once, under its FIRST genre, so the slices
 * add up to the collection. Beyond topN, genres are merged into "Other"; albums with no genre are "No genre".
 */
export function genrePie(albums: { genres: string[] }[], topN = 8): { name: string; count: number }[] {
  const counts = new Map<string, { name: string; count: number }>()
  for (const a of albums) {
    const first = a.genres.map((g) => g.trim()).find(Boolean)
    const key = first ? first.toLowerCase() : '\u0000none'
    const e = counts.get(key) ?? { name: first ?? 'No genre', count: 0 }
    e.count++
    counts.set(key, e)
  }
  const sorted = [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  if (sorted.length <= topN) return sorted
  const rest = sorted.slice(topN).reduce((n, g) => n + g.count, 0)
  return [...sorted.slice(0, topN), { name: OTHER_COLOR_KEY, count: rest }]
}

const monthIndex = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1
const monthFromIndex = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
const validMonth = (d?: string) => !!d && /^\d{4}-\d{2}/.test(d)

/** Running totals by month (records and gear separately), with empty months filled so the line is continuous. */
export function cumulativeInvestment(copies: PricedCopy[], gear: PricedGear[], currency: string): { month: string; records: number; gear: number; total: number }[] {
  const rec = new Map<string, number>(), gea = new Map<string, number>()
  for (const c of copies) if (c.purchasePrice !== undefined && c.currency === currency && validMonth(c.purchaseDate)) rec.set(c.purchaseDate!.slice(0, 7), (rec.get(c.purchaseDate!.slice(0, 7)) ?? 0) + c.purchasePrice)
  for (const g of gear) if (g.purchasePrice !== undefined && g.currency === currency && validMonth(g.purchaseDate)) gea.set(g.purchaseDate!.slice(0, 7), (gea.get(g.purchaseDate!.slice(0, 7)) ?? 0) + g.purchasePrice)
  const months = [...rec.keys(), ...gea.keys()].map(monthIndex)
  if (!months.length) return []
  const out: { month: string; records: number; gear: number; total: number }[] = []
  let r = 0, g = 0
  for (let i = Math.min(...months); i <= Math.max(...months); i++) {
    const key = monthFromIndex(i)
    r += rec.get(key) ?? 0; g += gea.get(key) ?? 0
    out.push({ month: key, records: round2(r), gear: round2(g), total: round2(r + g) })
  }
  return out
}

/** Copies and gear that have a price in this currency but no usable date (so they're missing from time charts). */
export function undatedCount(items: PricedCopy[] | PricedGear[], currency: string): number {
  return (items as PricedCopy[]).filter((x) => x.purchasePrice !== undefined && x.currency === currency && !validMonth(x.purchaseDate)).length
}

export interface PurchasePoint { t: number; date: string; price: number; title: string }

/** One dot per priced, dated record purchase, for the "every purchase" plot. */
export function purchasePoints(copies: Array<PricedCopy & { albumId: string }>, titleOf: (albumId: string) => string, currency: string): PurchasePoint[] {
  const out: PurchasePoint[] = []
  for (const c of copies) {
    if (c.purchasePrice === undefined || c.currency !== currency || !c.purchaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(c.purchaseDate)) continue
    const [y, m, d] = c.purchaseDate.split('-').map(Number) as [number, number, number]
    out.push({ t: new Date(y, m - 1, d).getTime(), date: c.purchaseDate, price: c.purchasePrice, title: titleOf(c.albumId) })
  }
  return out.sort((a, b) => a.t - b.t)
}

/** Currencies present anywhere in records or gear, most-used first. */
export function currenciesIn(copies: PricedCopy[], gear: PricedGear[]): string[] {
  return investmentTotals(copies, gear).map((r) => r.currency)
}
