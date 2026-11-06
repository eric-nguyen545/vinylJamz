import { Link } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { formatDay } from '../lib/format'
import type { StoredSession } from '../lib/sessionsRepo'
import { AlbumArtwork } from './AlbumArtwork'

interface Props { session: StoredSession; showAlbum?: boolean; onEdit: () => void; onDelete: () => void }

export function SessionCard({ session: s, showAlbum = true, onEdit, onDelete }: Props) {
  const title = s.albumTitle ?? 'Album'
  return (
    <li className="flex gap-4 rounded-2xl bg-sleeve p-4">
      {showAlbum && <AlbumArtwork url={s.artworkUrl} title={title} artist={s.primaryArtist ?? ''} className="w-16 shrink-0 self-start rounded" />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          {showAlbum
            ? <Link to={`/collection/${s.albumId}`} className="truncate font-medium underline-offset-4 hover:underline">{title}{s.primaryArtist ? <span className="font-normal text-dust"> by {s.primaryArtist}</span> : null}</Link>
            : <span className="font-medium">{formatDay(s.date)}</span>}
          {showAlbum && <span className="text-sm text-dust">{formatDay(s.date)}</span>}
        </div>
        <p className="mt-1 text-sm text-dust">{s.completedAlbum ? 'Whole album' : 'Partial listen'}{s.locationText ? `, ${s.locationText}` : ''}</p>
        {s.vibeTags.length > 0 && <ul aria-label="Vibes" className="mt-2 flex flex-wrap gap-2">{s.vibeTags.map((v) => <li key={v} className="rounded-full bg-sleeve-hi px-2.5 py-0.5 text-xs">{v}</li>)}</ul>}
        {s.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{s.notes}</p>}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <button onClick={onEdit} aria-label={`Edit listen on ${formatDay(s.date)}`} className="rounded-md p-2 hover:bg-sleeve-hi"><Pencil aria-hidden className="size-4" /></button>
        <button onClick={onDelete} aria-label={`Delete listen on ${formatDay(s.date)}`} className="rounded-md p-2 text-bad hover:bg-sleeve-hi"><Trash2 aria-hidden className="size-4" /></button>
      </div>
    </li>
  )
}
