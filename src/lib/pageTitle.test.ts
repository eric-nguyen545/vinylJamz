import { describe, expect, it } from 'vitest'
import { pageTitle } from './pageTitle'

describe('pageTitle', () => {
  it('names every top-level page', () => {
    expect(pageTitle('/')).toBe('Dashboard · Vinyl Archive')
    expect(pageTitle('/wantlist')).toBe('Wantlist · Vinyl Archive')
    expect(pageTitle('/statistics')).toBe('Statistics · Vinyl Archive')
    expect(pageTitle('/data')).toBe('Backup and Export · Vinyl Archive')
    expect(pageTitle('/gear')).toBe('Gear · Vinyl Archive')
    expect(pageTitle('/admin')).toBe('Admin · Vinyl Archive')
  })
  it('distinguishes the collection list, the add page and an album', () => {
    expect(pageTitle('/collection')).toBe('My Collection · Vinyl Archive')
    expect(pageTitle('/collection/add')).toBe('Add album · Vinyl Archive')
    expect(pageTitle('/collection/mbrg_abc')).toBe('Album · Vinyl Archive')
  })
  it('falls back to the app name', () => { expect(pageTitle('/nope')).toBe('Vinyl Archive') })
})
