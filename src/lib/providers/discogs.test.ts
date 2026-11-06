import { describe, expect, it, vi } from 'vitest'
import { authFromSettings, createDiscogsClient, discogsAuthHeader } from './discogs'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
function make(...responses: Array<Response | Error>) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetchFn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    const r = responses.shift(); if (!r) throw new Error('unexpected'); if (r instanceof Error) throw r; return r
  }) as unknown as typeof fetch
  return { client: createDiscogsClient({ auth: { token: 'tok_1234567890' }, fetchFn, now: () => new Date('2026-03-10T12:00:00Z') }), calls }
}

describe('discogs client', () => {
  it('sends the token as an Authorization header, not in the URL', async () => {
    const { client, calls } = make(json({ results: [] }))
    await client.searchReleases('miles davis kind of blue', 'text')
    expect((calls[0]!.init?.headers as Record<string, string>).Authorization).toBe('Discogs token=tok_1234567890')
    expect(calls[0]!.url).not.toContain('tok_1234567890')
    expect(calls[0]!.url).toContain('format=Vinyl')
  })
  it('uses barcode digits and catalog number filters', async () => {
    const a = make(json({ results: [] })); await a.client.searchReleases('0 74646 39321 4', 'barcode')
    expect(a.calls[0]!.url).toContain('barcode=074646393214')
    const b = make(json({ results: [] })); await b.client.searchReleases('CL 1355', 'catalog')
    expect(decodeURIComponent(b.calls[0]!.url.replace(/\+/g, ' '))).toContain('catno=CL 1355')
  })
  it('maps search results', async () => {
    const { client } = make(json({ results: [{ id: 123, title: 'Miles Davis - Kind Of Blue', year: '1959', country: 'US', format: ['Vinyl', 'LP'], label: ['Columbia'], catno: 'CL 1355' }] }))
    expect(await client.searchReleases('x', 'text')).toEqual([{ id: '123', title: 'Miles Davis - Kind Of Blue', year: 1959, country: 'US', format: 'Vinyl, LP', label: 'Columbia', catalogNumber: 'CL 1355' }])
  })
  it('reads the lowest asking price and labels where it came from', async () => {
    const { client } = make(json({ lowest_price: { value: 24.99, currency: 'USD' }, num_for_sale: 12 }))
    expect(await client.lowestListing('123', 'USD')).toEqual({ provider: 'discogs', releaseId: '123', currency: 'USD', lowestPrice: 24.99, numForSale: 12, sourceUrl: 'https://www.discogs.com/release/123', fetchedAt: '2026-03-10T12:00:00.000Z' })
  })
  it('handles nothing for sale and blocked releases', async () => {
    expect((await make(json({ lowest_price: null, num_for_sale: 0 })).client.lowestListing('1', 'USD')).lowestPrice).toBeUndefined()
    expect((await make(json({ lowest_price: { value: 5 }, blocked_from_sale: true })).client.lowestListing('1', 'USD')).lowestPrice).toBeUndefined()
  })
  it('reports auth, rate-limit, network and shape problems distinctly', async () => {
    await expect(make(json({}, 401)).client.lowestListing('1', 'USD')).rejects.toThrow(/credentials/)
    await expect(make(json({}, 429)).client.lowestListing('1', 'USD')).rejects.toMatchObject({ kind: 'rate-limit' })
    await expect(make(new Error('offline')).client.lowestListing('1', 'USD')).rejects.toMatchObject({ kind: 'network' })
    await expect(make(json({ results: 'nope' })).client.searchReleases('x', 'text')).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})

describe('discogs credentials', () => {
  it('builds the header for a token or for an application key and secret', () => {
    expect(discogsAuthHeader({ token: 'abc' })).toBe('Discogs token=abc')
    expect(discogsAuthHeader({ key: 'k', secret: 's' })).toBe('Discogs key=k, secret=s')
  })
  it('prefers key and secret when both kinds are saved, and returns nothing when empty', () => {
    expect(authFromSettings({ discogsToken: 't0123456789', discogsKey: 'key12345', discogsSecret: 'sec12345' })).toEqual({ key: 'key12345', secret: 'sec12345' })
    expect(authFromSettings({ discogsToken: 't0123456789' })).toEqual({ token: 't0123456789' })
    expect(authFromSettings({})).toBeUndefined()
    expect(authFromSettings(null)).toBeUndefined()
  })
  it('keeps the secret out of the request URL', async () => {
    const seen: { url: string; headers: unknown }[] = []
    const fetchFn = (async (u: RequestInfo | URL, init?: RequestInit) => { seen.push({ url: String(u), headers: init?.headers }); return json({ results: [] }) }) as unknown as typeof fetch
    await createDiscogsClient({ auth: { key: 'mykey123', secret: 'mysecret123' }, fetchFn }).searchReleases('x', 'text')
    expect(seen[0]!.url).not.toContain('mysecret123')
    expect((seen[0]!.headers as Record<string, string>).Authorization).toBe('Discogs key=mykey123, secret=mysecret123')
  })
})
