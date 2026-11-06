import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { getFirebase } from '../firebase/config'
import type { StoredAlbum } from '../lib/albumsRepo'
import { todayLocal } from '../lib/format'
import { createObservation, setDiscogsRelease } from '../lib/pricingRepo'
import { createDiscogsClient, discogsReleaseUrl, type DiscogsAuth, type DiscogsCandidate, type PriceLookup } from '../lib/providers/discogs'
import type { SearchMode } from '../lib/providers/types'
import { Field, inputClass } from './Field'
import { ErrorState } from './States'

interface Props { uid: string; album: StoredAlbum; auth?: DiscogsAuth; currency: string; onChanged: () => Promise<void> | void }

const fmt = (n: number, c: string) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n) } catch { return `${n} ${c}` } }

/** Optional, owner-triggered Discogs lookups. Nothing is requested or saved without a button press. */
export function DiscogsPanel({ uid, album, auth, currency, onChanged }: Props) {
  const client = useMemo(() => (auth ? createDiscogsClient({ auth }) : null), [auth])
  const [mode, setMode] = useState<SearchMode>('text')
  const [q, setQ] = useState(`${album.primaryArtist} ${album.title}`)
  const [results, setResults] = useState<DiscogsCandidate[] | null>(null)
  const [lookup, setLookup] = useState<PriceLookup | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const { db } = getFirebase()

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null); setSaved(false)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : 'That request failed.') } finally { setBusy(false) }
  }

  if (!client) {
    return <p className="rounded-xl bg-sleeve p-4 text-sm text-dust">Want live asking prices? Add your Discogs credentials in <Link to="/settings" className="text-label underline underline-offset-4">Settings</Link>. Manual prices work without it.</p>
  }

  const linked = album.discogsReleaseId

  return (
    <div className="rounded-xl bg-sleeve p-4">
      <h3 className="text-lg font-medium">Discogs</h3>
      {error && <div className="mt-2"><ErrorState message={error} /></div>}

      {linked ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <span>Linked to release {linked}</span>
          <a href={discogsReleaseUrl(linked)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-label underline underline-offset-4">View <ExternalLink aria-hidden className="size-3" /></a>
          <button disabled={busy} onClick={() => void run(async () => { await setDiscogsRelease(db, uid, album.id, undefined); setLookup(null); await onChanged() })} className="text-dust underline underline-offset-4 hover:text-paper">Unlink</button>
        </div>
      ) : (
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); void run(async () => setResults(await client.searchReleases(q, mode))) }} className="mt-2 flex flex-wrap items-end gap-3">
          <Field label="Find by"><select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value as SearchMode)}><option value="text">Artist and title</option><option value="barcode">Barcode</option><option value="catalog">Catalog number</option></select></Field>
          <Field label="Search" className="min-w-56 flex-1"><input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} /></Field>
          <button type="submit" disabled={busy} className="rounded-lg bg-sleeve-hi px-4 py-2.5 font-medium hover:bg-groove disabled:opacity-50">{busy ? 'Searching…' : 'Search Discogs'}</button>
        </form>
      )}

      {!linked && results && (results.length === 0
        ? <p className="mt-3 text-sm text-dust">No matches.</p>
        : <ul className="mt-3 flex flex-col gap-2">{results.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ink p-3 text-sm">
              <span><span className="font-medium">{r.title}</span><span className="block text-dust">{[r.format, r.country, r.year, r.label, r.catalogNumber].filter(Boolean).join(', ')}</span></span>
              <button disabled={busy} onClick={() => void run(async () => { await setDiscogsRelease(db, uid, album.id, r.id); setResults(null); await onChanged() })} className="rounded-md bg-label px-3 py-1.5 font-semibold text-label-ink">Link this release</button>
            </li>
          ))}</ul>)}

      {linked && (
        <div className="mt-4">
          <button disabled={busy} onClick={() => void run(async () => setLookup(await client.lowestListing(linked, currency)))} className="rounded-lg bg-sleeve-hi px-4 py-2 font-medium hover:bg-groove disabled:opacity-50">{busy ? 'Checking…' : `Check lowest asking price (${currency})`}</button>
          {lookup && (
            <div className="mt-3 rounded-lg bg-ink p-3 text-sm">
              {lookup.lowestPrice === undefined
                ? <p>Nothing is listed for sale on Discogs right now.</p>
                : <>
                    <p><span className="font-semibold">{fmt(lookup.lowestPrice, lookup.currency)}</span> lowest asking price{lookup.numForSale !== undefined ? `, ${lookup.numForSale} for sale` : ''}.</p>
                    <p className="mt-1 text-dust">This is what sellers ask for this release, not what copies sell for. It isn’t saved until you save it.</p>
                    <button disabled={busy} onClick={() => void run(async () => {
                      await createObservation(db, uid, { albumId: album.id, releaseId: lookup.releaseId, provider: 'discogs', observationType: 'listing', price: lookup.lowestPrice!, currency: lookup.currency, observedAt: todayLocal(), sourceUrl: lookup.sourceUrl, dataQuality: 'exact-match' })
                      setLookup(null); setSaved(true); await onChanged()
                    })} className="mt-2 rounded-md bg-label px-3 py-1.5 font-semibold text-label-ink">Save as asking-price observation</button>
                  </>}
            </div>
          )}
          {saved && <p role="status" className="mt-2 text-sm text-ok">Saved.</p>}
        </div>
      )}
    </div>
  )
}
