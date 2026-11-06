import { describe, expect, it } from 'vitest'
import { cleanName, communityStats, createDiscogsCatalog, mapFormat, parseDuration, parseRelease, releaseToDetails, splitTitle } from './discogsCatalog'
import { createDiscogsClient } from './discogs'
import { albumInputSchema, copyInputSchema } from '../schemas'
import { stableAlbumId } from '../albumsRepo'

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
const catalogWith = (...responses: Response[]) => {
  const urls: string[] = []
  const fetchFn = (async (u: RequestInfo | URL) => { urls.push(String(u)); const r = responses.shift(); if (!r) throw new Error('unexpected request'); return r }) as unknown as typeof fetch
  return { catalog: createDiscogsCatalog(createDiscogsClient({ auth: { token: 'tok_1234567890' }, fetchFn })), urls }
}

const release = {
  id: 249504, title: 'Kind of Blue', year: 1997, released: '1997-08-12', country: 'US', master_id: 5460,
  artists: [{ name: 'Miles Davis' }], labels: [{ name: 'Columbia (2)', catno: 'CS 8163' }], genres: ['Jazz'], styles: ['Modal'],
  formats: [{ name: 'Vinyl', qty: '2', text: 'Blue Translucent', descriptions: ['LP', 'Album', 'Reissue', 'Limited Edition'] }],
  tracklist: [{ position: 'A1', title: 'So What', duration: '9:22', type_: 'track' }, { position: '', title: 'Side B', type_: 'heading' }, { position: 'B1', title: 'Blue in Green', duration: '5:37', type_: 'track' }, { position: 'B2', title: 'No length', duration: '', type_: 'track' }],
  images: [{ type: 'secondary', uri: 'https://i.discogs.com/b.jpg' }, { type: 'primary', uri: 'https://i.discogs.com/a.jpg' }],
  identifiers: [{ type: 'Matrix / Runout', value: 'X' }, { type: 'Barcode', value: '0 74646 39321 4' }],
  community: { have: 1200, want: 3400, rating: { average: 4.62, count: 980 } }, num_for_sale: 57, notes: 'Pressed at Terre Haute.', data_quality: 'Correct',
  videos: [{ uri: 'https://www.youtube.com/watch?v=abc', title: 'So What' }], extraartists: [{ name: 'Bill Evans (3)', role: 'Piano' }],
}

describe('helpers', () => {
  it('cleans Discogs artist disambiguation numbers', () => { expect(cleanName('Nirvana (2)')).toBe('Nirvana'); expect(cleanName('Prince')).toBe('Prince') })
  it('splits "Artist - Title" on the first separator only', () => {
    expect(splitTitle('Miles Davis - Kind of Blue')).toEqual({ artist: 'Miles Davis', title: 'Kind of Blue' })
    expect(splitTitle('Artist (2) - Title - Deluxe')).toEqual({ artist: 'Artist', title: 'Title - Deluxe' })
    expect(splitTitle('No separator')).toEqual({ artist: '', title: 'No separator' })
  })
  it('parses durations', () => {
    expect(parseDuration('5:30')).toBe(330000)
    expect(parseDuration('1:02:03')).toBe(3723000)
    for (const bad of ['', undefined, 'abc', '0:00', '5']) expect(parseDuration(bad as string | undefined)).toBeUndefined()
  })
  it('maps vinyl formats, colour, disc count and edition notes', () => {
    const m = mapFormat(parseRelease(release).formats)
    expect(m).toEqual({ format: 'LP', vinylColor: 'Blue Translucent', discCount: 2, notes: 'Reissue, Limited Edition' })
    expect(mapFormat([{ name: 'Vinyl', qty: '1', text: undefined, descriptions: ['7"', '45 RPM'] }]).format).toBe('7"')
    expect(mapFormat([{ name: 'CD', qty: '1', text: undefined, descriptions: [] }]).format).toBe('Other')
    expect(mapFormat([]).format).toBe('Other')
  })
  it('captures community numbers', () => {
    expect(communityStats(parseRelease(release), new Date('2026-03-10T00:00:00Z'))).toEqual({ rating: 4.62, ratingCount: 980, have: 1200, want: 3400, forSale: 57, fetchedAt: '2026-03-10T00:00:00.000Z' })
  })
})

