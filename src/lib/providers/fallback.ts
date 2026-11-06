import { createDiscogsClient, type DiscogsAuth } from './discogs'
import { createDiscogsCatalog } from './discogsCatalog'
import { createMusicBrainzProvider } from './musicbrainz'
import { ProviderError, type MusicMetadataProvider, type ProviderSource } from './types'

const reason = (e: unknown) => (e instanceof ProviderError || e instanceof Error ? e.message : 'Discogs failed.')

/**
 * Searches the primary catalog first and falls back to the backup when the primary errors or finds
 * nothing. Lookups by id go to the catalog the id came from. `onFallback` lets the UI say what happened.
 */
export function createFallbackProvider(primary: MusicMetadataProvider, backup: MusicMetadataProvider, onFallback?: (why: string) => void): MusicMetadataProvider {
  const pick = (source?: ProviderSource) => (source === 'discogs' ? primary : backup)
  return {
    async searchAlbums(query, mode) {
      let why: string
      try {
        const r = await primary.searchAlbums(query, mode)
        if (r.length) return r
        why = 'Discogs had no matches, so these results are from MusicBrainz.'
      } catch (e) { why = `${reason(e)} Showing MusicBrainz results instead.` }
      onFallback?.(why)
      return backup.searchAlbums(query, mode)
    },
    getReleaseCandidates: (id, source) => pick(source).getReleaseCandidates(id, source),
    getRelease: (id, source) => pick(source).getRelease(id, source),
  }
}

/** Discogs first when credentials exist; MusicBrainz alone otherwise. */
export function createCatalogProvider(auth: DiscogsAuth | undefined, onFallback?: (why: string) => void): MusicMetadataProvider {
  const mb = createMusicBrainzProvider()
  return auth ? createFallbackProvider(createDiscogsCatalog(createDiscogsClient({ auth })), mb, onFallback) : mb
}
