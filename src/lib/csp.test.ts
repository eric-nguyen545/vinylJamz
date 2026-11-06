import { describe, expect, it } from 'vitest'
import { buildCsp } from './csp'

describe('buildCsp', () => {
  const csp = buildCsp()
  const directive = (name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `))
  it('blocks plugins, base-tag hijacking and cross-site form posts', () => {
    expect(directive('object-src')).toBe("object-src 'none'")
    expect(directive('base-uri')).toBe("base-uri 'self'")
    expect(directive('form-action')).toBe("form-action 'self'")
  })
  it('only allows scripts from this site and the one Firebase helper host, never inline or eval', () => {
    expect(directive('script-src')).toBe("script-src 'self' https://apis.google.com")
    expect(csp).not.toMatch(/script-src[^;]*'unsafe/)
  })
  it('allows exactly the network services the app talks to', () => {
    const connect = directive('connect-src')!
    for (const host of ['https://*.googleapis.com', 'https://musicbrainz.org', 'https://nominatim.openstreetmap.org', 'https://api.discogs.com']) expect(connect).toContain(host)
    expect(connect).not.toContain('*.*')
  })
})
