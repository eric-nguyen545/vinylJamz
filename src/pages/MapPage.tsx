import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { getDocs } from 'firebase/firestore'
import { MapPin, Plus } from 'lucide-react'
import { useAuth } from '../app/AuthContext'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Field, inputClass } from '../components/Field'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { getFirebase } from '../firebase/config'
import { userCol } from '../firebase/paths'
import { snapToCopy, type StoredAlbum, type StoredCopy } from '../lib/albumsRepo'
import { COORD_HINT, emptyLocationForm, formToLocation, locationToForm, type LocationFormState } from '../lib/locationForm'
import { createLocation, deleteLocation, listLocations, updateLocation, type StoredLocation } from '../lib/locationsRepo'
import { nominatim, type GeocodeResult } from '../lib/providers/nominatim'
import { listOwnedAlbums } from '../lib/publicRepo'
import { locationStats, type LocationStat } from '../lib/stats'
import type { FormErrors } from '../lib/formState'
import type { PurchaseLocationInput } from '../lib/schemas'

const pin = (verified: boolean) => L.divIcon({ className: '', html: `<span class="loc-pin${verified ? '' : ' unverified'}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -10] })
const money = (n: number, c: string) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n) } catch { return `${n} ${c}` } }
const spendText = (s: LocationStat) => Object.entries(s.spend).map(([c, n]) => money(n, c)).join(' + ')
const hasPos = (l: StoredLocation): l is StoredLocation & { latitude: number; longitude: number } => l.latitude !== undefined && l.longitude !== undefined
const toInput = (l: StoredLocation): PurchaseLocationInput => ({ name: l.name, address: l.address, latitude: l.latitude, longitude: l.longitude, coordinatesVerified: l.coordinatesVerified, source: l.source, notes: l.notes })

function FitBounds({ points, paused }: { points: [number, number][]; paused: boolean }) {
  const map = useMap()
  const key = JSON.stringify(points)
  useEffect(() => {
    if (paused || points.length === 0) return
    if (points.length === 1) map.setView(points[0]!, 13)
    else map.fitBounds(points, { padding: [40, 40], maxZoom: 14 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, paused])
  return null
}

function ClickToPlace({ active, onPlace }: { active: boolean; onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { if (active) onPlace(Math.round(e.latlng.lat * 1e5) / 1e5, Math.round(e.latlng.lng * 1e5) / 1e5) } })
  return null
}

export function MapPage() {
  const { state } = useAuth()
  if (state.status !== 'owner') return null
  return <MapBody uid={state.user.uid} />
}

type FormMode = { kind: 'add' } | { kind: 'edit'; id: string } | null

function MapBody({ uid }: { uid: string }) {
  const { db } = getFirebase()
  const [locations, setLocations] = useState<StoredLocation[] | null>(null)
  const [copies, setCopies] = useState<StoredCopy[]>([])
  const [albums, setAlbums] = useState<StoredAlbum[]>([])
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [mode, setMode] = useState<FormMode>(null)
  const [form, setForm] = useState<LocationFormState>(emptyLocationForm())
  const [errors, setErrors] = useState<FormErrors>({})
  const [busy, setBusy] = useState(false)
  const [placing, setPlacing] = useState<StoredLocation | null>(null)
  const [geo, setGeo] = useState<GeocodeResult[] | null>(null)
  const [geoBusy, setGeoBusy] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<StoredLocation | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [locs, copySnap, owned] = await Promise.all([listLocations(db, uid), getDocs(userCol(db, uid, 'copies')), listOwnedAlbums(db, uid)])
      setLocations(locs); setAlbums(owned)
      setCopies(copySnap.docs.map(snapToCopy).filter((c): c is StoredCopy => c !== null))
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load your locations.') }
  }, [db, uid])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const stats = useMemo(() => locationStats(locations ?? [], copies), [locations, copies])
  const albumsById = useMemo(() => new Map(albums.map((a) => [a.id, a])), [albums])
  const located = useMemo(() => (locations ?? []).filter(hasPos), [locations])
  const points = useMemo<[number, number][]>(() => located.map((l) => [l.latitude, l.longitude]), [located])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setActionError(null)
    try { await fn() } catch (e) { setActionError(e instanceof Error ? e.message : 'That action failed.') } finally { setBusy(false) }
  }

  function openForm(m: FormMode, l?: StoredLocation) {
    setMode(m); setForm(l ? locationToForm(l) : emptyLocationForm()); setErrors({}); setGeo(null); setGeoError(null)
  }

  const save = () => {
    const r = formToLocation(form)
    setErrors(r.ok ? {} : r.errors)
    if (!r.ok || !mode) return Promise.resolve()
    return run(async () => {
      if (mode.kind === 'add') await createLocation(db, uid, r.value)
      else await updateLocation(db, uid, mode.id, r.value)
      setMode(null); await load()
    })
  }

  async function findAddress() {
    setGeoBusy(true); setGeoError(null); setGeo(null)
    try { setGeo(await nominatim.search(form.address || form.name)) } catch (e) { setGeoError(e instanceof Error ? e.message : 'Lookup failed.') } finally { setGeoBusy(false) }
  }

  const place = (lat: number, lng: number) => {
    const target = placing
    if (!target) return
    setPlacing(null)
    void run(async () => { await updateLocation(db, uid, target.id, { ...toInput(target), latitude: lat, longitude: lng, coordinatesVerified: true, source: 'manual' }); await load() })
  }

  const confirmPosition = (l: StoredLocation) => run(async () => { await updateLocation(db, uid, l.id, { ...toInput(l), coordinatesVerified: true }); await load() })

  const add = <button onClick={() => openForm({ kind: 'add' })} className="inline-flex items-center gap-2 rounded-lg bg-label px-4 py-2 font-semibold text-label-ink"><Plus aria-hidden className="size-4" /> Add location</button>

  return (
    <>
      <PageHeader title="Map Explorer" description="Where you buy your records. Nothing is located automatically; you place each pin or confirm a lookup." actions={add} />
      {actionError && <div className="mb-4"><ErrorState message={actionError} /></div>}
      {error && <ErrorState title="Couldn’t load locations" message={error} onRetry={() => void load()} />}
      {!error && !locations && <LoadingState label="Loading your locations" />}

      {placing && (
        <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-label/50 bg-label/10 p-3 text-sm">
          <span>Click the map to place <strong>{placing.name}</strong>. Prefer typing coordinates? Use Edit instead.</span>
          <button onClick={() => setPlacing(null)} className="rounded-md bg-sleeve-hi px-3 py-1 font-medium hover:bg-groove">Cancel</button>
        </div>
      )}

      {locations && (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div role="region" aria-label="Map of purchase locations. The list beside it has the same places and works with a keyboard." className={`h-[55vh] min-h-80 overflow-hidden rounded-2xl ring-1 ring-groove ${placing ? 'cursor-crosshair' : ''}`}>
              <MapContainer center={[20, 0]} zoom={2} className="size-full" scrollWheelZoom worldCopyJump>
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
                <FitBounds points={points} paused={placing !== null} />
                <ClickToPlace active={placing !== null} onPlace={place} />
                {located.map((l) => {
                  const s = stats.get(l.id)
                  return (
                    <Marker key={l.id} position={[l.latitude, l.longitude]} icon={pin(l.coordinatesVerified)} title={l.name}>
                      <Popup>
                        <p className="font-semibold">{l.name}</p>
                        {l.address && <p className="text-sm opacity-80">{l.address}</p>}
                        {!l.coordinatesVerified && <p className="text-sm">Position not confirmed yet.</p>}
                        <p className="mt-1 text-sm">{s?.copyCount ?? 0} {s?.copyCount === 1 ? 'copy' : 'copies'}{s && spendText(s) ? `, ${spendText(s)}` : ''}</p>
                        <ul className="mt-1 text-sm">
                          {(s?.albumIds ?? []).slice(0, 5).map((id) => <li key={id}><Link to={`/collection/${id}`}>{albumsById.get(id)?.title ?? 'Album'}</Link></li>)}
                          {(s?.albumIds.length ?? 0) > 5 && <li>and {(s?.albumIds.length ?? 0) - 5} more</li>}
                        </ul>
                      </Popup>
                    </Marker>
                  )
                })}
              </MapContainer>
            </div>
            <p className="mt-2 text-xs text-dust">Map data © OpenStreetMap contributors. Solid pins are confirmed; dashed pins are unconfirmed lookups.</p>
          </div>

          <div className="lg:col-span-2">
            {mode && (
              <form onSubmit={(e) => { e.preventDefault(); void save() }} className="mb-6 flex flex-col gap-4 rounded-2xl border border-groove p-5">
                <h2 className="text-xl font-medium">{mode.kind === 'add' ? 'Add a location' : 'Edit location'}</h2>
                <Field label="Name" error={errors.name}><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
                <Field label="Address" error={errors.address}><input className={inputClass} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
                <div>
                  <button type="button" disabled={geoBusy || !(form.address.trim() || form.name.trim())} onClick={() => void findAddress()} className="rounded-lg bg-sleeve-hi px-3 py-1.5 text-sm font-medium hover:bg-groove disabled:opacity-50">
                    {geoBusy ? 'Looking up…' : 'Look up address'}
                  </button>
                  <p className="mt-1 text-xs text-dust">Sends the address text to OpenStreetMap Nominatim only when you press this.</p>
                  {geoError && <p role="alert" className="mt-1 text-sm text-bad">{geoError}</p>}
                  {geo && (geo.length === 0
                    ? <p className="mt-2 text-sm text-dust">No matches. Try a fuller address, or enter coordinates yourself.</p>
                    : <ul className="mt-2 flex flex-col gap-1">{geo.map((g) => (
                        <li key={g.id}><button type="button" onClick={() => { setForm({ ...form, latitude: String(g.latitude), longitude: String(g.longitude), source: 'geocoder', coordinatesVerified: false }); setGeo(null) }} className="w-full rounded-md bg-sleeve p-2 text-left text-sm hover:bg-sleeve-hi">{g.label}</button></li>
                      ))}</ul>)}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Latitude" hint={COORD_HINT.latitude} error={errors.latitude}><input className={inputClass} inputMode="text" autoComplete="off" placeholder="45.10236" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value, source: 'manual', coordinatesVerified: true })} /></Field>
                  <Field label="Longitude" hint={COORD_HINT.longitude} error={errors.longitude}><input className={inputClass} inputMode="text" autoComplete="off" placeholder="-93.45417" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value, source: 'manual', coordinatesVerified: true })} /></Field>
                </div>
                {form.latitude && form.longitude && form.source === 'geocoder' && !form.coordinatesVerified && (
                  <p className="text-sm">Position came from a lookup and isn’t confirmed. <button type="button" onClick={() => setForm({ ...form, coordinatesVerified: true })} className="underline underline-offset-4">Looks right, confirm it</button></p>
                )}
                <Field label="Notes" error={errors.notes}><textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
                <div className="flex gap-3">
                  <button type="submit" disabled={busy} className="rounded-lg bg-label px-4 py-2 font-semibold text-label-ink disabled:opacity-50">{busy ? 'Saving…' : 'Save location'}</button>
                  <button type="button" onClick={() => setMode(null)} className="rounded-lg bg-sleeve-hi px-4 py-2 font-medium hover:bg-groove">Cancel</button>
                </div>
              </form>
            )}

            {locations.length === 0 && !mode
              ? <EmptyState title="No locations yet" action={add}>Add record stores, markets or sellers, then choose them when you record a purchase.</EmptyState>
              : (
                <ul className="flex flex-col gap-3">
                  {locations.map((l) => {
                    const s = stats.get(l.id)
                    return (
                      <li key={l.id} className="rounded-2xl bg-sleeve p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate font-medium">{l.name}</h3>
                            {l.address && <p className="truncate text-sm text-dust">{l.address}</p>}
                            <p className="mt-1 text-sm">{s?.copyCount ?? 0} {s?.copyCount === 1 ? 'copy' : 'copies'}{s && spendText(s) ? `, ${spendText(s)}` : ''}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${!hasPos(l) ? 'bg-groove text-dust' : l.coordinatesVerified ? 'bg-sleeve-hi' : 'border border-dashed border-label'}`}>
                            {!hasPos(l) ? 'No position' : l.coordinatesVerified ? 'On map' : 'Unconfirmed'}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-sm">
                          <button onClick={() => { setPlacing(l); setMode(null) }} className="inline-flex items-center gap-1 rounded-lg bg-sleeve-hi px-3 py-1.5 font-medium hover:bg-groove"><MapPin aria-hidden className="size-3.5" />{hasPos(l) ? 'Move on map' : 'Place on map'}</button>
                          {hasPos(l) && !l.coordinatesVerified && <button disabled={busy} onClick={() => void confirmPosition(l)} className="rounded-lg bg-label px-3 py-1.5 font-semibold text-label-ink">Confirm position</button>}
                          <button onClick={() => openForm({ kind: 'edit', id: l.id }, l)} className="rounded-lg bg-sleeve-hi px-3 py-1.5 font-medium hover:bg-groove">Edit</button>
                          <button onClick={() => setConfirmDelete(l)} className="rounded-lg px-3 py-1.5 font-medium text-bad hover:bg-sleeve-hi">Delete</button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmDelete !== null} title="Delete this location?" confirmLabel="Delete location" destructive busy={busy}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => void run(async () => { if (confirmDelete) await deleteLocation(db, uid, confirmDelete.id); setConfirmDelete(null); await load() })}>
        {(() => { const n = confirmDelete ? (stats.get(confirmDelete.id)?.copyCount ?? 0) : 0; return n > 0 ? `${n} ${n === 1 ? 'copy is' : 'copies are'} linked to “${confirmDelete?.name}”. They stay in your collection but lose this location.` : `“${confirmDelete?.name}” isn’t linked to any copies.` })()}
      </ConfirmDialog>
    </>
  )
}
