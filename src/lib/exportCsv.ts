import { toCsv, type Column } from './csv'
import type { AlbumInput, CopyInput, GearInput, ListeningSessionInput, PriceObservationInput, PurchaseLocationInput, ReviewInput, WantlistInput } from './schemas'

type WithId<T> = T & { id: string }
export interface CsvSource {
  albums: WithId<AlbumInput>[]
  copies: WithId<CopyInput>[]
  reviews: WithId<ReviewInput>[]
  wantlist: WithId<WantlistInput>[]
  sessions: WithId<ListeningSessionInput>[]
  locations: WithId<PurchaseLocationInput>[]
  prices: WithId<PriceObservationInput>[]
  gear: WithId<GearInput>[]
}

const join = (xs: string[] | undefined) => (xs ?? []).join('; ')

export function albumsCsv(s: CsvSource): string {
  const reviews = new Map(s.reviews.map((r) => [r.id, r]))
  const cols: Column<WithId<AlbumInput>>[] = [
    { header: 'album_id', value: (a) => a.id }, { header: 'title', value: (a) => a.title }, { header: 'artists', value: (a) => join(a.artistNames) },
    { header: 'release_year', value: (a) => a.releaseYear }, { header: 'genres', value: (a) => join(a.genres) }, { header: 'labels', value: (a) => join(a.labelNames) },
    { header: 'owned', value: (a) => a.owned }, { header: 'copies', value: (a) => a.copyCount }, { header: 'archived', value: (a) => a.archived },
    { header: 'rating_out_of_10', value: (a) => reviews.get(a.id)?.rating }, { header: 'favorite', value: (a) => reviews.get(a.id)?.isFavorite ?? false },
    { header: 'vibes', value: (a) => join(reviews.get(a.id)?.vibes) }, { header: 'review', value: (a) => reviews.get(a.id)?.review },
    { header: 'musicbrainz_release_group_id', value: (a) => a.musicBrainzReleaseGroupId },
  ]
  return toCsv(s.albums, cols)
}

export function copiesCsv(s: CsvSource): string {
  const albums = new Map(s.albums.map((a) => [a.id, a]))
  const locs = new Map(s.locations.map((l) => [l.id, l.name]))
  const cols: Column<WithId<CopyInput>>[] = [
    { header: 'copy_id', value: (c) => c.id }, { header: 'album_id', value: (c) => c.albumId },
    { header: 'album_title', value: (c) => albums.get(c.albumId)?.title }, { header: 'artist', value: (c) => albums.get(c.albumId)?.primaryArtist },
    { header: 'format', value: (c) => c.format }, { header: 'vinyl_color', value: (c) => c.vinylColor }, { header: 'discs', value: (c) => c.discCount },
    { header: 'pressing_year', value: (c) => c.pressingYear }, { header: 'country', value: (c) => c.releaseCountry }, { header: 'label', value: (c) => c.label },
    { header: 'catalog_number', value: (c) => c.catalogNumber }, { header: 'barcode', value: (c) => c.barcode },
    { header: 'record_condition', value: (c) => c.recordCondition }, { header: 'sleeve_condition', value: (c) => c.sleeveCondition },
    { header: 'purchase_date', value: (c) => c.purchaseDate }, { header: 'price', value: (c) => c.purchasePrice }, { header: 'currency', value: (c) => c.currency },
    { header: 'seller', value: (c) => c.seller }, { header: 'purchase_location', value: (c) => (c.purchaseLocationId ? locs.get(c.purchaseLocationId) : undefined) },
    { header: 'edition_notes', value: (c) => c.editionNotes }, { header: 'private_notes', value: (c) => c.privateNotes },
  ]
  return toCsv(s.copies, cols)
}

export function wantlistCsv(s: CsvSource): string {
  const cols: Column<WithId<WantlistInput>>[] = [
    { header: 'album_title', value: (w) => w.albumTitle }, { header: 'artist', value: (w) => w.primaryArtist }, { header: 'priority', value: (w) => w.priority },
    { header: 'status', value: (w) => w.status }, { header: 'target_price', value: (w) => w.targetPrice }, { header: 'currency', value: (w) => w.currency },
    { header: 'pressing_notes', value: (w) => w.desiredPressingNotes }, { header: 'notes', value: (w) => w.notes },
  ]
  return toCsv(s.wantlist, cols)
}

