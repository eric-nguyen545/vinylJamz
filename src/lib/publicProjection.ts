import {
  defaultPublicFieldOptions, type AlbumInput, type CopyInput, type GearInput, type ListeningSessionInput, type PublicFieldOptions,
  type PurchaseLocationInput, type ReviewInput, type Track, type WantlistInput,
} from './schemas'

export { defaultPublicFieldOptions }
export type { PublicFieldOptions }

/**
 * Exact keys allowed in each public collection. firestore.rules lists the same keys, and
 * rulesConsistency.test.ts fails if the two ever drift apart.
 */
export const PUBLIC_KEYS = {
  albums: ['title', 'artistNames', 'releaseYear', 'genres', 'artworkUrl', 'tracklist', 'rating', 'review', 'vibes', 'topThreeTracks', 'publicPressingSummary', 'discogs', 'purchases', 'publishedAt'],
  wantlist: ['albumTitle', 'primaryArtist', 'artworkUrl', 'releaseYear', 'priority', 'status', 'desiredPressingNotes', 'targetPrice', 'currency', 'publishedAt'],
  listens: ['albumTitle', 'primaryArtist', 'artworkUrl', 'date', 'completedAlbum', 'vibeTags', 'notes', 'publishedAt'],
  gear: ['name', 'category', 'brand', 'model', 'condition', 'purchaseDate', 'purchasePrice', 'currency', 'publishedAt'],
  places: ['name', 'latitude', 'longitude', 'publishedAt'],
} as const
/** Kept for the album-specific tests and callers. */
export const PUBLIC_ALBUM_KEYS = PUBLIC_KEYS.albums

export interface PublicAlbumData {
  title: string
  artistNames: string[]
  releaseYear?: number
  genres: string[]
  artworkUrl?: string
  tracklist?: Track[]
  rating?: number
  review?: string
  vibes?: string[]
  topThreeTracks?: string[]
  publicPressingSummary?: string[]
  discogs?: { rating?: number; ratingCount?: number; have?: number; want?: number; forSale?: number; url?: string }
  purchases?: { date?: string; price: number; currency: string }[]
}

type PressingCopy = Pick<CopyInput, 'format' | 'pressingYear' | 'releaseCountry' | 'label' | 'vinylColor'> & Partial<Pick<CopyInput, 'purchaseDate' | 'purchasePrice' | 'currency'>>

/** Only format, year, country, label, color. Never price, seller, date, location, notes. */
export function summarizePressings(copies: Pick<PressingCopy, 'format' | 'pressingYear' | 'releaseCountry' | 'label' | 'vinylColor'>[]): string[] {
  return copies.map((c) =>
    [c.format, c.vinylColor, c.pressingYear, c.releaseCountry, c.label].filter((v) => v !== undefined && v !== '').join(' · '),
  )
}

/**
 * Build the sanitized public document from private data. Allowlist-based: new private
 * fields can never leak because only fields named here are copied.
 */
export function buildPublicAlbum(
  album: Pick<AlbumInput, 'title' | 'artistNames' | 'releaseYear' | 'genres' | 'artworkUrl' | 'tracklist'> & Partial<Pick<AlbumInput, 'discogsStats' | 'discogsReleaseId'>>,
  review: Pick<ReviewInput, 'rating' | 'review' | 'vibes' | 'topThreeTrackIds'> | undefined,
  copies: PressingCopy[],
  opts: PublicFieldOptions,
): PublicAlbumData {
  const out: PublicAlbumData = { title: album.title, artistNames: [...album.artistNames], genres: [...album.genres] }
  if (album.releaseYear !== undefined) out.releaseYear = album.releaseYear
  if (opts.artwork && album.artworkUrl) out.artworkUrl = album.artworkUrl
  if (opts.tracklist && album.tracklist.length) out.tracklist = album.tracklist.map((t) => ({ ...t }))
  if (review) {
    if (opts.rating && review.rating !== undefined) out.rating = review.rating
    if (opts.review && review.review) out.review = review.review
    if (opts.vibes && review.vibes.length) out.vibes = [...review.vibes]
    if (opts.topTracks && review.topThreeTrackIds.length) {
      out.topThreeTracks = review.topThreeTrackIds
        .map((id) => album.tracklist.find((t) => t.id === id)?.title)
        .filter((t): t is string => Boolean(t))
    }
  }
  if (opts.pressingSummary && copies.length) out.publicPressingSummary = summarizePressings(copies)
  if (opts.discogsStats && album.discogsStats) {
    const s = album.discogsStats
    out.discogs = {
      ...(s.rating !== undefined ? { rating: s.rating } : {}), ...(s.ratingCount !== undefined ? { ratingCount: s.ratingCount } : {}),
      ...(s.have !== undefined ? { have: s.have } : {}), ...(s.want !== undefined ? { want: s.want } : {}), ...(s.forSale !== undefined ? { forSale: s.forSale } : {}),
      ...(album.discogsReleaseId ? { url: `https://www.discogs.com/release/${album.discogsReleaseId}` } : {}),
    }
  }
  if (opts.money) {
    const bought = copies.filter((c) => c.purchasePrice !== undefined && c.currency).slice(0, 20)
      .map((c) => ({ ...(c.purchaseDate ? { date: c.purchaseDate } : {}), price: c.purchasePrice!, currency: c.currency! }))
    if (bought.length) out.purchases = bought
  }
  return out
}

export function buildPublicWant(w: WantlistInput, opts: PublicFieldOptions) {
  return {
    albumTitle: w.albumTitle ?? 'Album', ...(w.primaryArtist ? { primaryArtist: w.primaryArtist } : {}), ...(opts.artwork && w.artworkUrl ? { artworkUrl: w.artworkUrl } : {}),
    ...(w.releaseYear !== undefined ? { releaseYear: w.releaseYear } : {}), priority: w.priority, status: w.status,
    ...(w.desiredPressingNotes ? { desiredPressingNotes: w.desiredPressingNotes } : {}),
    ...(opts.money && w.targetPrice !== undefined && w.currency ? { targetPrice: w.targetPrice, currency: w.currency } : {}),
  }
}

export function buildPublicListen(s: ListeningSessionInput, opts: PublicFieldOptions) {
  return {
    albumTitle: s.albumTitle ?? 'Album', ...(s.primaryArtist ? { primaryArtist: s.primaryArtist } : {}), ...(opts.artwork && s.artworkUrl ? { artworkUrl: s.artworkUrl } : {}),
    date: s.date.slice(0, 10), completedAlbum: s.completedAlbum, vibeTags: [...s.vibeTags], ...(opts.journalNotes && s.notes ? { notes: s.notes } : {}),
  }
}

export function buildPublicGear(g: GearInput, opts: PublicFieldOptions) {
  return {
    name: g.name, category: g.category, ...(g.brand ? { brand: g.brand } : {}), ...(g.model ? { model: g.model } : {}), ...(g.condition ? { condition: g.condition } : {}),
    ...(opts.money && g.purchaseDate ? { purchaseDate: g.purchaseDate } : {}),
    ...(opts.money && g.purchasePrice !== undefined && g.currency ? { purchasePrice: g.purchasePrice, currency: g.currency } : {}),
  }
}

/** Only name and position. Addresses and notes stay private. Unplaced locations are skipped. */
export function buildPublicPlace(l: PurchaseLocationInput) {
  return l.latitude !== undefined && l.longitude !== undefined ? { name: l.name, latitude: l.latitude, longitude: l.longitude } : null
}

/** Unguessable share ID (128 bits, URL-safe). */
export function generateShareId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
