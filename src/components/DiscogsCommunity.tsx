import { useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { getFirebase } from '../firebase/config'
import type { StoredAlbum } from '../lib/albumsRepo'
import { formatDay } from '../lib/format'
import { saveDiscogsStats } from '../lib/pricingRepo'
import { createDiscogsClient, discogsReleaseUrl, type DiscogsAuth } from '../lib/providers/discogs'
import { communityStats, parseRelease, type DiscogsRelease } from '../lib/providers/discogsCatalog'
import { ErrorState } from './States'

interface Props { uid: string; album: StoredAlbum; auth?: DiscogsAuth; onChanged: () => Promise<void> | void }

/** "People want it more than have it" is the rough rarity signal Discogs' numbers give. */
export function demandLabel(have?: number, want?: number): string | undefined {
  if (!have || want === undefined) return undefined
  const r = want / have
  return r >= 1 ? `${r.toFixed(1)} want it for every 1 who has it` : `${(1 / Math.max(r, 0.001)).toFixed(1)} have it for every 1 who wants it`
}

const n = (v?: number) => (v === undefined ? '—' : v.toLocaleString())

export function DiscogsCommunity({ uid, album, auth, onChanged }: Props) {
  const client = useMemo(() => (auth ? createDiscogsClient({ auth }) : null), [auth])
  const [detail, setDetail] = useState<DiscogsRelease | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = album.discogsReleaseId
  const stats = album.discogsStats
  if (!id && !stats) return null

  async function refresh() {
    if (!client || !id) return
    setBusy(true); setError(null)
    try {
      const rel = parseRelease(await client.raw(`releases/${encodeURIComponent(id)}`))
      setDetail(rel)
      await saveDiscogsStats(getFirebase().db, uid, album.id, communityStats(rel))
      await onChanged()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not reach Discogs.') } finally { setBusy(false) }
  }

  const demand = demandLabel(stats?.have, stats?.want)
  return (
    <section aria-labelledby="dc-h" className="mt-8 rounded-2xl bg-sleeve p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="dc-h" className="text-xl font-medium">Discogs community</h2>
        {client && id && <button onClick={() => void refresh()} disabled={busy} className="rounded-lg bg-sleeve-hi px-3 py-1.5 text-sm font-medium hover:bg-groove disabled:opacity-50">{busy ? 'Refreshing…' : stats ? 'Refresh from Discogs' : 'Load from Discogs'}</button>}
      </div>
      {error && <div className="mt-3"><ErrorState message={error} /></div>}

      {stats
        ? (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><dt className="text-sm text-dust">Community rating</dt><dd className="font-display text-2xl font-bold">{stats.rating !== undefined ? `${stats.rating.toFixed(2)} / 5` : '—'}</dd><dd className="text-xs text-dust">{stats.ratingCount !== undefined ? `${n(stats.ratingCount)} ratings` : ''}</dd></div>
              <div><dt className="text-sm text-dust">Have it</dt><dd className="font-display text-2xl font-bold">{n(stats.have)}</dd></div>
              <div><dt className="text-sm text-dust">Want it</dt><dd className="font-display text-2xl font-bold">{n(stats.want)}</dd></div>
              <div><dt className="text-sm text-dust">For sale now</dt><dd className="font-display text-2xl font-bold">{n(stats.forSale)}</dd></div>
            </dl>
            {demand && <p className="mt-2 text-sm text-dust">{demand}.</p>}
            <p className="mt-1 text-xs text-dust">As of {formatDay(stats.fetchedAt)}. Data from Discogs.</p>
          </>
        )
        : <p className="mt-3 text-dust">{client ? 'Load the numbers to see how the community rates this pressing.' : 'Add Discogs credentials in Settings to load community numbers.'}</p>}

      {detail && (
        <div className="mt-4 flex flex-col gap-4 border-t border-groove pt-4 text-sm">
          {detail.data_quality && <p><span className="text-dust">Data quality:</span> {detail.data_quality}</p>}
          {detail.notes && <div><h3 className="mb-1 text-dust">Release notes</h3><p className="whitespace-pre-wrap">{detail.notes.slice(0, 1200)}{detail.notes.length > 1200 ? '…' : ''}</p></div>}
          {detail.extraartists.length > 0 && (
            <div><h3 className="mb-1 text-dust">Credits</h3><ul className="columns-1 sm:columns-2">{detail.extraartists.slice(0, 12).map((c, i) => <li key={i}>{c.name?.replace(/\s+\(\d+\)$/, '')}{c.role ? <span className="text-dust">, {c.role}</span> : null}</li>)}</ul></div>
          )}
          {detail.videos.length > 0 && (
            <div><h3 className="mb-1 text-dust">Videos</h3><ul>{detail.videos.slice(0, 6).filter((v) => v.uri && /^https:\/\//.test(v.uri)).map((v, i) => <li key={i}><a href={v.uri} target="_blank" rel="noreferrer" className="text-label underline underline-offset-4">{v.title ?? 'Video'}</a></li>)}</ul></div>
          )}
        </div>
      )}

      {id && (
        <p className="mt-4 text-sm text-dust">
          Written reviews and comments aren’t available through the Discogs API, so they can’t be shown here.{' '}
          <a href={discogsReleaseUrl(id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-label underline underline-offset-4">Read them on Discogs <ExternalLink aria-hidden className="size-3" /></a>
        </p>
      )}
    </section>
  )
}
