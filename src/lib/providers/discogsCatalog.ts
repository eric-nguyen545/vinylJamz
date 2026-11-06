import { z } from 'zod'
import { list, nnum, nstr, str, text } from './lenient'
import { discogsReleaseUrl, type createDiscogsClient } from './discogs'
import {
  ProviderError, type AlbumSearchResult, type MusicMetadataProvider, type ReleaseCandidate, type ReleaseDetails, type SearchMode,
} from './types'
import type { AlbumInput, CopyInput } from '../schemas'

type Client = ReturnType<typeof createDiscogsClient>

/** Discogs disambiguates same-named artists as "Nirvana (2)". */
export const cleanName = (n: string) => n.replace(/\s+\(\d+\)$/, '').trim()

/** "5:30" -> 330000, "1:02:03" -> 3723000; anything else -> undefined. */
export function parseDuration(d?: string): number | undefined {
  if (!d || !/^\d+(:\d{1,2}){1,2}$/.test(d)) return undefined
  const parts = d.split(':').map(Number)
  const secs = parts.reduce((acc, p) => acc * 60 + p, 0)
  return secs > 0 ? secs * 1000 : undefined
}

const yearOf = (v?: string | number | null) => { const y = Number.parseInt(String(v ?? '').slice(0, 4), 10); return Number.isFinite(y) && y > 1800 ? y : undefined }
const strings = z.array(z.unknown()).catch([]).transform((a) => a.filter((x): x is string => typeof x === 'string'))

const searchRow = z.object({
  id: z.number(), master_id: nnum, title: str, year: text, country: str, format: strings, label: strings, catno: str,
  barcode: strings, thumb: str, cover_image: str, genre: strings, style: strings,
})
const searchResp = z.object({ results: list(searchRow) })
const versionRow = z.object({ id: z.number(), title: str, major_formats: strings, format: str, label: str, country: str, released: text, catno: str, thumb: str })
const versionsResp = z.object({ versions: list(versionRow) })

const releaseResp = z.object({
  id: z.number(), title: str, year: text, released: text, country: str, master_id: nnum, uri: str,
  artists: list(z.object({ name: str })),
  labels: list(z.object({ name: str, catno: str })),
  genres: strings, styles: strings,
  formats: list(z.object({ name: str, qty: text, text: str, descriptions: strings })),
  tracklist: list(z.object({ position: text, title: str, duration: str, type_: str })),
  images: list(z.object({ type: str, uri: str, uri150: str })),
  identifiers: list(z.object({ type: str, value: str })),
  community: z.object({ have: nnum, want: nnum, rating: z.object({ average: nnum, count: nnum }).optional().catch(undefined) }).optional().catch(undefined),
  num_for_sale: nnum, notes: nstr, data_quality: str,
  videos: list(z.object({ uri: str, title: str })),
  extraartists: list(z.object({ name: str, role: str })),
})
export type DiscogsRelease = z.infer<typeof releaseResp>

/** Splits a Discogs search title ("Artist - Album") into its parts. */
export function splitTitle(t: string | undefined): { artist: string; title: string } {
  const raw = t ?? 'Untitled'
  const i = raw.indexOf(' - ')
  return i > 0 ? { artist: cleanName(raw.slice(0, i)), title: raw.slice(i + 3).trim() } : { artist: '', title: raw }
}

const httpsOnly = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : undefined)

