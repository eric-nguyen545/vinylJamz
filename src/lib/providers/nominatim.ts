import { z } from 'zod'
import { ProviderError } from './types'

export interface GeocodeResult { id: string; label: string; latitude: number; longitude: number }

const rowSchema = z.array(z.object({ place_id: z.union([z.number(), z.string()]), display_name: z.string(), lat: z.string(), lon: z.string() }))

/**
 * Geocoding via OpenStreetMap Nominatim. Only called from an explicit button press
 * (never while typing, never in the background), per the Nominatim usage policy.
 */
export function createNominatimClient(fetchFn: typeof fetch = (...a) => fetch(...a)) {
  const cache = new Map<string, GeocodeResult[]>()
  return {
    async search(q: string): Promise<GeocodeResult[]> {
      const text = q.trim()
      if (!text) return []
      const hit = cache.get(text.toLowerCase())
      if (hit) return hit
      let res: Response
      try {
        res = await fetchFn(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: text, format: 'jsonv2', limit: '5' })}`, { headers: { Accept: 'application/json' } })
      } catch { throw new ProviderError('network', 'Could not reach the address lookup service.') }
      if (res.status === 429 || res.status === 503) throw new ProviderError('rate-limit', 'The address lookup is busy. Try again in a moment.')
      if (!res.ok) throw new ProviderError('unavailable', `Address lookup failed (${res.status}).`)
      const parsed = rowSchema.safeParse(await res.json().catch(() => null))
      if (!parsed.success) throw new ProviderError('invalid-response', 'Address lookup sent an unexpected response.')
      const out = parsed.data
        .map((r) => ({ id: String(r.place_id), label: r.display_name, latitude: Number(r.lat), longitude: Number(r.lon) }))
        .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
      cache.set(text.toLowerCase(), out)
      return out
    },
  }
}

export const nominatim = createNominatimClient()
