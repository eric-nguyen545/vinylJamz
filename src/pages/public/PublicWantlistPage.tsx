import { useMemo } from 'react'
import { AlbumArtwork } from '../../components/AlbumArtwork'
import { ErrorState, LoadingState } from '../../components/States'
import { PRIORITY_LABEL, PRIORITY_RANK } from '../../lib/wantlistForm'
import { publicWantSchema } from '../../lib/schemas'
import { usePublicList } from '../../lib/usePublicData'
import { SectionOff, usePublicContext } from './PublicLayout'

const money = (n: number, c: string) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n) } catch { return `${n} ${c}` } }

export function PublicWantlistPage() {
  const { shareId, site } = usePublicContext()
  const { items, error } = usePublicList(shareId, 'wantlist', publicWantSchema)
  const sorted = useMemo(() => [...(items ?? [])].sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || a.albumTitle.localeCompare(b.albumTitle)), [items])
  if (!site.sections.wantlist) return <SectionOff />
  if (error) return <ErrorState title="Couldn’t load the wantlist" message={error} />
  if (!items) return <LoadingState label="Loading wantlist" />
  if (items.length === 0) return <p className="text-dust">Nothing on the wantlist is shared right now.</p>
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {sorted.map((w) => (
        <li key={w.id} className="flex gap-4 rounded-2xl bg-sleeve p-4">
          <AlbumArtwork url={w.artworkUrl} title={w.albumTitle} artist={w.primaryArtist ?? ''} className="w-20 shrink-0 self-start rounded" />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-medium">{w.albumTitle}</h2>
            <p className="truncate text-sm text-dust">{w.primaryArtist}{w.releaseYear ? `, ${w.releaseYear}` : ''}</p>
            <p className="mt-1 text-xs"><span className={`rounded-full px-2 py-0.5 ${w.priority === 'high' ? 'bg-label text-label-ink' : 'bg-sleeve-hi'}`}>{PRIORITY_LABEL[w.priority]} priority</span></p>
            {w.desiredPressingNotes && <p className="mt-2 text-sm">Looking for: {w.desiredPressingNotes}</p>}
            {w.targetPrice !== undefined && w.currency && <p className="text-sm text-dust">Target {money(w.targetPrice, w.currency)}</p>}
          </div>
        </li>
      ))}
    </ul>
  )
}
