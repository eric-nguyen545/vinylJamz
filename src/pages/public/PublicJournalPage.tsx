import { useMemo } from 'react'
import { AlbumArtwork } from '../../components/AlbumArtwork'
import { ErrorState, LoadingState } from '../../components/States'
import { formatDay, monthLabel } from '../../lib/format'
import { groupByMonth } from '../../lib/journal'
import { publicListenSchema } from '../../lib/schemas'
import { usePublicList } from '../../lib/usePublicData'
import { SectionOff, usePublicContext } from './PublicLayout'

export function PublicJournalPage() {
  const { shareId, site } = usePublicContext()
  const { items, error } = usePublicList(shareId, 'listens', publicListenSchema)
  const groups = useMemo(() => groupByMonth(items ?? []), [items])
  if (!site.sections.journal) return <SectionOff />
  if (error) return <ErrorState title="Couldn’t load the journal" message={error} />
  if (!items) return <LoadingState label="Loading journal" />
  if (items.length === 0) return <p className="text-dust">No listens are shared right now.</p>
  return (
    <div className="flex flex-col gap-8">
      {groups.map((g) => (
        <section key={g.key} aria-label={monthLabel(g.key)}>
          <h2 className="mb-3 text-xl font-medium">{monthLabel(g.key)} <span className="text-base font-normal text-dust">({g.sessions.length})</span></h2>
          <ul className="flex flex-col gap-3">
            {g.sessions.map((s) => (
              <li key={s.id} className="flex gap-4 rounded-2xl bg-sleeve p-4">
                <AlbumArtwork url={s.artworkUrl} title={s.albumTitle} artist={s.primaryArtist ?? ''} className="w-14 shrink-0 self-start rounded" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3"><span className="truncate font-medium">{s.albumTitle}{s.primaryArtist ? <span className="font-normal text-dust"> by {s.primaryArtist}</span> : null}</span><span className="text-sm text-dust">{formatDay(s.date)}</span></div>
                  <p className="mt-1 text-sm text-dust">{s.completedAlbum ? 'Whole album' : 'Partial listen'}</p>
                  {s.vibeTags.length > 0 && <ul aria-label="Vibes" className="mt-2 flex flex-wrap gap-2">{s.vibeTags.map((v) => <li key={v} className="rounded-full bg-sleeve-hi px-2.5 py-0.5 text-xs">{v}</li>)}</ul>}
                  {s.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{s.notes}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
