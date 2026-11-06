import { describe, expect, it } from 'vitest'
import { COORD_HINT, emptyLocationForm, formToLocation, locationToForm, parseCoordinate } from './locationForm'

describe('location form', () => {
  it('requires a name', () => {
    const r = formToLocation(emptyLocationForm())
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.name).toBeTruthy()
  })
  it('allows an unlocated place and never marks it verified', () => {
    const r = formToLocation({ ...emptyLocationForm(), name: 'Flea market', coordinatesVerified: true, source: 'geocoder' })
    expect(r.ok && r.value).toMatchObject({ name: 'Flea market', coordinatesVerified: false, source: 'manual' })
    expect(r.ok && r.value.latitude).toBeUndefined()
  })
  it('requires latitude and longitude together and in range', () => {
    expect(formToLocation({ ...emptyLocationForm(), name: 'X', latitude: '10' }).ok).toBe(false)
    expect(formToLocation({ ...emptyLocationForm(), name: 'X', latitude: '95', longitude: '0' }).ok).toBe(false)
    expect(formToLocation({ ...emptyLocationForm(), name: 'X', latitude: 'abc', longitude: '0' }).ok).toBe(false)
    expect(formToLocation({ ...emptyLocationForm(), name: 'X', latitude: '10', longitude: '200' }).ok).toBe(false)
  })
  it('keeps geocoder results unverified until confirmed', () => {
    const r = formToLocation({ ...emptyLocationForm(), name: 'Shop', latitude: '51.5', longitude: '-0.12', source: 'geocoder', coordinatesVerified: false })
    expect(r.ok && r.value).toMatchObject({ source: 'geocoder', coordinatesVerified: false })
    const c = formToLocation({ ...emptyLocationForm(), name: 'Shop', latitude: '51.5', longitude: '-0.12', source: 'geocoder', coordinatesVerified: true })
    expect(c.ok && c.value.coordinatesVerified).toBe(true)
  })
  it('round-trips stored values', () => {
    expect(locationToForm({ name: 'A', latitude: 1.5, longitude: 2.5, coordinatesVerified: true, source: 'manual' })).toMatchObject({ name: 'A', latitude: '1.5', longitude: '2.5', coordinatesVerified: true })
  })
})

describe('parseCoordinate', () => {
  const ok = (raw: string, axis: 'latitude' | 'longitude') => { const r = parseCoordinate(raw, axis); return r.ok ? r.value : r.error }
  it('accepts decimal degrees', () => {
    expect(ok('45.10236', 'latitude')).toBe(45.10236)
    expect(ok('-93.45417', 'longitude')).toBe(-93.45417)
    expect(ok(' +12 ', 'latitude')).toBe(12)
  })
  it('accepts degrees-minutes-seconds, including the exact values from the bug report', () => {
    expect(ok('45°06\'08.5"N', 'latitude')).toBe(45.102361)
    expect(ok('93°27\'15.0"W', 'longitude')).toBe(-93.454167)
  })
  it('accepts hemisphere letters in other positions and spacing, and typographic marks', () => {
    expect(ok('45 6 8.5 N', 'latitude')).toBe(45.102361)
    expect(ok('S 33.8688', 'latitude')).toBe(-33.8688)
    expect(ok('151.2093 e', 'longitude')).toBe(151.2093)
    expect(ok('93°27′15.0″W', 'longitude')).toBe(-93.454167)
    expect(ok('45°30\'N', 'latitude')).toBe(45.5)
  })
  it('rejects the wrong hemisphere for the axis, conflicting signs, bad minutes and out-of-range values', () => {
    expect(ok('45E', 'latitude')).toMatch(/N or S/)
    expect(ok('93W', 'latitude')).toMatch(/N or S/)
    expect(ok('-45N', 'latitude')).toMatch(/minus sign or N/)
    expect(ok('45°75\'00"N', 'latitude')).toMatch(/less than 60/)
    expect(ok('95', 'latitude')).toMatch(/between -90 and 90/)
    expect(ok('181', 'longitude')).toMatch(/between -180 and 180/)
    expect(ok('abc', 'latitude')).toMatch(/must be a number/)
    expect(ok('1 2 3 4', 'latitude')).toMatch(/must be a number/)
  })
  it('stays out of the way of the form: DMS saves as decimal', () => {
    const r = formToLocation({ ...emptyLocationForm(), name: 'Shop', latitude: '45°06\'08.5"N', longitude: '93°27\'15.0"W' })
    expect(r.ok && [r.value.latitude, r.value.longitude]).toEqual([45.102361, -93.454167])
  })
  it('documents the expected shape in the captions', () => {
    expect(COORD_HINT.latitude).toMatch(/45\.10236/)
    expect(COORD_HINT.longitude).toMatch(/-93\.45417/)
  })
})
