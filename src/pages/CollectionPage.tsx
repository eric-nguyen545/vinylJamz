import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid, List, Plus, Search } from 'lucide-react'
import { useAuth } from '../app/AuthContext'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { AlbumGrid, AlbumTable } from '../components/AlbumCollectionViews'
import { inputClass } from '../components/Field'
import { normalizeText } from '../lib/normalize'
import { useOwnedAlbums, type AlbumSort } from '../lib/useOwnedAlbums'

export function CollectionPage() {
  const { state } = useAuth()
  if (state.status !== 'owner') return null
  return <CollectionBody uid={state.user.uid} />
}

function CollectionBody({ uid }: { uid: string }) {
  const [sort, setSort] = useState<AlbumSort>('title')
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [q, setQ] = useState('')
  const { items, loading, error, hasMore, loadMore, reload } = useOwnedAlbums(uid, sort)

  // Searching needs the whole collection, so keep paging while a search is active.
  useEffect(() => { if (q.trim() && hasMore && !loading) void loadMore() }, [q, hasMore, loading, loadMore])

  const shown = useMemo(() => {
    const needle = normalizeText(q)
    if (!needle) return items
    return items.filter((a) => normalizeText([a.title, ...a.artistNames, ...a.labelNames].join(' ')).includes(needle))
  }, [items, q])

  const add = (
    <Link to="/collection/add" className="inline-flex items-center gap-2 rounded-lg bg-label px-4 py-2 font-semibold text-label-ink">
      <Plus aria-hidden className="size-4" /> Add album
    </Link>
  )

  return (
    <>
      <PageHeader title="My Collection" description="Albums you own, one entry per album with each pressing tracked as a copy." actions={add} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Search your collection</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dust" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, artist or label" className={`${inputClass} pl-9`} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as AlbumSort)} className="rounded-lg border border-groove bg-sleeve px-3 py-2">
            <option value="title">Title A–Z</option>
            <option value="recent">Recently added</option>
          </select>
        </label>
        <div role="group" aria-label="View" className="flex overflow-hidden rounded-lg border border-groove">
          <button aria-pressed={view === 'grid'} onClick={() => setView('grid')} className={`p-2.5 ${view === 'grid' ? 'bg-label text-label-ink' : 'bg-sleeve'}`}>
            <LayoutGrid aria-hidden className="size-4" /><span className="sr-only">Artwork grid</span>
          </button>
          <button aria-pressed={view === 'table'} onClick={() => setView('table')} className={`p-2.5 ${view === 'table' ? 'bg-label text-label-ink' : 'bg-sleeve'}`}>
            <List aria-hidden className="size-4" /><span className="sr-only">Compact list</span>
          </button>
        </div>
      </div>

      {error && <ErrorState title="Couldn’t load your albums" message={error} onRetry={() => void reload()} />}
      {!error && loading && items.length === 0 && <LoadingState label="Loading your albums" />}
      {!error && !loading && items.length === 0 && (
        <EmptyState title="No albums yet" action={add}>Search for an album to add your first record, or enter one by hand.</EmptyState>
      )}
      {items.length > 0 && shown.length === 0 && !loading && !hasMore && (
        <EmptyState title="No matches">Nothing in your collection matches “{q}”.</EmptyState>
      )}
      {shown.length > 0 && (view === 'grid' ? <AlbumGrid albums={shown} /> : <AlbumTable albums={shown} />)}
      {hasMore && !q.trim() && (
        <div className="mt-8 text-center">
          <button disabled={loading} onClick={() => void loadMore()} className="rounded-lg bg-sleeve-hi px-5 py-2 font-medium hover:bg-groove disabled:opacity-50">
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </>
  )
}
