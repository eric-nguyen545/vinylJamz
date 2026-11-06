import { describe, expect, it } from 'vitest'
import { albumInputSchema, copyInputSchema, reviewInputSchema } from './schemas'
import { PUBLIC_ALBUM_KEYS, buildPublicAlbum, defaultPublicFieldOptions, generateShareId } from './publicProjection'

const album = albumInputSchema.parse({
  title: 'Kind of Blue', sortTitle: 'kind of blue', artistNames: ['Miles Davis'], primaryArtist: 'Miles Davis',
  releaseYear: 1959, genres: ['Jazz'], artworkUrl: 'https://example.com/a.jpg',
  tracklist: [{ id: 't1', position: 'A1', title: 'So What' }, { id: 't2', position: 'A2', title: 'Freddie Freeloader' }],
  description: 'PRIVATE-DESCRIPTION-NOT-PUBLIC',
})
const review = reviewInputSchema.parse({ rating: 9.5, review: 'Perfect.', vibes: ['late night'], topThreeTrackIds: ['t2', 'nope'] })
const copy = copyInputSchema.parse({
  albumId: 'a1', format: 'LP', pressingYear: 1959, releaseCountry: 'US', label: 'Columbia', vinylColor: 'Black',
  purchasePrice: 123, seller: 'SECRET-SELLER', privateNotes: 'SECRET-NOTES', purchaseDate: '2024-01-02', purchaseLocationId: 'loc1',
})

describe('buildPublicAlbum', () => {
  it('only emits allowlisted keys', () => {
    const all = { artwork: true, tracklist: true, rating: true, review: true, vibes: true, topTracks: true, pressingSummary: true, discogsStats: false, journalNotes: false, money: false }
    const out = buildPublicAlbum(album, review, [copy], all)
    for (const k of Object.keys(out)) expect(PUBLIC_ALBUM_KEYS as readonly string[]).toContain(k)
  })

  it('never leaks private copy or album fields even with everything enabled', () => {
    const all = { artwork: true, tracklist: true, rating: true, review: true, vibes: true, topTracks: true, pressingSummary: true, discogsStats: false, journalNotes: false, money: false }
    const json = JSON.stringify(buildPublicAlbum(album, review, [copy], all))
    for (const secret of ['SECRET-SELLER', 'SECRET-NOTES', 'PRIVATE-DESCRIPTION', '2024-01-02', 'loc1', '123']) {
      expect(json).not.toContain(secret)
    }
  })

  it('omits opt-in fields by default', () => {
    const out = buildPublicAlbum(album, review, [copy], defaultPublicFieldOptions)
    expect(out.rating).toBeUndefined()
    expect(out.review).toBeUndefined()
    expect(out.vibes).toBeUndefined()
    expect(out.topThreeTracks).toBeUndefined()
    expect(out.publicPressingSummary).toBeUndefined()
  })

  it('maps top track IDs to titles and drops unknown IDs', () => {
    const out = buildPublicAlbum(album, review, [], { ...defaultPublicFieldOptions, topTracks: true })
    expect(out.topThreeTracks).toEqual(['Freddie Freeloader'])
  })

  it('honors artwork and tracklist toggles', () => {
    const out = buildPublicAlbum(album, undefined, [], { ...defaultPublicFieldOptions, artwork: false, tracklist: false })
    expect(out.artworkUrl).toBeUndefined()
    expect(out.tracklist).toBeUndefined()
  })
})

describe('generateShareId', () => {
  it('is 32 hex chars and unique', () => {
    const a = generateShareId(), b = generateShareId()
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(a).not.toBe(b)
  })
})