export function listeningCsv(s: CsvSource): string {
  const cols: Column<WithId<ListeningSessionInput>>[] = [
    { header: 'date', value: (x) => x.date }, { header: 'album_title', value: (x) => x.albumTitle }, { header: 'artist', value: (x) => x.primaryArtist },
    { header: 'whole_album', value: (x) => x.completedAlbum }, { header: 'place', value: (x) => x.locationText }, { header: 'vibes', value: (x) => join(x.vibeTags) },
    { header: 'notes', value: (x) => x.notes },
  ]
  return toCsv([...s.sessions].sort((a, b) => b.date.localeCompare(a.date)), cols)
}

export function gearCsv(s: CsvSource): string {
  const cols: Column<WithId<GearInput>>[] = [
    { header: 'name', value: (g) => g.name }, { header: 'category', value: (g) => g.category }, { header: 'brand', value: (g) => g.brand }, { header: 'model', value: (g) => g.model },
    { header: 'condition', value: (g) => g.condition }, { header: 'purchase_date', value: (g) => g.purchaseDate }, { header: 'price', value: (g) => g.purchasePrice },
    { header: 'currency', value: (g) => g.currency }, { header: 'seller', value: (g) => g.seller }, { header: 'notes', value: (g) => g.notes },
  ]
  return toCsv([...s.gear].sort((a, b) => (b.purchaseDate ?? '').localeCompare(a.purchaseDate ?? '')), cols)
}

export function pricesCsv(s: CsvSource): string {
  const albums = new Map(s.albums.map((a) => [a.id, a]))
  const cols: Column<WithId<PriceObservationInput>>[] = [
    { header: 'date', value: (p) => p.observedAt }, { header: 'album_title', value: (p) => albums.get(p.albumId)?.title }, { header: 'artist', value: (p) => albums.get(p.albumId)?.primaryArtist },
    { header: 'type', value: (p) => p.observationType }, { header: 'price', value: (p) => p.price }, { header: 'currency', value: (p) => p.currency },
    { header: 'provider', value: (p) => p.provider }, { header: 'condition', value: (p) => p.condition }, { header: 'applies_to_copy_id', value: (p) => p.copyId },
    { header: 'source_url', value: (p) => p.sourceUrl },
  ]
  return toCsv(s.prices, cols)
}

import type { z } from 'zod'
import { albumInputSchema, copyInputSchema, gearInputSchema, listeningSessionInputSchema, priceObservationInputSchema, purchaseLocationInputSchema, reviewInputSchema, wantlistInputSchema } from './schemas'
import type { RawDoc } from './backup'

function typed<S extends z.ZodType>(schema: S, docs: RawDoc[]): WithId<z.infer<S>>[] {
  const out: WithId<z.infer<S>>[] = []
  for (const d of docs) { const p = schema.safeParse(d.data); if (p.success) out.push({ ...(p.data as object), id: d.id } as WithId<z.infer<S>>) }
  return out
}

/** Validates stored records for CSV output; anything unreadable is left out of the CSV (it is still in the JSON backup). */
export function buildCsvSource(docs: Record<'albums' | 'copies' | 'reviews' | 'wantlist' | 'listeningSessions' | 'purchaseLocations' | 'priceObservations' | 'gear', RawDoc[]>): CsvSource {
  return {
    albums: typed(albumInputSchema, docs.albums), copies: typed(copyInputSchema, docs.copies), reviews: typed(reviewInputSchema, docs.reviews),
    wantlist: typed(wantlistInputSchema, docs.wantlist), sessions: typed(listeningSessionInputSchema, docs.listeningSessions),
    locations: typed(purchaseLocationInputSchema, docs.purchaseLocations), prices: typed(priceObservationInputSchema, docs.priceObservations), gear: typed(gearInputSchema, docs.gear),
  }
}
