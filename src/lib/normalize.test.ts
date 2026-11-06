import { describe, expect, it } from 'vitest'
import { classifyDuplicates, makeNormalizedKey, makeSortTitle, normalizeText, thumbUrl } from './normalize'

describe('normalize', () => {
  it('strips accents, punctuation and articles', () => {
    expect(normalizeText('Björk – Homogenic!')).toBe('bjork homogenic')
    expect(makeSortTitle('The Dark Side of the Moon')).toBe('dark side of the moon')
    expect(makeNormalizedKey('The Beatles', 'Abbey Road')).toBe('beatles|abbey road')
  })
  it('matches provider IDs first, then title/artist as a suggestion', () => {
    const existing = [
      { id: 'a', title: 'Kind of Blue', primaryArtist: 'Miles Davis', musicBrainzReleaseGroupId: 'g1' },
      { id: 'b', title: 'kind of blue', primaryArtist: 'miles davis' },
      { id: 'c', title: 'Sketches of Spain', primaryArtist: 'Miles Davis' },
    ]
    const r = classifyDuplicates(existing, { title: 'Kind of Blue', primaryArtist: 'Miles Davis', musicBrainzReleaseGroupId: 'g1' })
    expect(r.map((x) => [x.album.id, x.match])).toEqual([['a', 'provider-id'], ['b', 'title-artist']])
  })
  it('returns nothing for unrelated albums', () => {
    expect(classifyDuplicates([{ id: 'c', title: 'X', primaryArtist: 'Y' }], { title: 'A', primaryArtist: 'B' })).toEqual([])
  })
  it('swaps Cover Art Archive thumbnail sizes only', () => {
    expect(thumbUrl('https://coverartarchive.org/release/1/front-500', 250)).toBe('https://coverartarchive.org/release/1/front-250')
    expect(thumbUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg')
    expect(thumbUrl(undefined)).toBeUndefined()
  })
})

describe('cross-provider duplicates', () => {
  it('matches the same Discogs master, even if the title differs', () => {
    const r = classifyDuplicates([{ id: 'a', title: 'Kind Of Blue (Mono)', primaryArtist: 'Miles Davis', discogsMasterId: '5460' }], { title: 'Kind of Blue', primaryArtist: 'Miles Davis', discogsMasterId: '5460' })
    expect(r.map((x) => x.match)).toEqual(['provider-id'])
  })
  it('only suggests a title/artist match between a MusicBrainz album and a Discogs one', () => {
    const r = classifyDuplicates([{ id: 'a', title: 'Kind of Blue', primaryArtist: 'Miles Davis', musicBrainzReleaseGroupId: 'g1' }], { title: 'Kind of Blue', primaryArtist: 'Miles Davis', discogsMasterId: '5460' })
    expect(r.map((x) => x.match)).toEqual(['title-artist'])
  })
})
