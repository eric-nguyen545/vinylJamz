import { z } from 'zod'
import {
  albumInputSchema, copyInputSchema, gearInputSchema, listeningSessionInputSchema, preferencesSchema, priceObservationInputSchema,
  purchaseLocationInputSchema, reviewInputSchema, wantlistInputSchema,
} from './schemas'

/** Order matters: parents are written before the records that point at them. */
export const BACKUP_COLLECTIONS = ['purchaseLocations', 'albums', 'copies', 'reviews', 'wantlist', 'listeningSessions', 'priceObservations', 'gear'] as const
export type CollectionKey = (typeof BACKUP_COLLECTIONS)[number]

export const COLLECTION_LABEL: Record<CollectionKey, string> = {
  purchaseLocations: 'Locations', albums: 'Albums', copies: 'Copies', reviews: 'Reviews', wantlist: 'Wantlist items',
  listeningSessions: 'Listens', priceObservations: 'Prices', gear: 'Gear',
}

const SCHEMAS: Record<CollectionKey, z.ZodType<Record<string, unknown>>> = {
  purchaseLocations: purchaseLocationInputSchema, albums: albumInputSchema, copies: copyInputSchema, reviews: reviewInputSchema,
  wantlist: wantlistInputSchema, listeningSessions: listeningSessionInputSchema, priceObservations: priceObservationInputSchema, gear: gearInputSchema,
}

export const BACKUP_FORMAT = 'vinyl-archive-backup'
export const BACKUP_VERSION = 1
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024
export const MAX_BACKUP_DOCS = 50_000
const ID_PATTERN = /^[A-Za-z0-9_-]{1,120}$/

export interface RawDoc { id: string; createdAt?: string; data: Record<string, unknown> }
export interface Backup {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  preferences?: unknown
  collections: Record<CollectionKey, unknown[]>
}

export function buildBackup(docs: Record<CollectionKey, RawDoc[]>, preferences: unknown, now = new Date()): Backup {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), ...(preferences ? { preferences } : {}), collections: docs }
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string }

export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: 'That file is larger than 25 MB, so it can’t be a Vinyl Archive backup.' }
  let json: unknown
  try { json = JSON.parse(text) } catch { return { ok: false, error: 'That file isn’t valid JSON.' } }
  const env = z.object({
    format: z.literal(BACKUP_FORMAT), version: z.number(), exportedAt: z.string().optional(), preferences: z.unknown().optional(),
    collections: z.record(z.string(), z.array(z.unknown())),
  }).safeParse(json)
  if (!env.success) return { ok: false, error: 'This doesn’t look like a Vinyl Archive backup file.' }
  if (env.data.version > BACKUP_VERSION) return { ok: false, error: `This backup is from a newer version (${env.data.version}). Update the app before importing it.` }
  const collections = Object.fromEntries(BACKUP_COLLECTIONS.map((k) => [k, env.data.collections[k] ?? []])) as Record<CollectionKey, unknown[]>
  const total = BACKUP_COLLECTIONS.reduce((n, k) => n + collections[k].length, 0)
  if (total > MAX_BACKUP_DOCS) return { ok: false, error: `This backup has ${total} records, more than the ${MAX_BACKUP_DOCS} this importer accepts.` }
  return { ok: true, backup: { format: BACKUP_FORMAT, version: env.data.version, exportedAt: env.data.exportedAt ?? '', preferences: env.data.preferences, collections } }
}

/** JSON with sorted keys, so equal data compares equal regardless of key order. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v) ?? 'null'
}

export interface ExistingData {
  docs: Record<CollectionKey, Record<string, Record<string, unknown>>>
  preferences: Record<string, unknown> | null
}

export type ImportOp =
  | { kind: 'set'; collection: CollectionKey; id: string; data: Record<string, unknown>; createdAt?: string }
  | { kind: 'albumCounts'; id: string; copyCount: number; owned: boolean }
  | { kind: 'prefs'; data: Record<string, unknown> }

export interface CollectionSummary { total: number; new: number; unchanged: number; changed: number; invalid: number; orphan: number }
export interface Problem { collection: CollectionKey; id: string; reason: string }
export interface ImportPlan {
  summary: Record<CollectionKey, CollectionSummary>
  invalid: Problem[]
  orphans: Problem[]
  ops: ImportOp[]
  /** Changed records that will be left as they are because overwrite is off. */
  skippedChanged: number
  preferences: 'none' | 'new' | 'unchanged' | 'changed' | 'invalid'
}

const emptySummary = (): CollectionSummary => ({ total: 0, new: 0, unchanged: 0, changed: 0, invalid: 0, orphan: 0 })
const albumIdOf = (key: CollectionKey, id: string, data: Record<string, unknown>) => (key === 'reviews' ? id : String(data.albumId ?? ''))
const DEPENDS_ON_ALBUM: CollectionKey[] = ['copies', 'reviews', 'wantlist', 'listeningSessions', 'priceObservations']
/** Fields derived from copies, ignored when deciding whether an album "changed". */
const DERIVED = ['copyCount', 'owned']

const comparable = (key: CollectionKey, data: Record<string, unknown>) => {
  if (key !== 'albums') return stableStringify(data)
  const copy = { ...data }
  DERIVED.forEach((k) => delete copy[k])
  return stableStringify(copy)
}

/**
 * Pure planning step: validates every record, classifies it against what's already saved, and lists
 * exactly what would be written. Nothing here touches the database, and nothing is ever deleted.
 */
