import { describe, expect, it, vi } from 'vitest'
import { createNominatimClient } from './nominatim'

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
const make = (...responses: Array<Response | Error>) => {
  const fetchFn = vi.fn(async () => { const r = responses.shift(); if (!r) throw new Error('unexpected'); if (r instanceof Error) throw r; return r }) as unknown as typeof fetch
  return { client: createNominatimClient(fetchFn), fetchFn }
}

describe('nominatim', () => {
  it('maps results to numeric coordinates and drops unusable rows', async () => {
    const { client } = make(ok([{ place_id: 1, display_name: 'Shop, London', lat: '51.5', lon: '-0.12' }, { place_id: 2, display_name: 'Bad', lat: 'x', lon: 'y' }]))
    expect(await client.search('shop london')).toEqual([{ id: '1', label: 'Shop, London', latitude: 51.5, longitude: -0.12 }])
  })
  it('does nothing for blank queries and caches repeats', async () => {
    const { client, fetchFn } = make(ok([]))
    expect(await client.search('  ')).toEqual([])
    await client.search('x'); await client.search('X')
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
  it('reports rate limits, network errors and bad payloads distinctly', async () => {
    await expect(make(new Response('', { status: 429 })).client.search('a')).rejects.toMatchObject({ kind: 'rate-limit' })
    await expect(make(new Error('offline')).client.search('a')).rejects.toMatchObject({ kind: 'network' })
    await expect(make(ok({ nope: true })).client.search('a')).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})
