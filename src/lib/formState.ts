import type { AlbumDraft } from './providers/types'
import { copyInputSchema, albumInputSchema, CONDITIONS, FORMATS, type AlbumInput, type CopyInput, type Track } from './schemas'
import { makeNormalizedKey, makeSortTitle } from './normalize'

export type FormErrors = Record<string, string>
export type Result<T> = { ok: true; value: T } | { ok: false; errors: FormErrors }

const blank = (s: string) => (s.trim() === '' ? undefined : s.trim())
const num = (s: string) => (s.trim() === '' ? undefined : Number(s))
const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

function errorsOf(issues: { path: PropertyKey[]; message: string }[]): FormErrors {
  const out: FormErrors = {}
  for (const i of issues) { const k = String(i.path[0] ?? 'form'); out[k] ??= i.message }
  return out
}

/* ---------------- album ---------------- */
export interface AlbumFormState { title: string; artists: string; year: string; genres: string; labels: string; artworkUrl: string }
export interface AlbumBase {
  tracklist: Track[]
  musicBrainzReleaseGroupId?: string
  musicBrainzReleaseId?: string
  discogsMasterId?: string
  discogsReleaseId?: string
  discogsStats?: AlbumInput['discogsStats']
  externalIdentifiers: Record<string, string>
  metadataSources: string[]
  releaseDate?: string
}

export const emptyAlbumForm = (): AlbumFormState => ({ title: '', artists: '', year: '', genres: '', labels: '', artworkUrl: '' })
export const emptyAlbumBase = (): AlbumBase => ({ tracklist: [], externalIdentifiers: {}, metadataSources: ['manual'] })

export function draftToForm(d: AlbumDraft): { form: AlbumFormState; base: AlbumBase } {
  return {
    form: {
      title: d.title, artists: d.artistNames.join(', '), year: d.releaseYear ? String(d.releaseYear) : '',
      genres: d.genres.join(', '), labels: d.labelNames.join(', '), artworkUrl: d.artworkUrl ?? '',
    },
    base: {
      tracklist: d.tracklist, musicBrainzReleaseGroupId: d.musicBrainzReleaseGroupId, musicBrainzReleaseId: d.musicBrainzReleaseId,
      discogsMasterId: d.discogsMasterId, discogsReleaseId: d.discogsReleaseId, discogsStats: d.discogsStats,
      externalIdentifiers: d.externalIdentifiers, metadataSources: d.metadataSources, releaseDate: d.releaseDate,
    },
  }
}

export function formToAlbum(f: AlbumFormState, base: AlbumBase): Result<AlbumInput> {
  const artistNames = list(f.artists)
  const title = f.title.trim()
  const parsed = albumInputSchema.safeParse({
    title, sortTitle: makeSortTitle(title), artistNames, primaryArtist: artistNames[0] ?? '',
    releaseYear: num(f.year), releaseDate: base.releaseDate,
    genres: list(f.genres), labelNames: list(f.labels), artworkUrl: blank(f.artworkUrl),
    tracklist: base.tracklist, externalIdentifiers: base.externalIdentifiers, metadataSources: base.metadataSources,
    musicBrainzReleaseGroupId: base.musicBrainzReleaseGroupId, musicBrainzReleaseId: base.musicBrainzReleaseId,
    discogsMasterId: base.discogsMasterId, discogsReleaseId: base.discogsReleaseId, discogsStats: base.discogsStats,
    normalizedKey: artistNames[0] ? makeNormalizedKey(artistNames[0], title) : undefined,
  })
  if (parsed.success) return { ok: true, value: parsed.data }
  const errors = errorsOf(parsed.error.issues)
  if (errors.artistNames || errors.primaryArtist) errors.artists = 'Enter at least one artist.'
  return { ok: false, errors }
}

/* ---------------- copy ---------------- */
export interface CopyFormState {
  releaseId: string; format: string; vinylColor: string; pressingYear: string; releaseCountry: string; label: string
  catalogNumber: string; barcode: string; discCount: string; editionNotes: string
  recordCondition: string; sleeveCondition: string
  purchaseDate: string; purchasePrice: string; currency: string; seller: string; purchaseLocationId: string; privateNotes: string
}

export const emptyCopyForm = (currency = 'USD'): CopyFormState => ({
  releaseId: '', format: 'LP', vinylColor: '', pressingYear: '', releaseCountry: '', label: '', catalogNumber: '', barcode: '',
  discCount: '1', editionNotes: '', recordCondition: '', sleeveCondition: '', purchaseDate: '', purchasePrice: '', currency, seller: '', purchaseLocationId: '', privateNotes: '',
})

export function copyToForm(c: Partial<Omit<CopyInput, 'albumId'>>, currency = 'USD'): CopyFormState {
  const s = (v: unknown) => (v === undefined || v === null ? '' : String(v))
  return {
    releaseId: s(c.releaseId), format: s(c.format ?? 'LP'), vinylColor: s(c.vinylColor), pressingYear: s(c.pressingYear),
    releaseCountry: s(c.releaseCountry), label: s(c.label), catalogNumber: s(c.catalogNumber), barcode: s(c.barcode),
    discCount: s(c.discCount ?? 1), editionNotes: s(c.editionNotes), recordCondition: s(c.recordCondition), sleeveCondition: s(c.sleeveCondition),
    purchaseDate: s(c.purchaseDate), purchasePrice: s(c.purchasePrice), currency: s(c.currency ?? currency), seller: s(c.seller), purchaseLocationId: s(c.purchaseLocationId), privateNotes: s(c.privateNotes),
  }
}

export function formToCopy(f: CopyFormState): Result<Omit<CopyInput, 'albumId'>> {
  const price = num(f.purchasePrice)
  const parsed = copyInputSchema.omit({ albumId: true }).safeParse({
    releaseId: blank(f.releaseId), format: f.format, vinylColor: blank(f.vinylColor), pressingYear: num(f.pressingYear),
    releaseCountry: blank(f.releaseCountry), label: blank(f.label), catalogNumber: blank(f.catalogNumber), barcode: blank(f.barcode),
    discCount: num(f.discCount) ?? 1, editionNotes: blank(f.editionNotes),
    recordCondition: blank(f.recordCondition), sleeveCondition: blank(f.sleeveCondition),
    purchaseDate: blank(f.purchaseDate), purchasePrice: price, currency: price !== undefined ? f.currency : undefined,
    seller: blank(f.seller), purchaseLocationId: blank(f.purchaseLocationId), privateNotes: blank(f.privateNotes),
  })
  if (parsed.success) return { ok: true, value: parsed.data }
  return { ok: false, errors: errorsOf(parsed.error.issues) }
}

export { CONDITIONS, FORMATS }
