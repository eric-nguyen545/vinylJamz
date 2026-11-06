import { describe, expect, it } from 'vitest'
import { BACKUP_COLLECTIONS, MAX_BACKUP_BYTES, buildBackup, parseBackup, planImport, stableStringify, type Backup, type CollectionKey, type ExistingData } from './backup'

const emptyDocs = () => Object.fromEntries(BACKUP_COLLECTIONS.map((k) => [k, []])) as unknown as Record<CollectionKey, never[]>
const album = (extra: object = {}) => ({ title: 'Kind of Blue', sortTitle: 'kind of blue', artistNames: ['Miles Davis'], primaryArtist: 'Miles Davis', ...extra })
const backupOf = (c: Partial<Record<CollectionKey, unknown[]>>, preferences?: unknown): Backup => ({ format: 'vinyl-archive-backup', version: 1, exportedAt: '2026-03-01T00:00:00.000Z', preferences, collections: { ...emptyDocs(), ...c } as Backup['collections'] })
const noExisting = (): ExistingData => ({ docs: Object.fromEntries(BACKUP_COLLECTIONS.map((k) => [k, {}])) as ExistingData['docs'], preferences: null })
const withExisting = (e: Partial<Record<CollectionKey, Record<string, Record<string, unknown>>>>, preferences: Record<string, unknown> | null = null): ExistingData => ({ docs: { ...noExisting().docs, ...e }, preferences })

describe('parseBackup', () => {
  it('round-trips a built backup', () => {
    const b = buildBackup({ ...emptyDocs(), albums: [{ id: 'a1', data: album() }] } as never, { ratingMax: 10 }, new Date('2026-03-01T00:00:00Z'))
    const r = parseBackup(JSON.stringify(b))
    expect(r.ok && r.backup.collections.albums).toHaveLength(1)
    expect(r.ok && r.backup.exportedAt).toBe('2026-03-01T00:00:00.000Z')
  })
  it('rejects non-JSON, foreign files, newer versions and oversize files', () => {
    expect(parseBackup('not json')).toMatchObject({ ok: false })
    expect(parseBackup(JSON.stringify({ hello: 1 }))).toMatchObject({ ok: false })
    expect(parseBackup(JSON.stringify({ format: 'vinyl-archive-backup', version: 99, collections: {} }))).toMatchObject({ ok: false, error: expect.stringContaining('newer') })
    expect(parseBackup('x'.repeat(MAX_BACKUP_BYTES + 1))).toMatchObject({ ok: false })
  })
  it('treats missing collections as empty', () => {
    const r = parseBackup(JSON.stringify({ format: 'vinyl-archive-backup', version: 1, collections: { albums: [] } }))
    expect(r.ok && r.backup.collections.copies).toEqual([])
  })
})

