import { describe, expect, it, vi } from 'vitest'
import { createMusicBrainzProvider, mapFormat } from './musicbrainz'
import { ProviderError } from './types'

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

function setup(responses: Array<Response | Error>) {
  let t = 0
  const calls: string[] = []
  const fetchFn = vi.fn(async (url: RequestInfo | URL) => {
    calls.push(String(url))
    const next = responses.shift()
    if (!next) throw new Error('unexpected request')
    if (next instanceof Error) throw next
    return next
  }) as unknown as typeof fetch
  const sleeps: number[] = []
  const sleep = async (ms: number) => { sleeps.push(ms); t += ms }
  const provider = createMusicBrainzProvider({ fetchFn, sleep, now: () => t, minIntervalMs: 1000 })
  return { provider, calls, sleeps, fetchFn }
}

const groupBody = { 'release-groups': [{ id: 'g1', title: 'Kind of Blue', 'first-release-date': '1959-08-17', 'artist-credit': [{ name: 'Miles Davis' }] }] }

describe('musicbrainz provider', () => {
  it('maps release-group search results and builds a field query', async () => {
    const { provider, calls } = setup([json(groupBody)])
    const r = await provider.searchAlbums('miles kind', 'text')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ kind: 'release-group', id: 'g1', title: 'Kind of Blue', artistNames: ['Miles Davis'], year: 1959 })
    expect(r[0]!.artworkUrl).toContain('/release-group/g1/front-250')
    const q = decodeURIComponent(calls[0]!.replace(/\+/g, ' '))
    expect(q).toContain('(releasegroup:miles OR artistname:miles) AND (releasegroup:kind OR artistname:kind)')
  })

  it('searches releases by barcode using digits only', async () => {
    const { provider, calls } = setup([json({ releases: [{ id: 'r1', title: 'Abbey Road', country: 'GB', barcode: '5099969945021', 'artist-credit': [{ name: 'The Beatles' }], media: [{ format: '12" Vinyl' }], 'label-info': [{ 'catalog-number': 'PCS 7088', label: { name: 'Apple' } }], 'release-group': { id: 'g9' } }] })])
    const r = await provider.searchAlbums('5099 9699 45021', 'barcode')
    expect(decodeURIComponent(calls[0]!)).toContain('barcode:"5099969945021"')
    expect(r[0]).toMatchObject({ kind: 'release', releaseGroupId: 'g9', format: '12" Vinyl', catalogNumber: 'PCS 7088', label: 'Apple', country: 'GB' })
  })

  it('spaces requests at least one interval apart and never overlaps', async () => {
    const { provider, sleeps } = setup([json(groupBody), json(groupBody)])
    await Promise.all([provider.searchAlbums('a', 'text'), provider.searchAlbums('b', 'text')])
    expect(sleeps.some((s) => s >= 900)).toBe(true)
  })

  it('caches identical requests', async () => {
    const { provider, fetchFn } = setup([json(groupBody)])
    await provider.searchAlbums('same', 'text'); await provider.searchAlbums('same', 'text')
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('retries on 503 then succeeds, honoring Retry-After', async () => {
    const { provider, sleeps } = setup([json({}, 503, { 'Retry-After': '3' }), json(groupBody)])
    expect(await provider.searchAlbums('x', 'text')).toHaveLength(1)
    expect(sleeps).toContain(3000)
  })

  it('reports rate-limit after exhausting retries', async () => {
    const { provider } = setup([json({}, 429), json({}, 429), json({}, 429)])
    await expect(provider.searchAlbums('x', 'text')).rejects.toMatchObject({ kind: 'rate-limit' })
  })

  it('reports network failures and unexpected shapes distinctly', async () => {
    await expect(setup([new Error('offline')]).provider.searchAlbums('x', 'text')).rejects.toMatchObject({ kind: 'network' })
    await expect(setup([json([1, 2])]).provider.searchAlbums('x', 'text')).rejects.toBeInstanceOf(ProviderError)
    await expect(setup([json('nope')]).provider.searchAlbums('x', 'text')).rejects.toMatchObject({ kind: 'invalid-response', message: expect.stringContaining('unexpected shape') })
    await expect(setup([json({}, 500)]).provider.searchAlbums('x', 'text')).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('sorts pressing candidates with vinyl first', async () => {
    const { provider } = setup([json({ releases: [
      { id: 'cd', title: 'T', date: '1990', media: [{ format: 'CD' }] },
      { id: 'lp2', title: 'T', date: '1985', media: [{ format: '12" Vinyl' }] },
      { id: 'lp1', title: 'T', date: '1959', media: [{ format: '12" Vinyl' }] },
    ] })])
    const c = await provider.getReleaseCandidates('g')
    expect(c.map((x) => x.id)).toEqual(['lp1', 'lp2', 'cd'])
    expect(c[2]!.isVinyl).toBe(false)
  })

  it('builds album details, tracklist and pressing defaults from a release', async () => {
    const { provider } = setup([json({
      id: 'r1', title: 'Kind of Blue', date: '1959-08-17', country: 'US', barcode: '074646393214',
      'artist-credit': [{ name: 'Miles Davis' }],
      'label-info': [{ 'catalog-number': 'CL 1355', label: { name: 'Columbia' } }],
      'release-group': { id: 'g1', genres: [{ name: 'jazz' }] }, genres: [{ name: 'modal jazz' }],
      media: [{ position: 1, format: '12" Vinyl', tracks: [{ id: 't1', number: 'A1', title: 'So What', length: 565000 }, { number: 'A2', title: 'Freddie Freeloader' }] }],
    })])
    const d = await provider.getRelease('r1')
    expect(d!.album).toMatchObject({ title: 'Kind of Blue', primaryArtist: 'Miles Davis', releaseYear: 1959, musicBrainzReleaseGroupId: 'g1', labelNames: ['Columbia'] })
    expect(d!.album.genres).toEqual(['modal jazz', 'jazz'])
    expect(d!.album.tracklist[0]).toEqual({ id: 't1', position: 'A1', title: 'So What', durationMs: 565000 })
    expect(d!.album.tracklist[1]!.id).toBe('1-2')
    expect(d!.copyDefaults).toMatchObject({ format: 'LP', releaseCountry: 'US', catalogNumber: 'CL 1355', barcode: '074646393214', discCount: 1, releaseId: 'r1' })
  })

  it('returns null when a release lacks a title or artist', async () => {
    expect(await setup([json({ id: 'r', 'artist-credit': [] })]).provider.getRelease('r')).toBeNull()
  })

  it('tolerates nulls, wrong types and malformed items instead of failing the whole search', async () => {
    const { provider } = setup([json({ 'release-groups': [
      { id: 'g1', title: 'Good', 'first-release-date': null, 'artist-credit': [{ name: 'Artist' }, 'junk', null] },
      { title: 'No id, skipped' },
      { id: 'g2', title: 42, 'artist-credit': 'not-a-list' },
    ] })])
    const r = await provider.searchAlbums('x', 'text')
    expect(r.map((x) => x.id)).toEqual(['g1', 'g2'])
    expect(r[0]).toMatchObject({ title: 'Good', artistNames: ['Artist'], year: undefined })
    expect(r[1]).toMatchObject({ title: 'Untitled', artistNames: [] })
  })

  it('tolerates null country/date/barcode, numeric track numbers and null lengths in a release', async () => {
    const { provider } = setup([json({
      id: 'r1', title: 'T', date: null, country: null, barcode: null, 'artist-credit': [{ name: 'A' }], 'label-info': [{ 'catalog-number': null, label: null }, 'bad'],
      media: [{ position: 1, format: null, tracks: [{ id: 't1', number: 1, title: 'One', length: null }, { title: 'Two' }, 'bad'] }, 'bad'],
      'release-group': { id: 'g1', genres: 'nope' },
    })])
    const d = await provider.getRelease('r1')
    expect(d!.album.tracklist.map((t) => [t.position, t.title])).toEqual([['1', 'One'], ['2', 'Two']])
    expect(d!.album.releaseYear).toBeUndefined()
    expect(d!.album.musicBrainzReleaseGroupId).toBe('g1')
    expect(d!.copyDefaults.format).toBe('Other')
  })

  it('maps formats', () => {
    expect(mapFormat('12" Vinyl')).toBe('LP')
    expect(mapFormat('7" Vinyl')).toBe('7"')
    expect(mapFormat('10" Vinyl')).toBe('10"')
    expect(mapFormat('CD')).toBe('Other')
    expect(mapFormat(undefined)).toBe('Other')
  })
})
