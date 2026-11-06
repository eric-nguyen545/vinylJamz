import { describe, expect, it } from 'vitest'
import { chunk, planSync, sectionLive } from './publicRepo'
import { buildShareUrl } from './shareUrl'
import { defaultPublicFieldOptions, publicAlbumSchema, sharingSettingsSchema } from './schemas'

describe('planSync', () => {
  it('writes selected albums and removes everything else published', () => {
    expect(planSync(['a', 'b'], ['b', 'c'], ['a', 'b', 'c'])).toEqual({ toSet: ['a', 'b'], toDelete: ['c'] })
  })
  it('ignores selected IDs that no longer exist and de-duplicates', () => {
    expect(planSync(['a', 'a', 'ghost'], [], ['a'])).toEqual({ toSet: ['a'], toDelete: [] })
  })
  it('removes everything when nothing is selected', () => {
    expect(planSync([], ['x', 'y'], ['x', 'y'])).toEqual({ toSet: [], toDelete: ['x', 'y'] })
  })
})

describe('chunk', () => {
  it('splits into batches under the limit', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([], 3)).toEqual([])
  })
})

describe('buildShareUrl', () => {
  const id = 'a'.repeat(32)
  it('uses the hash route on the current origin and base path', () => {
    expect(buildShareUrl(id, { origin: 'https://me.github.io', basePath: '/vinyl-archive/' })).toBe(`https://me.github.io/vinyl-archive/#/public/${id}`)
  })
  it('prefers a configured public URL and adds a trailing slash', () => {
    expect(buildShareUrl(id, { publicAppUrl: 'https://vinyl.example.com', origin: 'http://x', basePath: '/' })).toBe(`https://vinyl.example.com/#/public/${id}`)
  })
})

describe('sharing schemas', () => {
  it('requires an unguessable 32-char hex share ID and defaults to off with safe fields', () => {
    expect(sharingSettingsSchema.safeParse({ shareId: 'short' }).success).toBe(false)
    const s = sharingSettingsSchema.parse({ shareId: 'b'.repeat(32) })
    expect(s.mode).toBe('off')
    expect(s.fieldOptions).toEqual(defaultPublicFieldOptions)
    expect(s.fieldOptions.rating || s.fieldOptions.review || s.fieldOptions.pressingSummary).toBe(false)
  })
  it('parses public album docs and rejects ratings outside 0-10', () => {
    expect(publicAlbumSchema.safeParse({ title: 'T', artistNames: ['A'] }).success).toBe(true)
    expect(publicAlbumSchema.safeParse({ title: 'T', rating: 11 }).success).toBe(false)
  })
})

describe('visibility modes', () => {
  it('migrates settings saved before modes existed', () => {
    const off = sharingSettingsSchema.parse({ shareId: 'c'.repeat(32), enabled: false })
    const on = sharingSettingsSchema.parse({ shareId: 'c'.repeat(32), enabled: true, displayName: 'Mine' })
    expect(off.mode).toBe('off')
    expect(on.mode).toBe('unlisted')
    expect(on.sections).toEqual({ collection: true, wantlist: false, journal: false, gear: false, places: false, stats: false })
  })
  it('keeps new sensitive options off for settings saved before they existed', () => {
    const s = sharingSettingsSchema.parse({ shareId: 'c'.repeat(32), fieldOptions: { artwork: true, tracklist: true, rating: true, review: false, vibes: false, topTracks: false, pressingSummary: false } })
    expect(s.fieldOptions).toMatchObject({ rating: true, money: false, journalNotes: false, discogsStats: false })
  })
  it('rejects an unknown mode', () => { expect(sharingSettingsSchema.safeParse({ shareId: 'c'.repeat(32), mode: 'everyone' }).success).toBe(false) })
  it('only treats a section as live when the site is not private and the switch is on', () => {
    const sections = { collection: true, wantlist: false, journal: false, gear: true, places: false, stats: false }
    expect(sectionLive({ mode: 'public', sections }, 'gear')).toBe(true)
    expect(sectionLive({ mode: 'unlisted', sections }, 'wantlist')).toBe(false)
    expect(sectionLive({ mode: 'off', sections }, 'collection')).toBe(false)
  })
})
