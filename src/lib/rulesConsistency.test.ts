/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PUBLIC_KEYS } from './publicProjection'
import { buildPublicAlbum, buildPublicGear, buildPublicListen, buildPublicPlace, buildPublicWant, defaultPublicFieldOptions } from './publicProjection'
import { albumInputSchema, gearInputSchema, listeningSessionInputSchema, purchaseLocationInputSchema, reviewInputSchema, wantlistInputSchema, copyInputSchema } from './schemas'

const rules = readFileSync('firestore.rules', 'utf8')

/** The keys listed in the first hasOnly([...]) after `match /<name>/{...} {`. */
function allowedKeys(name: string): string[] {
  const start = rules.indexOf(`match /${name}/{`)
  expect(start, `no rules block for ${name}`).toBeGreaterThan(-1)
  const m = rules.slice(start).match(/hasOnly\(\[([^\]]*)\]\)/)
  expect(m, `no hasOnly list for ${name}`).not.toBeNull()
  return [...m![1]!.matchAll(/'([A-Za-z]+)'/g)].map((x) => x[1]!)
}

describe('firestore.rules and the public projection agree', () => {
  for (const name of Object.keys(PUBLIC_KEYS) as (keyof typeof PUBLIC_KEYS)[]) {
    it(`${name}: rules allow exactly the keys the app writes`, () => {
      expect([...allowedKeys(name)].sort()).toEqual([...PUBLIC_KEYS[name]].sort())
    })
  }

  it('every document the builders can produce uses only allowed keys, even with everything switched on', () => {
    const all = { ...defaultPublicFieldOptions, rating: true, review: true, vibes: true, topTracks: true, pressingSummary: true, discogsStats: true, journalNotes: true, money: true }
    const album = albumInputSchema.parse({ title: 'T', sortTitle: 't', artistNames: ['A'], primaryArtist: 'A', releaseYear: 1990, artworkUrl: 'https://x.com/a.jpg', genres: ['Rock'], tracklist: [{ id: 't1', position: '1', title: 'One' }], discogsReleaseId: '9', discogsStats: { rating: 4, ratingCount: 3, have: 1, want: 2, forSale: 3, fetchedAt: '2026-01-01T00:00:00Z' } })
    const review = reviewInputSchema.parse({ rating: 9, review: 'r', vibes: ['v'], topThreeTrackIds: ['t1'] })
    const copy = copyInputSchema.parse({ albumId: 'a', format: 'LP', purchasePrice: 20, currency: 'USD', purchaseDate: '2025-01-01', seller: 'SECRET', privateNotes: 'SECRET' })
    const docs: [keyof typeof PUBLIC_KEYS, object][] = [
      ['albums', buildPublicAlbum(album, review, [copy], all)],
      ['wantlist', buildPublicWant(wantlistInputSchema.parse({ albumId: 'a', albumTitle: 'T', primaryArtist: 'A', artworkUrl: 'https://x.com/a.jpg', releaseYear: 1990, desiredPressingNotes: 'blue', targetPrice: 30, currency: 'USD', notes: 'SECRET' }), all)],
      ['listens', buildPublicListen(listeningSessionInputSchema.parse({ albumId: 'a', date: '2026-03-01', albumTitle: 'T', primaryArtist: 'A', artworkUrl: 'https://x.com/a.jpg', vibeTags: ['v'], notes: 'n', locationText: 'SECRET' }), all)],
      ['gear', buildPublicGear(gearInputSchema.parse({ name: 'Deck', category: 'turntable', brand: 'B', model: 'M', condition: 'new', purchaseDate: '2025-01-01', purchasePrice: 300, currency: 'USD', seller: 'SECRET', notes: 'SECRET' }), all)],
      ['places', buildPublicPlace(purchaseLocationInputSchema.parse({ name: 'Shop', latitude: 1, longitude: 2, address: 'SECRET', notes: 'SECRET' }))!],
    ]
    for (const [name, doc] of docs) {
      const allowed = new Set<string>([...PUBLIC_KEYS[name], 'publishedAt'])
      for (const k of Object.keys(doc)) expect(allowed.has(k), `${name}.${k}`).toBe(true)
      expect(JSON.stringify(doc)).not.toContain('SECRET')
    }
  })

  it('keeps money, notes and positions out unless the matching switch is on', () => {
    const base = defaultPublicFieldOptions
    const gear = buildPublicGear(gearInputSchema.parse({ name: 'Deck', purchaseDate: '2025-01-01', purchasePrice: 300, currency: 'USD' }), base)
    expect(gear).not.toHaveProperty('purchasePrice'); expect(gear).not.toHaveProperty('purchaseDate')
    const listen = buildPublicListen(listeningSessionInputSchema.parse({ albumId: 'a', date: '2026-03-01', notes: 'private thoughts' }), base)
    expect(listen).not.toHaveProperty('notes')
    expect(buildPublicPlace(purchaseLocationInputSchema.parse({ name: 'Unplaced' }))).toBeNull()
  })

  it('has a default-deny fallback and no open reads on private data', () => {
    expect(rules).toMatch(/match \/\{document=\*\*\} \{\s*allow read, write: if false;/)
    expect(rules).toMatch(/match \/users\/\{uid\}\/\{document=\*\*\} \{\s*allow read, write: if isOwner\(\) && request\.auth\.uid == uid;/)
  })
  it('gates every public subcollection read on its section switch', () => {
    for (const [name, section] of [['albums', 'collection'], ['wantlist', 'wantlist'], ['listens', 'journal'], ['gear', 'gear'], ['places', 'places']] as const) {
      const from = rules.indexOf(`match /${name}/{`)
      const rest = rules.slice(from + 10)
      const next = rest.indexOf('match /')
      const block = rules.slice(from, next === -1 ? undefined : from + 10 + next)
      expect(block, name).toContain(`allow read: if isOwner() || sectionOn(shareId, '${section}')`)
    }
  })
  it('only reveals a share ID in the pointer while the site is public', () => {
    expect(rules).toContain("request.resource.data.enabled == false && request.resource.data.shareId == ''")
  })
})
