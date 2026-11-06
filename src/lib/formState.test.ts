import { describe, expect, it } from 'vitest'
import { copyToForm, emptyAlbumBase, emptyAlbumForm, formToAlbum, formToCopy } from './formState'

describe('album form', () => {
  it('requires a title and an artist', () => {
    const r = formToAlbum(emptyAlbumForm(), emptyAlbumBase())
    expect(r.ok).toBe(false)
    if (!r.ok) { expect(r.errors.title).toBeTruthy(); expect(r.errors.artists).toBeTruthy() }
  })
  it('builds a valid manual album with sort title and duplicate key', () => {
    const r = formToAlbum({ ...emptyAlbumForm(), title: 'The Wall', artists: 'Pink Floyd, Roger Waters', year: '1979', genres: 'Rock, Prog' }, emptyAlbumBase())
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.primaryArtist).toBe('Pink Floyd')
      expect(r.value.sortTitle).toBe('wall')
      expect(r.value.normalizedKey).toBe('pink floyd|wall')
      expect(r.value.genres).toEqual(['Rock', 'Prog'])
      expect(r.value.releaseYear).toBe(1979)
    }
  })
  it('rejects a non-numeric year', () => {
    expect(formToAlbum({ ...emptyAlbumForm(), title: 'T', artists: 'A', year: 'abc' }, emptyAlbumBase()).ok).toBe(false)
  })
})

describe('copy form', () => {
  it('accepts a blank pressing and drops empty fields', () => {
    const r = formToCopy(copyToForm({}))
    expect(r.ok).toBe(true)
    if (r.ok) { expect(r.value.purchasePrice).toBeUndefined(); expect(r.value.currency).toBeUndefined(); expect(r.value.format).toBe('LP') }
  })
  it('keeps currency only when a price is entered', () => {
    const r = formToCopy({ ...copyToForm({}, 'EUR'), purchasePrice: '24.5', purchaseDate: '2025-03-04' })
    expect(r.ok).toBe(true)
    if (r.ok) { expect(r.value.purchasePrice).toBe(24.5); expect(r.value.currency).toBe('EUR') }
  })
  it('rejects negative prices and malformed dates', () => {
    const r = formToCopy({ ...copyToForm({}), purchasePrice: '-5', purchaseDate: '03/04/2025' })
    expect(r.ok).toBe(false)
    if (!r.ok) { expect(r.errors.purchasePrice).toBeTruthy(); expect(r.errors.purchaseDate).toBeTruthy() }
  })
})
