import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { ErrorState, LoadingState } from '../../components/States'
import { inputClass } from '../../components/Field'
import { PublicAlbumCard, PublicAlbumDialog, type PublicAlbum } from '../../components/PublicAlbumViews'
import { normalizeText } from '../../lib/normalize'
import { publicAlbumSchema } from '../../lib/schemas'
import { usePublicList } from '../../lib/usePublicData'
import { SectionOff, usePublicContext } from './PublicLayout'

export function PublicCollectionPage() {
  const { shareId, site } = usePublicContext()
  const { items, error } = usePublicList(shareId, 'albums', publicAlbumSchema)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<PublicAlbum | null>(null)
  const sorted = useMemo(() => [...(items ?? [])].sort((a, b) => a.title.localeCompare(b.title)), [items])
  const shown = useMemo(() => {
    const needle = normalizeText(q)
    return needle ? sorted.filter((a) => normalizeText([a.title, ...a.artistNames].join(' ')).includes(needle)) : sorted
  }, [sorted, q])

  if (!site.sections.collection) return <SectionOff />
  if (error) return <ErrorState title="Couldn’t load the collection" message={error} />
  if (!items) return <LoadingState label="Loading albums" />
  return (
    <>
      <p className="mb-4 text-sm text-dust">{items.length} {items.length === 1 ? 'album' : 'albums'}</p>
      <label className="relative mb-6 block max-w-md">
        <span className="sr-only">Search this collection</span>
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dust" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or artist" className={`${inputClass} pl-9`} />
      </label>
      {shown.length === 0
        ? <p className="text-dust">{items.length === 0 ? 'Nothing has been shared yet.' : `No albums match “${q}”.`}</p>
        : <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{shown.map((a) => <PublicAlbumCard key={a.id} album={a} onOpen={setOpen} />)}</ul>}
      <PublicAlbumDialog album={open} onClose={() => setOpen(null)} />
    </>
  )
}