describe('release mapping', () => {
  const d = releaseToDetails(parseRelease(release), new Date('2026-03-10T00:00:00Z'))!
  it('produces a valid album and pressing', () => {
    expect(albumInputSchema.safeParse({ ...d.album, sortTitle: 'kind of blue' }).success).toBe(true)
    expect(copyInputSchema.safeParse({ ...d.copyDefaults, albumId: 'a' }).success).toBe(true)
  })
  it('maps core fields', () => {
    expect(d.album).toMatchObject({ title: 'Kind of Blue', primaryArtist: 'Miles Davis', releaseYear: 1997, genres: ['Jazz'], styles: ['Modal'], labelNames: ['Columbia'], discogsReleaseId: '249504', discogsMasterId: '5460', artworkUrl: 'https://i.discogs.com/a.jpg', metadataSources: ['discogs'] })
    expect(d.copyDefaults).toMatchObject({ releaseId: 'discogs:249504', catalogNumber: 'CS 8163', barcode: '074646393214', releaseCountry: 'US', label: 'Columbia', format: 'LP', discCount: 2, vinylColor: 'Blue Translucent', releaseDate: '1997-08-12' })
  })
  it('keeps real tracks only and parses their lengths', () => {
    expect(d.album.tracklist.map((t) => [t.position, t.title, t.durationMs])).toEqual([['A1', 'So What', 562000], ['B1', 'Blue in Green', 337000], ['B2', 'No length', undefined]])
  })
  it('gives the album a stable ID from the Discogs master, or the release when there is none', () => {
    expect(stableAlbumId(d.album)).toBe('dcm_5460')
    expect(stableAlbumId({ discogsReleaseId: '99' })).toBe('dcr_99')
    expect(stableAlbumId({ musicBrainzReleaseGroupId: 'x', discogsMasterId: '5' })).toBe('mbrg_x')
  })
  it('rejects releases with no title or artist, and tolerates missing everything else', () => {
    expect(releaseToDetails(parseRelease({ id: 1, title: 'T' }))).toBeNull()
    const min = releaseToDetails(parseRelease({ id: 1, title: 'T', artists: [{ name: 'A' }], images: 'nope', community: 5 }))!
    expect(min.album.tracklist).toEqual([])
    expect(min.album.artworkUrl).toBeUndefined()
  })
  it('refuses non-http image links', () => {
    const r = releaseToDetails(parseRelease({ ...release, images: [{ type: 'primary', uri: 'javascript:alert(1)' }] }))!
    expect(r.album.artworkUrl).toBeUndefined()
  })
})

describe('discogs catalog provider', () => {
  it('searches masters by text and maps them to albums', async () => {
    const { catalog, urls } = catalogWith(json({ results: [{ id: 5460, master_id: 5460, title: 'Miles Davis - Kind Of Blue', year: '1959', thumb: 'https://i.discogs.com/t.jpg' }, { nope: 1 }] }))
    const r = await catalog.searchAlbums('miles davis kind of blue', 'text')
    expect(urls[0]).toContain('type=master')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ source: 'discogs', kind: 'release-group', id: '5460', title: 'Kind Of Blue', artistNames: ['Miles Davis'], year: 1959 })
  })
  it('searches pressings directly for barcodes and catalog numbers', async () => {
    const a = catalogWith(json({ results: [{ id: 7, title: 'A - B', format: ['Vinyl', 'LP'], label: ['Col'], catno: 'X1', barcode: ['123'] }] }))
    const r = await a.catalog.searchAlbums('0 74646 39321 4', 'barcode')
    expect(a.urls[0]).toContain('type=release'); expect(a.urls[0]).toContain('barcode=074646393214')
    expect(r[0]).toMatchObject({ kind: 'release', id: '7', format: 'Vinyl, LP', catalogNumber: 'X1' })
    const b = catalogWith(json({ results: [] })); await b.catalog.searchAlbums('CS 8163', 'catalog')
    expect(decodeURIComponent(b.urls[0]!.replace(/\+/g, ' '))).toContain('catno=CS 8163')
  })
  it('lists a master’s pressings with vinyl first', async () => {
    const { catalog, urls } = catalogWith(json({ versions: [{ id: 1, title: 'T', format: 'CD, Album', released: '1990' }, { id: 2, title: 'T', format: 'Vinyl, LP', released: '1959', country: 'US', label: 'Columbia', catno: 'CL 1355' }] }))
    const c = await catalog.getReleaseCandidates('5460', 'discogs')
    expect(urls[0]).toContain('/masters/5460/versions')
    expect(c.map((x) => [x.id, x.isVinyl, x.source])).toEqual([['2', true, 'discogs'], ['1', false, 'discogs']])
  })
  it('loads a release', async () => {
    const { catalog } = catalogWith(json(release))
    expect((await catalog.getRelease('249504', 'discogs'))!.album.title).toBe('Kind of Blue')
  })
})
