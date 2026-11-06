import { describe, expect, it, vi } from 'vitest'
import { createFallbackProvider } from './fallback'
import { ProviderError, type AlbumSearchResult, type MusicMetadataProvider } from './types'

const hit = (source: 'discogs' | 'musicbrainz', id: string): AlbumSearchResult => ({ source, kind: 'release-group', id, title: 'T', artistNames: ['A'], sourceUrl: 'https://x' })
const fake = (_name: 'discogs' | 'musicbrainz', search: () => Promise<AlbumSearchResult[]>): MusicMetadataProvider & { cand: ReturnType<typeof vi.fn>; rel: ReturnType<typeof vi.fn> } => {
  void _name
  const cand = vi.fn(async () => []), rel = vi.fn(async () => null)
  return { searchAlbums: search, getReleaseCandidates: cand, getRelease: rel, cand, rel }
}

describe('fallback provider', () => {
  it('uses Discogs when it has results and does not touch the backup', async () => {
    const backup = fake('musicbrainz', vi.fn(async () => [hit('musicbrainz', 'm')]))
    const notes: string[] = []
    const p = createFallbackProvider(fake('discogs', async () => [hit('discogs', 'd')]), backup, (w) => notes.push(w))
    expect((await p.searchAlbums('x', 'text'))[0]!.source).toBe('discogs')
    expect(notes).toEqual([])
  })
  it('falls back to MusicBrainz and says why when Discogs fails', async () => {
    const notes: string[] = []
    const p = createFallbackProvider(fake('discogs', async () => { throw new ProviderError('unavailable', 'Discogs rejected your credentials.') }), fake('musicbrainz', async () => [hit('musicbrainz', 'm')]), (w) => notes.push(w))
    expect((await p.searchAlbums('x', 'text'))[0]!.source).toBe('musicbrainz')
    expect(notes[0]).toMatch(/rejected your credentials.*MusicBrainz/)
  })
  it('falls back when Discogs finds nothing', async () => {
    const notes: string[] = []
    const p = createFallbackProvider(fake('discogs', async () => []), fake('musicbrainz', async () => [hit('musicbrainz', 'm')]), (w) => notes.push(w))
    expect(await p.searchAlbums('x', 'text')).toHaveLength(1)
    expect(notes[0]).toMatch(/no matches/)
  })
  it('routes id lookups to the catalog the id came from', async () => {
    const primary = fake('discogs', async () => []), backup = fake('musicbrainz', async () => [])
    const p = createFallbackProvider(primary, backup)
    await p.getRelease('1', 'discogs'); await p.getReleaseCandidates('2', 'discogs')
    await p.getRelease('3', 'musicbrainz'); await p.getReleaseCandidates('4', 'musicbrainz'); await p.getRelease('5')
    expect(primary.rel).toHaveBeenCalledTimes(1); expect(primary.cand).toHaveBeenCalledTimes(1)
    expect(backup.rel).toHaveBeenCalledTimes(2); expect(backup.cand).toHaveBeenCalledTimes(1)
  })
  it('propagates a backup failure instead of hiding it', async () => {
    const p = createFallbackProvider(fake('discogs', async () => []), fake('musicbrainz', async () => { throw new ProviderError('network', 'offline') }))
    await expect(p.searchAlbums('x', 'text')).rejects.toMatchObject({ kind: 'network' })
  })
})
