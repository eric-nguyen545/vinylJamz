import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { ErrorState, LoadingState } from '../../components/States'
import { publicPlaceSchema } from '../../lib/schemas'
import { usePublicList } from '../../lib/usePublicData'
import { SectionOff, usePublicContext } from './PublicLayout'

const pin = L.divIcon({ className: '', html: '<span class="loc-pin"></span>', iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -10] })

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap()
  const key = JSON.stringify(points)
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) map.setView(points[0]!, 13)
    else map.fitBounds(points, { padding: [40, 40], maxZoom: 14 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])
  return null
}

export function PublicMapPage() {
  const { shareId, site } = usePublicContext()
  const { items, error } = usePublicList(shareId, 'places', publicPlaceSchema)
  const points = useMemo<[number, number][]>(() => (items ?? []).map((p) => [p.latitude, p.longitude]), [items])
  if (!site.sections.places) return <SectionOff />
  if (error) return <ErrorState title="Couldn’t load the map" message={error} />
  if (!items) return <LoadingState label="Loading map" />
  if (items.length === 0) return <p className="text-dust">No places are shared right now.</p>
  return (
    <>
      <div role="region" aria-label="Map of places records were bought. A list of the same places follows." className="h-[55vh] min-h-80 overflow-hidden rounded-2xl ring-1 ring-groove">
        <MapContainer center={[20, 0]} zoom={2} className="size-full" scrollWheelZoom worldCopyJump>
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
          <Fit points={points} />
          {items.map((p) => <Marker key={p.id} position={[p.latitude, p.longitude]} icon={pin} title={p.name}><Popup>{p.name}</Popup></Marker>)}
        </MapContainer>
      </div>
      <ul className="mt-4 columns-1 gap-6 text-sm sm:columns-2">{[...items].sort((a, b) => a.name.localeCompare(b.name)).map((p) => <li key={p.id}>{p.name}</li>)}</ul>
      <p className="mt-2 text-xs text-dust">Map data © OpenStreetMap contributors.</p>
    </>
  )
}