describe('planImport', () => {
  it('adds new records, albums first, and recomputes album copy counts', () => {
    const plan = planImport(backupOf({
      copies: [{ id: 'c1', data: { albumId: 'a1', format: 'LP' } }, { id: 'c2', data: { albumId: 'a1', format: '12"' } }],
      albums: [{ id: 'a1', data: album({ copyCount: 99, owned: false }) }],
    }), noExisting(), { overwrite: false })
    expect(plan.ops.map((o) => (o.kind === 'set' ? o.collection : o.kind))).toEqual(['albums', 'copies', 'copies'])
    const a = plan.ops[0]!
    expect(a.kind === 'set' && a.data).toMatchObject({ copyCount: 2, owned: true })
    expect(plan.summary.albums.new).toBe(1)
  })

  it('treats identical records as unchanged even if stored data lacks defaults', () => {
    const plan = planImport(backupOf({ albums: [{ id: 'a1', data: album({ genres: [], archived: false }) }] }), withExisting({ albums: { a1: album({ copyCount: 3, owned: true }) } }), { overwrite: true })
    expect(plan.summary.albums).toMatchObject({ unchanged: 1, changed: 0 })
    expect(plan.ops).toHaveLength(0)
  })

  it('leaves differing records alone unless overwrite is on', () => {
    const b = backupOf({ albums: [{ id: 'a1', data: album({ title: 'Kind of Blue (Mono)' }) }] })
    const ex = withExisting({ albums: { a1: album({ copyCount: 1, owned: true }) }, copies: { c1: { albumId: 'a1' } } })
    const off = planImport(b, ex, { overwrite: false })
    expect(off.summary.albums.changed).toBe(1)
    expect(off.skippedChanged).toBe(1)
    expect(off.ops).toHaveLength(0)
    const on = planImport(b, ex, { overwrite: true })
    expect(on.ops).toHaveLength(1)
    expect(on.ops[0]!.kind === 'set' && on.ops[0]!.data).toMatchObject({ title: 'Kind of Blue (Mono)', copyCount: 1, owned: true })
  })

  it('reports invalid, duplicate and unsafe-ID records without failing the rest', () => {
    const plan = planImport(backupOf({ albums: [
      { id: 'ok', data: album() }, { id: 'ok', data: album() }, { id: '../etc', data: album() }, { id: 'no-title', data: { artistNames: [] } }, { nope: 1 },
    ] }), noExisting(), { overwrite: false })
    expect(plan.summary.albums).toMatchObject({ total: 5, new: 1, invalid: 4 })
    expect(plan.invalid.map((p) => p.reason).join('|')).toMatch(/Duplicate/)
    expect(plan.ops).toHaveLength(1)
  })

  it('skips records whose album is nowhere, but accepts ones pointing at an existing album', () => {
    const plan = planImport(backupOf({
      copies: [{ id: 'c1', data: { albumId: 'ghost' } }, { id: 'c2', data: { albumId: 'a9' } }],
      reviews: [{ id: 'ghost', data: { rating: 5 } }],
    }), withExisting({ albums: { a9: album({ copyCount: 0, owned: false }) } }), { overwrite: false })
    expect(plan.orphans.map((o) => o.id).sort()).toEqual(['c1', 'ghost'])
    expect(plan.ops.filter((o) => o.kind === 'set').map((o) => (o.kind === 'set' ? o.id : ''))).toEqual(['c2'])
  })

  it('fixes the copy count of an existing album that gains a copy', () => {
    const plan = planImport(backupOf({ copies: [{ id: 'c2', data: { albumId: 'a1' } }] }),
      withExisting({ albums: { a1: album({ copyCount: 1, owned: true }) }, copies: { c1: { albumId: 'a1' } } }), { overwrite: false })
    expect(plan.ops.at(-1)).toEqual({ kind: 'albumCounts', id: 'a1', copyCount: 2, owned: true })
  })

  it('never produces a delete', () => {
    const plan = planImport(backupOf({ albums: [] }), withExisting({ albums: { a1: album({ copyCount: 0, owned: false }) } }), { overwrite: true })
    expect(plan.ops).toEqual([])
  })

  it('handles preferences: add when absent, keep when different unless overwriting', () => {
    expect(planImport(backupOf({}, { ratingMax: 5, defaultCurrency: 'EUR' }), noExisting(), { overwrite: false }).ops).toEqual([{ kind: 'prefs', data: { ratingMax: 5, defaultCurrency: 'EUR' } }])
    const ex = noExisting(); ex.preferences = { ratingMax: 10, defaultCurrency: 'USD' }
    const b = backupOf({}, { ratingMax: 5, defaultCurrency: 'EUR' })
    expect(planImport(b, ex, { overwrite: false })).toMatchObject({ preferences: 'changed', ops: [] })
    expect(planImport(b, ex, { overwrite: true }).ops).toHaveLength(1)
    expect(planImport(backupOf({}, { ratingMax: 7 }), noExisting(), { overwrite: false }).preferences).toBe('invalid')
  })
})

describe('stableStringify', () => {
  it('ignores key order and undefined values', () => {
    expect(stableStringify({ b: 1, a: [1, { d: 1, c: 2 }], z: undefined })).toBe(stableStringify({ a: [1, { c: 2, d: 1 }], b: 1 }))
  })
})
