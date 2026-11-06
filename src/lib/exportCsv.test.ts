import { describe, expect, it } from 'vitest'
import { albumsCsv, buildCsvSource, copiesCsv, gearCsv } from './exportCsv'

const docs = {
  albums: [{ id: 'a1', data: { title: '=Evil', sortTitle: 'evil', artistNames: ['A', 'B'], primaryArtist: 'A', releaseYear: 1990, genres: ['Rock'], copyCount: 1, owned: true } }, { id: 'bad', data: { nope: true } }],
  copies: [{ id: 'c1', data: { albumId: 'a1', format: 'LP', purchasePrice: 20, currency: 'USD', purchaseLocationId: 'l1', privateNotes: 'x, y' } }],
  reviews: [{ id: 'a1', data: { rating: 8.5, isFavorite: true, vibes: ['late night'] } }],
  wantlist: [], listeningSessions: [], priceObservations: [], gear: [{ id: 'g1', data: { name: '=Turntable', category: 'turntable', purchasePrice: 300, currency: 'USD' } }],
  purchaseLocations: [{ id: 'l1', data: { name: 'Record Shop' } }],
}

describe('csv export', () => {
  const src = buildCsvSource(docs)
  it('leaves unreadable records out of CSVs', () => { expect(src.albums.map((a) => a.id)).toEqual(['a1']) })
  it('joins review data and protects formulas in albums.csv', () => {
    const lines = albumsCsv(src).trimEnd().split('\r\n')
    expect(lines[0]).toContain('rating_out_of_10')
    expect(lines[1]).toContain(`'=Evil`)
    expect(lines[1]).toContain('A; B')
    expect(lines[1]).toContain('8.5')
    expect(lines[1]).toContain('late night')
  })
  it('exports gear with formula protection', () => {
    const lines = gearCsv(src).trimEnd().split('\r\n')
    expect(lines[0]).toBe('name,category,brand,model,condition,purchase_date,price,currency,seller,notes')
    expect(lines[1]).toContain("'=Turntable")
    expect(lines[1]).toContain('turntable')
  })
  it('resolves album and location names in copies.csv', () => {
    const row = copiesCsv(src).trimEnd().split('\r\n')[1]!
    expect(row).toContain('Record Shop')
    expect(row).toContain("'=Evil")
    expect(row).toContain('"x, y"')
  })
})
