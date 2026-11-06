import { describe, expect, it } from 'vitest'
import { emptySessionForm, formToSession, sessionToForm } from './sessionForm'

const album = { id: 'a1', title: 'Kind of Blue', primaryArtist: 'Miles Davis', artworkUrl: 'https://example.com/a.jpg' }
const today = '2026-03-10'

describe('session form', () => {
  it('requires an album', () => {
    const r = formToSession(emptySessionForm(today), null, today)
    expect(!r.ok && r.errors.album).toBeTruthy()
  })
  it('rejects future and malformed dates', () => {
    expect(formToSession({ ...emptySessionForm(today), date: '2026-03-11' }, album, today).ok).toBe(false)
    expect(formToSession({ ...emptySessionForm(today), date: '03/10/2026' }, album, today).ok).toBe(false)
    expect(formToSession({ ...emptySessionForm(today), date: '' }, album, today).ok).toBe(false)
  })
  it('builds a session with an album snapshot and drops blanks', () => {
    const r = formToSession({ ...emptySessionForm(today), mood: 'late night, anything goes', notes: '  ' }, album, today)
    expect(r.ok && r.value).toMatchObject({ albumId: 'a1', date: today, completedAlbum: true, albumTitle: 'Kind of Blue', primaryArtist: 'Miles Davis', vibeTags: ['late night, anything goes'] })
    expect(r.ok && r.value.notes).toBeUndefined()
    expect(r.ok && r.value.locationText).toBeUndefined()
  })
  it('round-trips stored sessions', () => {
    expect(sessionToForm({ date: '2026-02-01', completedAlbum: false, locationText: 'Car', vibeTags: ['driving', 'late night'], notes: 'n' })).toEqual({ date: '2026-02-01', completedAlbum: false, locationText: 'Car', mood: 'driving, late night', notes: 'n' })
  })
})
