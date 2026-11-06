import { z } from 'zod'
import { ProviderError, type SearchMode } from './types'

export interface DiscogsCandidate { id: string; title: string; year?: number; country?: string; format?: string; label?: string; catalogNumber?: string }
export interface PriceLookup {
  provider: 'discogs'; releaseId: string; currency: string
  /** Lowest current marketplace asking price, if anything is for sale. */
  lowestPrice?: number
  numForSale?: number
  sourceUrl: string
  fetchedAt: string
}

const searchSchema = z.object({
  results: z.array(z.object({
    id: z.number(), title: z.string().optional(), year: z.union([z.string(), z.number()]).optional(), country: z.string().optional(),
    format: z.array(z.string()).optional(), label: z.array(z.string()).optional(), catno: z.string().optional(),
  })).default([]),
})
const statsSchema = z.object({
  lowest_price: z.union([z.object({ value: z.number(), currency: z.string().optional() }), z.number(), z.null()]).optional(),
  num_for_sale: z.number().optional(),
  blocked_from_sale: z.boolean().optional(),
})

export type DiscogsAuth = { token: string } | { key: string; secret: string }

/** Credentials go in a header, never in the URL, so they don't end up in history or logs. */
export const discogsAuthHeader = (a: DiscogsAuth) => ('token' in a ? `Discogs token=${a.token}` : `Discogs key=${a.key}, secret=${a.secret}`)

export function authFromSettings(s: { discogsToken?: string; discogsKey?: string; discogsSecret?: string } | null | undefined): DiscogsAuth | undefined {
  if (s?.discogsKey && s.discogsSecret) return { key: s.discogsKey, secret: s.discogsSecret }
  if (s?.discogsToken) return { token: s.discogsToken }
  return undefined
}

export const discogsReleaseUrl = (id: string) => `https://www.discogs.com/release/${id}`

/**
 * Optional Discogs lookups using the owner's personal token or application key and secret. Requests run in the browser and only
 * when a button is pressed. Not exercised against the live API in this repo's tests (mocked fetch only).
 */
export function createDiscogsClient(opts: { auth: DiscogsAuth; fetchFn?: typeof fetch; now?: () => Date }) {
  const fetchFn = opts.fetchFn ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
  const now = opts.now ?? (() => new Date())

  async function get(url: string): Promise<unknown> {
    let res: Response
    try { res = await fetchFn(url, { headers: { Accept: 'application/json', Authorization: discogsAuthHeader(opts.auth) } }) }
    catch { throw new ProviderError('network', 'Could not reach Discogs. Check your connection.') }
    if (res.status === 401 || res.status === 403) throw new ProviderError('unavailable', 'Discogs rejected your credentials. Check them in Settings.')
    if (res.status === 404) throw new ProviderError('unavailable', 'Discogs doesn’t have that release.')
    if (res.status === 429) throw new ProviderError('rate-limit', 'Discogs rate limit reached. Wait a minute and try again.')
    if (!res.ok) throw new ProviderError('unavailable', `Discogs returned an error (${res.status}).`)
    try { return await res.json() } catch { throw new ProviderError('invalid-response', 'Discogs sent an unreadable response.') }
  }

  return {
    /** Authenticated GET against api.discogs.com for catalog lookups (path like 'releases/123'). */
    async raw(path: string, params: Record<string, string> = {}): Promise<unknown> {
      if (!/^[A-Za-z0-9/_-]+$/.test(path)) throw new ProviderError('invalid-response', 'Bad Discogs path.')
      const qs = new URLSearchParams(params).toString()
      return get(`https://api.discogs.com/${path}${qs ? `?${qs}` : ''}`)
    },

    async searchReleases(q: string, mode: SearchMode): Promise<DiscogsCandidate[]> {
      const text = q.trim()
      if (!text) return []
      const params = new URLSearchParams({ type: 'release', per_page: '8' })
      if (mode === 'barcode') params.set('barcode', text.replace(/\D/g, ''))
      else if (mode === 'catalog') params.set('catno', text)
      else { params.set('q', text); params.set('format', 'Vinyl') }
      const parsed = searchSchema.safeParse(await get(`https://api.discogs.com/database/search?${params}`))
      if (!parsed.success) throw new ProviderError('invalid-response', 'Discogs sent data in an unexpected shape.')
      return parsed.data.results.map((r) => ({
        id: String(r.id), title: r.title ?? 'Untitled', year: r.year ? Number(r.year) || undefined : undefined, country: r.country,
        format: r.format?.join(', '), label: r.label?.[0], catalogNumber: r.catno,
      }))
    },

    async lowestListing(releaseId: string, currency: string): Promise<PriceLookup> {
      const parsed = statsSchema.safeParse(await get(`https://api.discogs.com/marketplace/stats/${encodeURIComponent(releaseId)}?${new URLSearchParams({ curr_abbr: currency })}`))
      if (!parsed.success) throw new ProviderError('invalid-response', 'Discogs sent data in an unexpected shape.')
      const lp = parsed.data.lowest_price
      const value = typeof lp === 'number' ? lp : lp?.value
      const cur = typeof lp === 'object' && lp?.currency ? lp.currency : currency
      return {
        provider: 'discogs', releaseId, currency: cur, lowestPrice: parsed.data.blocked_from_sale ? undefined : value,
        numForSale: parsed.data.num_for_sale, sourceUrl: discogsReleaseUrl(releaseId), fetchedAt: now().toISOString(),
      }
    },
  }
}
