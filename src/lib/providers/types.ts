import type { AlbumInput, CopyInput } from '../schemas'

export type SearchMode = 'text' | 'barcode' | 'catalog'
export type ProviderSource = 'discogs' | 'musicbrainz'

export interface AlbumSearchResult {
  source: ProviderSource
  /** 'release-group' is an album as a whole (Discogs master); 'release' is one specific pressing. */
  kind: 'release-group' | 'release'
  id: string
  /** For kind 'release', the parent release group (used to dedupe). */
  releaseGroupId?: string
  title: string
  artistNames: string[]
  year?: number
  country?: string
  format?: string
  label?: string
  catalogNumber?: string
  barcode?: string
  artworkUrl?: string
  sourceUrl: string
}

export interface ReleaseCandidate {
  source: ProviderSource
  id: string
  title: string
  date?: string
  year?: number
  country?: string
  format?: string
  isVinyl: boolean
  discCount?: number
  label?: string
  catalogNumber?: string
  barcode?: string
  sourceUrl: string
}

export type AlbumDraft = Pick<
  AlbumInput,
  'title' | 'artistNames' | 'primaryArtist' | 'genres' | 'styles' | 'labelNames' | 'tracklist' | 'externalIdentifiers' | 'metadataSources'
> &
  Partial<Pick<AlbumInput, 'releaseDate' | 'releaseYear' | 'artworkUrl' | 'musicBrainzReleaseGroupId' | 'musicBrainzReleaseId' | 'description' | 'discogsMasterId' | 'discogsReleaseId' | 'discogsStats'>>

export interface ReleaseDetails {
  album: AlbumDraft
  /** Pressing details taken from the chosen release; owner still confirms them. */
  copyDefaults: Partial<Omit<CopyInput, 'albumId'>>
}

export type ProviderErrorKind = 'rate-limit' | 'unavailable' | 'network' | 'invalid-response'
export class ProviderError extends Error {
  kind: ProviderErrorKind
  constructor(kind: ProviderErrorKind, message: string) {
    super(message)
    this.name = 'ProviderError'
    this.kind = kind
  }
}

export interface MusicMetadataProvider {
  searchAlbums(query: string, mode: SearchMode): Promise<AlbumSearchResult[]>
  /** `source` says which catalog the id came from; single-source providers may ignore it. */
  getReleaseCandidates(releaseGroupId: string, source?: ProviderSource): Promise<ReleaseCandidate[]>
  getRelease(releaseId: string, source?: ProviderSource): Promise<ReleaseDetails | null>
}
