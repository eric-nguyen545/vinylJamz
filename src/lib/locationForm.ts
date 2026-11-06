import { purchaseLocationInputSchema, type PurchaseLocationInput } from './schemas'
import type { FormErrors, Result } from './formState'

export interface LocationFormState {
  name: string; address: string; latitude: string; longitude: string; notes: string
  source: 'manual' | 'geocoder'; coordinatesVerified: boolean
}

export const emptyLocationForm = (): LocationFormState => ({ name: '', address: '', latitude: '', longitude: '', notes: '', source: 'manual', coordinatesVerified: false })

export const locationToForm = (l: Partial<PurchaseLocationInput>): LocationFormState => ({
  name: l.name ?? '', address: l.address ?? '', latitude: l.latitude === undefined ? '' : String(l.latitude),
  longitude: l.longitude === undefined ? '' : String(l.longitude), notes: l.notes ?? '',
  source: l.source ?? 'manual', coordinatesVerified: l.coordinatesVerified ?? false,
})

export function formToLocation(f: LocationFormState): Result<PurchaseLocationInput> {
  const errors: FormErrors = {}
  const hasLat = f.latitude.trim() !== '', hasLng = f.longitude.trim() !== ''
  if (hasLat !== hasLng) errors[hasLat ? 'longitude' : 'latitude'] = 'Enter both latitude and longitude, or neither.'
  let lat: number | undefined, lng: number | undefined
  if (hasLat) { const r = parseCoordinate(f.latitude, 'latitude'); if (r.ok) lat = r.value; else errors.latitude = r.error }
  if (hasLng) { const r = parseCoordinate(f.longitude, 'longitude'); if (r.ok) lng = r.value; else errors.longitude = r.error }
  if (Object.keys(errors).length) return { ok: false, errors }
  const located = lat !== undefined && lng !== undefined
  const parsed = purchaseLocationInputSchema.safeParse({
    name: f.name, address: f.address.trim() || undefined, latitude: lat, longitude: lng,
    // Unlocated places can't be "verified"; geocoder results stay unverified until the owner confirms.
    coordinatesVerified: located && f.coordinatesVerified, source: located ? f.source : 'manual',
    notes: f.notes.trim() || undefined,
  })
  if (parsed.success) return { ok: true, value: parsed.data }
  for (const i of parsed.error.issues) errors[String(i.path[0] ?? 'form')] ??= i.message
  return { ok: false, errors }
}

export const COORD_HINT = {
  latitude: 'Decimal degrees, like 45.10236 (use a minus sign for south). Degrees-minutes-seconds like 45°06\'08.5"N also works.',
  longitude: 'Decimal degrees, like -93.45417 (use a minus sign for west). Degrees-minutes-seconds like 93°27\'15.0"W also works.',
} as const

export type CoordResult = { ok: true; value: number } | { ok: false; error: string }

/**
 * Accepts decimal degrees (45.10236, -93.45), optionally with a hemisphere letter (45.10236 N),
 * or degrees-minutes-seconds (45°06'08.5"N, 45 6 8.5 N). Returns decimal degrees, 6 places.
 */
export function parseCoordinate(raw: string, axis: 'latitude' | 'longitude'): CoordResult {
  const limit = axis === 'latitude' ? 90 : 180
  const letters = axis === 'latitude' ? 'NS' : 'EW'
  const fail = (error: string): CoordResult => ({ ok: false, error })
  let s = raw.trim().replace(/[′’´‘]/g, "'").replace(/[″”“]|''/g, '"').replace(/[º˚]/g, '°')
  let hemi = ''
  // Only N/S/E/W count as hemisphere letters; any other letters fall through to the "must be a number" error.
  const lead = s.match(/^([NSEW])\s*(.*)$/is)
  const tail = lead ? null : s.match(/^(.*?)\s*([NSEW])$/is)
  if (lead) { hemi = lead[1]!.toUpperCase(); s = lead[2]!.trim() }
  else if (tail) { hemi = tail[2]!.toUpperCase(); s = tail[1]!.trim() }
  if (hemi && !letters.includes(hemi)) return fail(`${axis === 'latitude' ? 'Latitude' : 'Longitude'} uses ${letters[0]} or ${letters[1]}, not ${hemi}.`)
  if (!s || !/^[-+]?[\d\s.°'"-]+$/.test(s)) return fail(`${axis === 'latitude' ? 'Latitude' : 'Longitude'} must be a number like ${axis === 'latitude' ? '45.10236' : '-93.45417'}.`)
  const negative = s.trim().startsWith('-')
  if (negative && (hemi === 'N' || hemi === 'E')) return fail('Use either a minus sign or N/S/E/W, not both.')
  const nums = s.replace(/^[-+]/, '').match(/\d+(?:\.\d+)?/g)
  if (!nums || nums.length > 3) return fail(`${axis === 'latitude' ? 'Latitude' : 'Longitude'} must be a number like ${axis === 'latitude' ? '45.10236' : '-93.45417'}.`)
  const [deg, min, sec] = nums.map(Number) as [number, number | undefined, number | undefined]
  if ((min !== undefined && min >= 60) || (sec !== undefined && sec >= 60)) return fail('Minutes and seconds must be less than 60.')
  if (min !== undefined && !Number.isInteger(min) && sec !== undefined) return fail('Only the last part can have decimals.')
  let value = deg + (min ?? 0) / 60 + (sec ?? 0) / 3600
  if (negative || hemi === 'S' || hemi === 'W') value = -value
  value = Math.round(value * 1e6) / 1e6
  if (Math.abs(value) > limit) return fail(`${axis === 'latitude' ? 'Latitude' : 'Longitude'} must be between -${limit} and ${limit}.`)
  return { ok: true, value }
}
