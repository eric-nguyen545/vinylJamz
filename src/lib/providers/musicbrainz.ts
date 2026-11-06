import { z } from 'zod'
import { list, nnum, nstr, num, str, text } from './lenient'
import type { CopyInput } from '../schemas'
import {
  ProviderError,
  type AlbumSearchResult,
  type MusicMetadataProvider,
  type ReleaseCandidate,
  type ReleaseDetails,
  type SearchMode,
} from './types'

const API = 'https://musicbrainz.org/ws/2'
const SITE = 'https://musicbrainz.org'
export const COVER_ART = 'https://coverartarchive.org'

/* ---- tolerant runtime schemas ----
 * MusicBrainz data is often incomplete, and field types occasionally differ from what you'd expect
 * (null instead of missing, numbers instead of strings). Anything unusable becomes "missing" instead of
 * failing the whole request, and individual malformed items in a list are skipped. Only the IDs we
 * rely on are required. */
const credit = z.object({ name: str, artist: z.object({ name: str }).optional().catch(undefined) })
const labelInfo = z.object({ 'catalog-number': nstr, label: z.object({ name: str }).nullish().catch(undefined) })
const track = z.object({ id: str, number: text, title: str, length: nnum })
const medium = z.object({ position: num, format: nstr, tracks: list(track) })
const genre = z.object({ name: z.string() })
const releaseShape = z.object({
  id: z.string(),
  title: str,
  date: nstr.transform((v) => v ?? undefined),
  country: nstr.transform((v) => v ?? undefined),
  barcode: nstr,
  'artist-credit': list(credit),
  'label-info': list(labelInfo),
  media: list(medium),
  genres: list(genre),
  'release-group': z.object({ id: z.string(), genres: list(genre) }).optional().catch(undefined),
})
const groupShape = z.object({
  id: z.string(),
  title: str,
  'first-release-date': nstr.transform((v) => v ?? undefined),
  'artist-credit': list(credit),
})
const groupSearch = z.object({ 'release-groups': list(groupShape) })
const releaseSearch = z.object({ releases: list(releaseShape) })

type ReleaseData = z.infer<typeof releaseShape>

export interface ClientOptions {
  fetchFn?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  minIntervalMs?: number
  cacheTtlMs?: number
  maxRetries?: number
}

const yearOf = (d?: string) => {
  const y = d ? Number.parseInt(d.slice(0, 4), 10) : NaN
  return Number.isFinite(y) ? y : undefined
}
const artistsOf = (c?: z.infer<typeof credit>[]) =>
  (c ?? []).map((x) => (x.name ?? x.artist?.name ?? '').trim()).filter(Boolean)

/** Maps a MusicBrainz medium format string to our format list. */
export function mapFormat(raw?: string | null): CopyInput['format'] {
  const f = (raw ?? '').toLowerCase()
  if (!f.includes('vinyl')) return 'Other'
  if (f.startsWith('7')) return '7"'
  if (f.startsWith('10')) return '10"'
  return 'LP'
}
const isVinyl = (m?: z.infer<typeof medium>[]) => (m ?? []).some((x) => (x.format ?? '').toLowerCase().includes('vinyl'))
const formatLabel = (m?: z.infer<typeof medium>[]) => {
  const f = [...new Set((m ?? []).map((x) => x.format).filter((x): x is string => Boolean(x)))]
  return f.length ? f.join(' + ') : undefined
}

