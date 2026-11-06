import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { AlbumArtwork } from './AlbumArtwork'
import { formatRating } from '../lib/rating'
import { formatDuration } from '../lib/format'
import type { z } from 'zod'
import type { publicAlbumSchema } from '../lib/schemas'

export type PublicAlbum = z.infer<typeof publicAlbumSchema> & { id: string }

export function PublicAlbumCard({ album, onOpen }: { album: PublicAlbum; onOpen: (a: PublicAlbum) => void }) {
  const artist = album.artistNames.join(', ')
  return (
    <li>
      <button onClick={() => onOpen(album)} className="group block w-full text-left">
        <AlbumArtwork url={album.artworkUrl} title={album.title} artist={artist} className="rounded-md ring-1 ring-groove transition group-hover:ring-label" />
        <p className="mt-2 truncate font-medium">{album.title}</p>
        <p className="truncate text-sm text-dust">{artist}{album.releaseYear ? `, ${album.releaseYear}` : ''}</p>
        {album.rating !== undefined && <p className="text-xs text-label">{formatRating(album.rating, 10)}</p>}
      </button>
    </li>
  )
}

export function PublicAlbumDetails({ album }: { album: PublicAlbum }) {
  const artist = album.artistNames.join(', ')
  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-4">
        <AlbumArtwork url={album.artworkUrl} title={album.title} artist={artist} size={500} eager className="w-32 shrink-0 self-start rounded sm:w-44" />
        <div>
          <h2 className="text-2xl font-bold">{album.title}</h2>
          <p className="text-dust">{artist}{album.releaseYear ? `, ${album.releaseYear}` : ''}</p>
          {album.genres.length > 0 && <p className="mt-1 text-sm text-dust">{album.genres.join(', ')}</p>}
          {album.rating !== undefined && <p className="mt-3 font-display text-2xl font-bold">{formatRating(album.rating, 10)}</p>}
        </div>
      </div>
      {album.vibes && album.vibes.length > 0 && (
        <ul aria-label="Vibes" className="flex flex-wrap gap-2">{album.vibes.map((v) => <li key={v} className="rounded-full bg-sleeve-hi px-3 py-1 text-sm">{v}</li>)}</ul>
      )}
      {album.review && <p className="whitespace-pre-wrap">{album.review}</p>}
      {album.topThreeTracks && album.topThreeTracks.length > 0 && (
        <div><h3 className="mb-1 text-sm text-dust">Top tracks</h3><ol className="list-decimal pl-5">{album.topThreeTracks.map((t) => <li key={t}>{t}</li>)}</ol></div>
      )}
      {album.publicPressingSummary && album.publicPressingSummary.length > 0 && (
        <div><h3 className="mb-1 text-sm text-dust">Pressings</h3><ul>{album.publicPressingSummary.map((p, i) => <li key={`${p}-${i}`}>{p}</li>)}</ul></div>
      )}
      {album.discogs && (album.discogs.rating !== undefined || album.discogs.have !== undefined) && (
        <div>
          <h3 className="mb-1 text-sm text-dust">Discogs community</h3>
          <p className="text-sm">
            {album.discogs.rating !== undefined && <span>{album.discogs.rating.toFixed(2)} / 5{album.discogs.ratingCount !== undefined ? ` (${album.discogs.ratingCount.toLocaleString()} ratings)` : ''}. </span>}
            {album.discogs.have !== undefined && <span>{album.discogs.have.toLocaleString()} have it. </span>}
            {album.discogs.want !== undefined && <span>{album.discogs.want.toLocaleString()} want it. </span>}
            {album.discogs.forSale !== undefined && <span>{album.discogs.forSale.toLocaleString()} for sale. </span>}
            {album.discogs.url && <a href={album.discogs.url} target="_blank" rel="noreferrer" className="text-label underline underline-offset-4">View on Discogs</a>}
          </p>
        </div>
      )}
      {album.purchases && album.purchases.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm text-dust">Paid</h3>
          <ul className="text-sm">{album.purchases.map((p, i) => <li key={i}>{(() => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency }).format(p.price) } catch { return `${p.price} ${p.currency}` } })()}{p.date ? `, ${p.date}` : ''}</li>)}</ul>
        </div>
      )}
      {album.tracklist && album.tracklist.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm text-dust">Tracklist</h3>
          <ol className="divide-y divide-groove rounded-xl bg-ink text-sm">
            {album.tracklist.map((t) => (
              <li key={t.id} className="flex gap-3 px-3 py-1.5"><span className="w-8 shrink-0 text-dust">{t.position}</span><span className="flex-1">{t.title}</span><span className="text-dust">{formatDuration(t.durationMs)}</span></li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

export function PublicAlbumDialog({ album, onClose }: { album: PublicAlbum | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (album && !d.open) d.showModal()
    if (!album && d.open) d.close()
  }, [album])
  return (
    <dialog ref={ref} onClose={onClose} aria-label={album?.title ?? 'Album details'}
      className="m-auto max-h-[90vh] w-[min(40rem,94vw)] overflow-y-auto rounded-2xl border border-groove bg-sleeve p-6 text-paper backdrop:bg-black/70">
      <button onClick={onClose} aria-label="Close" className="float-right rounded-md p-2 hover:bg-sleeve-hi"><X aria-hidden className="size-5" /></button>
      {album && <PublicAlbumDetails album={album} />}
    </dialog>
  )
}