export function planImport(backup: Backup, existing: ExistingData, opts: { overwrite: boolean }): ImportPlan {
  const summary = Object.fromEntries(BACKUP_COLLECTIONS.map((k) => [k, emptySummary()])) as Record<CollectionKey, CollectionSummary>
  const invalid: Problem[] = [], orphans: Problem[] = []
  const valid = Object.fromEntries(BACKUP_COLLECTIONS.map((k) => [k, [] as { id: string; data: Record<string, unknown>; createdAt?: string }[]])) as Record<CollectionKey, { id: string; data: Record<string, unknown>; createdAt?: string }[]>

  for (const key of BACKUP_COLLECTIONS) {
    const seen = new Set<string>()
    for (const raw of backup.collections[key]) {
      summary[key].total++
      const doc = raw as { id?: unknown; createdAt?: unknown; data?: unknown }
      const id = typeof doc?.id === 'string' ? doc.id : ''
      const bad = (reason: string) => { summary[key].invalid++; invalid.push({ collection: key, id: id || '(no id)', reason }) }
      if (!ID_PATTERN.test(id)) { bad('Missing or unsafe ID'); continue }
      if (seen.has(id)) { bad('Duplicate ID in file'); continue }
      seen.add(id)
      if (!doc.data || typeof doc.data !== 'object' || Array.isArray(doc.data)) { bad('Missing data'); continue }
      const parsed = SCHEMAS[key].safeParse(doc.data)
      if (!parsed.success) { const i = parsed.error.issues[0]; bad(`${i?.path.join('.') || 'record'}: ${i?.message ?? 'invalid'}`); continue }
      valid[key].push({ id, data: parsed.data, createdAt: typeof doc.createdAt === 'string' ? doc.createdAt : undefined })
    }
  }

  // Records that point at an album nobody has are skipped, not guessed at.
  const albumIds = new Set([...valid.albums.map((d) => d.id), ...Object.keys(existing.docs.albums)])
  for (const key of DEPENDS_ON_ALBUM) {
    valid[key] = valid[key].filter((d) => {
      if (albumIds.has(albumIdOf(key, d.id, d.data))) return true
      summary[key].orphan++; orphans.push({ collection: key, id: d.id, reason: 'Its album isn’t in the backup or in your library' })
      return false
    })
  }

  const writes: { collection: CollectionKey; id: string; data: Record<string, unknown>; createdAt?: string }[] = []
  let skippedChanged = 0
  for (const key of BACKUP_COLLECTIONS) {
    for (const d of valid[key]) {
      const ex = existing.docs[key][d.id]
      let status: 'new' | 'unchanged' | 'changed' = 'new'
      if (ex) {
        const exParsed = SCHEMAS[key].safeParse(ex)
        status = exParsed.success && comparable(key, exParsed.data) === comparable(key, d.data) ? 'unchanged' : 'changed'
      }
      summary[key][status]++
      if (status === 'new' || (status === 'changed' && opts.overwrite)) writes.push({ collection: key, ...d })
      else if (status === 'changed') skippedChanged++
    }
  }

  // Recompute copyCount/owned for every album the import touches.
  const copyAlbum = new Map(Object.entries(existing.docs.copies).map(([id, raw]) => [id, String(raw.albumId ?? '')]))
  const affected = new Set<string>(writes.filter((w) => w.collection === 'albums').map((w) => w.id))
  for (const w of writes.filter((x) => x.collection === 'copies')) {
    const prev = copyAlbum.get(w.id); if (prev) affected.add(prev)
    copyAlbum.set(w.id, String(w.data.albumId)); affected.add(String(w.data.albumId))
  }
  const counts = new Map<string, number>()
  for (const a of copyAlbum.values()) counts.set(a, (counts.get(a) ?? 0) + 1)

  const ops: ImportOp[] = []
  const writtenAlbums = new Set(writes.filter((w) => w.collection === 'albums').map((w) => w.id))
  for (const key of BACKUP_COLLECTIONS) {
    for (const w of writes.filter((x) => x.collection === key)) {
      const data = key === 'albums' ? { ...w.data, copyCount: counts.get(w.id) ?? 0, owned: (counts.get(w.id) ?? 0) > 0 } : w.data
      ops.push({ kind: 'set', collection: key, id: w.id, data, createdAt: w.createdAt })
    }
  }
  for (const id of affected) {
    if (writtenAlbums.has(id)) continue
    const stored = existing.docs.albums[id]
    if (!stored) continue
    const n = counts.get(id) ?? 0
    if (stored.copyCount !== n || stored.owned !== n > 0) ops.push({ kind: 'albumCounts', id, copyCount: n, owned: n > 0 })
  }

  let preferences: ImportPlan['preferences'] = 'none'
  if (backup.preferences !== undefined) {
    const p = preferencesSchema.safeParse(backup.preferences)
    if (!p.success) preferences = 'invalid'
    else {
      const ex = existing.preferences ? preferencesSchema.safeParse(existing.preferences) : null
      preferences = !existing.preferences ? 'new' : ex?.success && stableStringify(ex.data) === stableStringify(p.data) ? 'unchanged' : 'changed'
      if (preferences === 'new' || (preferences === 'changed' && opts.overwrite)) ops.push({ kind: 'prefs', data: p.data })
    }
  }

  return { summary, invalid, orphans, ops, skippedChanged, preferences }
}