export function mapFormat(formats: DiscogsRelease['formats']): { format: CopyInput['format']; vinylColor?: string; discCount: number; notes?: string } {
  const vinyl = formats.find((f) => (f.name ?? '').toLowerCase() === 'vinyl') ?? formats.find((f) => (f.name ?? '').toLowerCase().includes('box'))
  if (!vinyl) return { format: 'Other', discCount: 1 }
  const d = vinyl.descriptions.map((x) => x.toLowerCase())
  const format: CopyInput['format'] = d.includes('7"') ? '7"' : d.includes('10"') ? '10"' : (vinyl.name ?? '').toLowerCase().includes('box') ? 'Box set' : d.includes('ep') && !d.includes('lp') ? 'EP' : 'LP'
  const qty = Number.parseInt(vinyl.qty ?? '1', 10)
  const notes = vinyl.descriptions.filter((x) => !/^(lp|ep|12"|10"|7"|album|single|maxi-single)$/i.test(x)).join(', ')
  return { format, vinylColor: vinyl.text?.trim() || undefined, discCount: Number.isFinite(qty) && qty > 0 ? qty : 1, notes: notes || undefined }
}

export function communityStats(r: Pick<DiscogsRelease, 'community' | 'num_for_sale'>, now = new Date()): NonNullable<AlbumInput['discogsStats']> {
  const c = r.community
  return {
    ...(c?.rating?.average != null ? { rating: c.rating.average } : {}), ...(c?.rating?.count != null ? { ratingCount: c.rating.count } : {}),
    ...(c?.have != null ? { have: c.have } : {}), ...(c?.want != null ? { want: c.want } : {}),
    ...(r.num_for_sale != null ? { forSale: r.num_for_sale } : {}), fetchedAt: now.toISOString(),
  }
}

export function parseRelease(data: unknown): DiscogsRelease {
  const p = releaseResp.safeParse(data)
  if (!p.success) throw new ProviderError('invalid-response', 'Discogs sent a release in an unexpected shape.')
  return p.data
}

export function releaseToDetails(r: DiscogsRelease, now = new Date()): ReleaseDetails | null {
  const artistNames = r.artists.map((a) => cleanName(a.name ?? '')).filter(Boolean)
  if (!r.title || !artistNames.length) return null
  const fmt = mapFormat(r.formats)
  const label = r.labels[0]
  const labelNames = [...new Set(r.labels.map((l) => cleanName(l.name ?? '')).filter(Boolean))]
  const tracklist = r.tracklist.filter((t) => (t.type_ ?? 'track') === 'track' && t.title).map((t, i) => ({
    id: `${r.id}-${i + 1}`, position: (t.position ?? String(i + 1)).slice(0, 20), title: t.title!.slice(0, 300), ...(parseDuration(t.duration) ? { durationMs: parseDuration(t.duration) } : {}),
  }))
  const image = r.images.find((i) => i.type === 'primary') ?? r.images[0]
  const barcode = r.identifiers.find((i) => (i.type ?? '').toLowerCase() === 'barcode')?.value?.replace(/[^0-9A-Za-z]/g, '')
  const master = r.master_id ? String(r.master_id) : undefined
  const releaseDate = r.released && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(r.released) ? r.released : undefined
  return {
    album: {
      title: r.title, artistNames, primaryArtist: artistNames[0]!, releaseYear: yearOf(r.year ?? r.released), releaseDate,
      genres: r.genres, styles: r.styles, labelNames, tracklist, artworkUrl: httpsOnly(image?.uri) ?? httpsOnly(image?.uri150),
      discogsReleaseId: String(r.id), discogsMasterId: master, discogsStats: communityStats(r, now),
      externalIdentifiers: { discogsRelease: String(r.id), ...(master ? { discogsMaster: master } : {}) }, metadataSources: ['discogs'],
    },
    copyDefaults: {
      releaseId: `discogs:${r.id}`, catalogNumber: label?.catno && label.catno !== 'none' ? label.catno : undefined, barcode: barcode || undefined,
      releaseCountry: r.country, pressingYear: yearOf(r.year ?? r.released), releaseDate, label: label?.name ? cleanName(label.name) : undefined,
      format: fmt.format, discCount: fmt.discCount, vinylColor: fmt.vinylColor, editionNotes: fmt.notes,
    },
  }
}

/** Discogs as a catalog source: masters are albums, versions/releases are pressings. */
export function createDiscogsCatalog(client: Client): MusicMetadataProvider {
  return {
    async searchAlbums(query: string, mode: SearchMode): Promise<AlbumSearchResult[]> {
      const q = query.trim()
      if (!q) return []
      const params: Record<string, string> = { per_page: '10' }
      if (mode === 'barcode') { params.type = 'release'; params.barcode = q.replace(/\D/g, '') }
      else if (mode === 'catalog') { params.type = 'release'; params.catno = q }
      else { params.type = 'master'; params.q = q }
      const parsed = searchResp.safeParse(await client.raw('database/search', params))
      if (!parsed.success) throw new ProviderError('invalid-response', 'Discogs sent search results in an unexpected shape.')
      return parsed.data.results.map<AlbumSearchResult>((r) => {
        const { artist, title } = splitTitle(r.title)
        const isRelease = params.type === 'release'
        return {
          source: 'discogs', kind: isRelease ? 'release' : 'release-group', id: String(r.id), releaseGroupId: r.master_id ? String(r.master_id) : undefined,
          title, artistNames: artist ? [artist] : [], year: yearOf(r.year), country: r.country, format: r.format.join(', ') || undefined, label: r.label[0],
          catalogNumber: r.catno, barcode: r.barcode[0], artworkUrl: httpsOnly(r.thumb) ?? httpsOnly(r.cover_image),
          sourceUrl: isRelease ? discogsReleaseUrl(String(r.id)) : `https://www.discogs.com/master/${r.id}`,
        }
      })
    },

    async getReleaseCandidates(masterId: string): Promise<ReleaseCandidate[]> {
      const parsed = versionsResp.safeParse(await client.raw(`masters/${encodeURIComponent(masterId)}/versions`, { per_page: '100', sort: 'released', sort_order: 'asc' }))
      if (!parsed.success) throw new ProviderError('invalid-response', 'Discogs sent pressings in an unexpected shape.')
      return parsed.data.versions
        .map<ReleaseCandidate>((v) => {
          const fmt = v.format ?? v.major_formats.join(', ')
          return {
            source: 'discogs', id: String(v.id), title: v.title ?? 'Untitled', date: v.released, year: yearOf(v.released), country: v.country,
            format: fmt || undefined, isVinyl: /vinyl/i.test(fmt) || v.major_formats.some((m) => /vinyl/i.test(m)), label: v.label, catalogNumber: v.catno,
            sourceUrl: discogsReleaseUrl(String(v.id)),
          }
        })
        .sort((a, b) => Number(b.isVinyl) - Number(a.isVinyl))
    },

    async getRelease(releaseId: string): Promise<ReleaseDetails | null> {
      return releaseToDetails(parseRelease(await client.raw(`releases/${encodeURIComponent(releaseId)}`)))
    },
  }
}