export function createMusicBrainzProvider(opts: ClientOptions = {}): MusicMetadataProvider {
  const fetchFn = opts.fetchFn ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const now = opts.now ?? (() => Date.now())
  const minInterval = opts.minIntervalMs ?? 1100 // MusicBrainz asks for ~1 request/second
  const ttl = opts.cacheTtlMs ?? 60 * 60 * 1000
  const maxRetries = opts.maxRetries ?? 2
  const cache = new Map<string, { at: number; data: unknown }>()
  let last = -Infinity
  let chain: Promise<unknown> = Promise.resolve()

  /** Serializes requests and spaces them out; never bursts in parallel. */
  function schedule<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      const wait = last + minInterval - now()
      if (wait > 0) await sleep(wait)
      last = now()
      return fn()
    })
    chain = run.catch(() => undefined)
    return run
  }

  async function getJson(path: string, params: Record<string, string>): Promise<unknown> {
    const url = `${API}/${path}?${new URLSearchParams({ ...params, fmt: 'json' }).toString()}`
    const hit = cache.get(url)
    if (hit && now() - hit.at < ttl) return hit.data
    for (let attempt = 0; ; attempt++) {
      let res: Response
      try {
        res = await schedule(() => fetchFn(url, { headers: { Accept: 'application/json' } }))
      } catch {
        throw new ProviderError('network', 'Could not reach MusicBrainz. Check your connection.')
      }
      if (res.status === 503 || res.status === 429) {
        if (attempt < maxRetries) {
          const ra = Number(res.headers.get('Retry-After'))
          await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2000 * (attempt + 1))
          continue
        }
        throw new ProviderError('rate-limit', 'MusicBrainz is busy. Wait a moment and search again.')
      }
      if (!res.ok) throw new ProviderError('unavailable', `MusicBrainz returned an error (${res.status}).`)
      let data: unknown
      try { data = await res.json() } catch { throw new ProviderError('invalid-response', 'MusicBrainz sent an unreadable response.') }
      cache.set(url, { at: now(), data })
      return data
    }
  }

  const parse = <T extends z.ZodType>(schema: T, data: unknown): z.infer<T> => {
    const r = schema.safeParse(data)
    if (!r.success) {
      const issue = r.error.issues[0]
      console.warn('MusicBrainz response did not match the expected shape', r.error.issues, data)
      throw new ProviderError('invalid-response', `MusicBrainz sent data in an unexpected shape${issue ? ` (${issue.path.join('.') || 'top level'}: ${issue.message})` : ''}. Details are in the browser console.`)
    }
    return r.data
  }

  const esc = (s: string) => s.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1')

  function releaseToResult(r: ReleaseData): AlbumSearchResult {
    const li = r['label-info']?.[0]
    return {
      source: 'musicbrainz', kind: 'release', id: r.id, releaseGroupId: r['release-group']?.id,
      title: r.title ?? 'Untitled', artistNames: artistsOf(r['artist-credit']), year: yearOf(r.date),
      country: r.country, format: formatLabel(r.media), label: li?.label?.name,
      catalogNumber: li?.['catalog-number'] ?? undefined, barcode: r.barcode ?? undefined,
      artworkUrl: `${COVER_ART}/release/${r.id}/front-250`, sourceUrl: `${SITE}/release/${r.id}`,
    }
  }

  return {
    async searchAlbums(query: string, mode: SearchMode) {
      const q = query.trim()
      if (!q) return []
      if (mode === 'barcode' || mode === 'catalog') {
        const field = mode === 'barcode' ? 'barcode' : 'catno'
        const value = mode === 'barcode' ? q.replace(/\D/g, '') : q
        if (!value) return []
        const data = parse(releaseSearch, await getJson('release', { query: `${field}:"${esc(value)}"`, limit: '15' }))
        return data.releases.map(releaseToResult)
      }
      // Each word must match the album title or the artist name.
      const tokens = q.split(/\s+/).map(esc).filter(Boolean)
      const lucene = tokens.map((t) => `(releasegroup:${t} OR artistname:${t})`).join(' AND ')
      const data = parse(groupSearch, await getJson('release-group', { query: `${lucene} AND (primarytype:album OR primarytype:ep)`, limit: '15' }))
      return data['release-groups'].map<AlbumSearchResult>((g) => ({
        source: 'musicbrainz', kind: 'release-group', id: g.id, releaseGroupId: g.id,
        title: g.title ?? 'Untitled', artistNames: artistsOf(g['artist-credit']), year: yearOf(g['first-release-date']),
        artworkUrl: `${COVER_ART}/release-group/${g.id}/front-250`, sourceUrl: `${SITE}/release-group/${g.id}`,
      }))
    },

    async getReleaseCandidates(releaseGroupId: string): Promise<ReleaseCandidate[]> {
      const data = parse(releaseSearch, await getJson('release', {
        'release-group': releaseGroupId, inc: 'labels+media', limit: '100',
      }))
      return data.releases
        .map<ReleaseCandidate>((r) => {
          const li = r['label-info']?.[0]
          return {
            source: 'musicbrainz' as const, id: r.id, title: r.title ?? 'Untitled', date: r.date, year: yearOf(r.date), country: r.country,
            format: formatLabel(r.media), isVinyl: isVinyl(r.media), discCount: r.media?.length || undefined,
            label: li?.label?.name, catalogNumber: li?.['catalog-number'] ?? undefined, barcode: r.barcode ?? undefined,
            sourceUrl: `${SITE}/release/${r.id}`,
          }
        })
        .sort((a, b) => Number(b.isVinyl) - Number(a.isVinyl) || (a.date ?? '9999').localeCompare(b.date ?? '9999'))
    },

    async getRelease(releaseId: string): Promise<ReleaseDetails | null> {
      const r = parse(releaseShape, await getJson(`release/${releaseId}`, { inc: 'recordings+artist-credits+labels+release-groups+genres+media' }))
      const artistNames = artistsOf(r['artist-credit'])
      if (!r.title || !artistNames.length) return null
      const li = r['label-info']?.[0]
      const labels = [...new Set((r['label-info'] ?? []).map((x) => x.label?.name).filter((x): x is string => Boolean(x)))]
      const genres = [...new Set([...(r.genres ?? []), ...(r['release-group']?.genres ?? [])].map((g) => g.name))]
      const tracklist = (r.media ?? []).flatMap((m, mi) =>
        (m.tracks ?? []).map((t, ti) => ({
          id: t.id ?? `${mi + 1}-${ti + 1}`,
          position: (r.media?.length ?? 0) > 1 ? `${m.position ?? mi + 1}-${t.number ?? ti + 1}` : (t.number ?? String(ti + 1)),
          title: t.title ?? 'Untitled',
          ...(typeof t.length === 'number' ? { durationMs: t.length } : {}),
        })),
      )
      const groupId = r['release-group']?.id
      return {
        album: {
          title: r.title, artistNames, primaryArtist: artistNames[0]!, releaseDate: r.date, releaseYear: yearOf(r.date),
          genres, styles: [], labelNames: labels, tracklist,
          artworkUrl: `${COVER_ART}/release/${r.id}/front-500`,
          musicBrainzReleaseId: r.id, musicBrainzReleaseGroupId: groupId,
          externalIdentifiers: { musicbrainzRelease: r.id, ...(groupId ? { musicbrainzReleaseGroup: groupId } : {}) },
          metadataSources: ['musicbrainz', 'coverartarchive'],
        },
        copyDefaults: {
          releaseId: r.id, catalogNumber: li?.['catalog-number'] ?? undefined, barcode: r.barcode ?? undefined,
          releaseCountry: r.country, pressingYear: yearOf(r.date), releaseDate: r.date, label: li?.label?.name,
          format: mapFormat(r.media?.find((m) => (m.format ?? '').toLowerCase().includes('vinyl'))?.format ?? r.media?.[0]?.format),
          discCount: r.media?.length || 1,
        },
      }
    },
  }
}

export const musicBrainz = createMusicBrainzProvider()
