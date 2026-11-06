import { describe, expect, it } from 'vitest'
import { albumInputSchema, httpUrl, priceObservationInputSchema, publicAlbumSchema, wantlistInputSchema } from './schemas'

describe('http(s)-only URLs', () => {
  it('accepts normal links and rejects script-capable schemes', () => {
    expect(httpUrl.safeParse('https://coverartarchive.org/release/1/front-500').success).toBe(true)
    expect(httpUrl.safeParse('http://example.com/a.jpg').success).toBe(true)
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd', 'ftp://x.com/a', 'not a url', '//evil.com']) {
      expect(httpUrl.safeParse(bad).success, bad).toBe(false)
    }
  })
  it('is enforced everywhere a link is stored or displayed', () => {
    const evil = 'javascript:alert(document.cookie)'
    expect(albumInputSchema.safeParse({ title: 'T', sortTitle: 't', artistNames: ['A'], primaryArtist: 'A', artworkUrl: evil }).success).toBe(false)
    expect(wantlistInputSchema.safeParse({ albumId: 'a', artworkUrl: evil }).success).toBe(false)
    expect(priceObservationInputSchema.safeParse({ albumId: 'a', provider: 'manual', observationType: 'sold', price: 1, currency: 'USD', observedAt: '2026-01-01', sourceUrl: evil }).success).toBe(false)
    expect(publicAlbumSchema.safeParse({ title: 'T', artworkUrl: evil }).success).toBe(false)
  })
  it('rejects absurdly long URLs', () => { expect(httpUrl.safeParse(`https://x.com/${'a'.repeat(2100)}`).success).toBe(false) })
})
