import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ExternalLink, Plus } from 'lucide-react'
import { getDoc } from 'firebase/firestore'
import { useAuth } from '../app/AuthContext'
import { AlbumArtwork } from '../components/AlbumArtwork'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CopyCard } from '../components/CopyCard'
import { DiscogsCommunity } from '../components/DiscogsCommunity'
import { ExperienceSection } from '../components/ExperienceSection'
import { ListeningSection } from '../components/ListeningSection'
import { MarketSection } from '../components/MarketSection'
import { PressingForm } from '../components/PressingForm'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { getFirebase } from '../firebase/config'
import { userDoc } from '../firebase/paths'
import {
  addCopy, deleteAlbumWithCopies, deleteCopy, listCopies, setArchived, snapToAlbum, updateCopy,
  type StoredAlbum, type StoredCopy,
} from '../lib/albumsRepo'
import { copyToForm, formToCopy, type CopyFormState, type FormErrors } from '../lib/formState'
import { formatDuration } from '../lib/format'
import { getReview, type StoredReview } from '../lib/reviewsRepo'
import { usePreferences } from '../lib/usePreferences'
import { usePurchaseLocations } from '../lib/useLocations'
import { authFromSettings } from '../lib/providers/discogs'
import { usePricingSettings } from '../lib/usePricingSettings'

type Editing = { mode: 'add' } | { mode: 'edit'; copy: StoredCopy } | null

export function AlbumDetailPage() {
  const { state } = useAuth()
  const { albumId } = useParams()
  if (state.status !== 'owner' || !albumId) return null
  return <Detail key={albumId} uid={state.user.uid} albumId={albumId} />
}

function Detail({ uid, albumId }: { uid: string; albumId: string }) {
  const navigate = useNavigate()
  const prefs = usePreferences(uid)
  const { locations } = usePurchaseLocations(uid)
  const { settings: pricingSettings } = usePricingSettings(uid)
  const discogsAuth = useMemo(() => authFromSettings(pricingSettings), [pricingSettings])
  const [album, setAlbum] = useState<StoredAlbum | null>(null)
  const [copies, setCopies] = useState<StoredCopy[]>([])
  const [review, setReview] = useState<StoredReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [form, setForm] = useState<CopyFormState | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [busy, setBusy] = useState(false)
  const [confirmCopy, setConfirmCopy] = useState<StoredCopy | null>(null)
  const [confirmAlbum, setConfirmAlbum] = useState(false)
  const { db } = getFirebase()

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const snap = await getDoc(userDoc(db, uid, 'albums', albumId))
      const a = snapToAlbum(snap)
      setAlbum(a)
      setCopies(a ? await listCopies(db, uid, albumId) : [])
      setReview(a ? await getReview(db, uid, albumId) : null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this album.') } finally { setLoading(false) }
  }, [db, uid, albumId])

  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setActionError(null)
    try { await fn() } catch (e) { setActionError(e instanceof Error ? e.message : 'That action failed.') } finally { setBusy(false) }
  }

  function openEditor(e: Editing) {
    setEditing(e); setErrors({})
    setForm(e?.mode === 'edit' ? copyToForm(e.copy, prefs.defaultCurrency) : copyToForm({}, prefs.defaultCurrency))
  }

  async function saveCopy() {
    if (!form || !editing) return
    const r = formToCopy(form)
    setErrors(r.ok ? {} : r.errors)
    if (!r.ok) return
    await run(async () => {
      if (editing.mode === 'add') await addCopy(db, uid, albumId, r.value)
      else await updateCopy(db, uid, albumId, editing.copy.id, r.value)
      setEditing(null)
      await load()
    })
  }

  if (loading && !album) return <LoadingState label="Loading album" />
  if (error) return <ErrorState title="Couldn’t load this album" message={error} onRetry={() => void load()} />
  if (!album) return <EmptyState title="Album not found" action={<Link to="/collection" className="text-label underline">Back to your collection</Link>}>It may have been deleted.</EmptyState>

  const mbId = album.externalIdentifiers.musicbrainzRelease ?? album.externalIdentifiers.musicbrainzReleaseGroup
  const mbPath = album.externalIdentifiers.musicbrainzRelease ? 'release' : 'release-group'

  return (
    <>
      <Link to="/collection" className="mb-6 inline-block text-sm text-dust underline underline-offset-4">Back to collection</Link>
      {actionError && <div className="mb-6"><ErrorState message={actionError} /></div>}
      {album.archived && <p role="status" className="mb-6 rounded-lg bg-warn/10 p-3 text-sm">This album is archived and hidden from your collection.</p>}

      <section aria-labelledby="overview-h" className="flex flex-col gap-8 md:flex-row">
        <AlbumArtwork url={album.artworkUrl} title={album.title} artist={album.primaryArtist} size={500} eager className="w-full max-w-sm shrink-0 self-start rounded-md ring-1 ring-groove" />
        <div className="min-w-0 flex-1">
          <h1 id="overview-h" className="text-4xl font-bold">{album.title}</h1>
          <p className="mt-1 text-xl text-dust">{album.artistNames.join(', ')}</p>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {album.releaseYear && <><dt className="text-dust">Year</dt><dd>{album.releaseYear}</dd></>}
            {album.genres.length > 0 && <><dt className="text-dust">Genres</dt><dd>{album.genres.join(', ')}</dd></>}
            {album.labelNames.length > 0 && <><dt className="text-dust">Labels</dt><dd>{album.labelNames.join(', ')}</dd></>}
          </dl>
          {mbId && (
            <a href={`https://musicbrainz.org/${mbPath}/${mbId}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-label underline underline-offset-4">
              View on MusicBrainz <ExternalLink aria-hidden className="size-3" />
            </a>
          )}
          {album.metadataSources.includes('musicbrainz') && <p className="mt-1 text-xs text-dust">Metadata: MusicBrainz. Artwork: Cover Art Archive.</p>}
          {album.tracklist.length > 0 && (
            <>
              <h2 className="mb-2 mt-8 text-xl font-medium">Tracklist</h2>
              <ol className="divide-y divide-groove rounded-xl bg-sleeve text-sm">
                {album.tracklist.map((t) => (
                  <li key={t.id} className="flex gap-3 px-4 py-2">
                    <span className="w-8 shrink-0 text-dust">{t.position}</span>
                    <span className="flex-1">{t.title}</span>
                    <span className="text-dust">{formatDuration(t.durationMs)}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </section>

      <DiscogsCommunity uid={uid} album={album} auth={discogsAuth} onChanged={load} />

      <ExperienceSection key={review?.updatedAt?.toMillis?.() ?? 'none'} uid={uid} album={album} review={review} ratingMax={prefs.ratingMax} onChanged={load} />

      <ListeningSection uid={uid} album={album} />

      <section aria-labelledby="copies-h" className="mt-12">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="copies-h" className="text-2xl font-bold">My copies</h2>
          {!editing && (
            <button onClick={() => openEditor({ mode: 'add' })} className="inline-flex items-center gap-2 rounded-lg bg-label px-4 py-2 font-semibold text-label-ink">
              <Plus aria-hidden className="size-4" /> Add copy
            </button>
          )}
        </div>

        {editing && form && (
          <form onSubmit={(e) => { e.preventDefault(); void saveCopy() }} className="mb-8 rounded-2xl border border-groove p-5">
            <h3 className="mb-4 text-xl font-medium">{editing.mode === 'add' ? 'Add a copy' : 'Edit copy'}</h3>
            <PressingForm value={form} errors={errors} onChange={setForm} locations={locations} />
            <div className="mt-6 flex gap-3">
              <button type="submit" disabled={busy} className="rounded-lg bg-label px-5 py-2 font-semibold text-label-ink disabled:opacity-50">{busy ? 'Saving…' : 'Save copy'}</button>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg bg-sleeve-hi px-5 py-2 font-medium hover:bg-groove">Cancel</button>
            </div>
          </form>
        )}

        {copies.length === 0 && !editing
          ? <EmptyState title="No copies recorded">This album won’t appear in your collection until you add a copy.</EmptyState>
          : <ul className="grid gap-4 md:grid-cols-2">{copies.map((c) => <CopyCard key={c.id} copy={c} locationName={locations.find((l) => l.id === c.purchaseLocationId)?.name} onEdit={() => openEditor({ mode: 'edit', copy: c })} onDelete={() => setConfirmCopy(c)} />)}</ul>}
      </section>

      <MarketSection uid={uid} album={album} copies={copies} defaultCurrency={prefs.defaultCurrency} onAlbumChanged={load} />

      <section aria-labelledby="manage-h" className="mt-14 border-t border-groove pt-6">
        <h2 id="manage-h" className="text-xl font-medium">Manage album</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {album.archived
            ? <button disabled={busy} onClick={() => void run(async () => { await setArchived(db, uid, albumId, false); await load() })} className="rounded-lg bg-sleeve-hi px-4 py-2 font-medium hover:bg-groove">Restore to collection</button>
            : <button disabled={busy} onClick={() => void run(async () => { await setArchived(db, uid, albumId, true); navigate('/collection') })} className="rounded-lg bg-sleeve-hi px-4 py-2 font-medium hover:bg-groove">Archive album</button>}
          <button onClick={() => setConfirmAlbum(true)} className="rounded-lg px-4 py-2 font-medium text-bad hover:bg-sleeve-hi">Delete permanently</button>
        </div>
        <p className="mt-2 max-w-lg text-sm text-dust">Archiving hides the album and keeps all its data. Deleting removes the album and every copy for good.</p>
      </section>

      <ConfirmDialog open={confirmCopy !== null} title="Delete this copy?" confirmLabel="Delete copy" destructive busy={busy}
        onCancel={() => setConfirmCopy(null)}
        onConfirm={() => void run(async () => { if (confirmCopy) await deleteCopy(db, uid, albumId, confirmCopy.id); setConfirmCopy(null); await load() })}>
        {copies.length === 1
          ? 'This is your only copy. The album stays saved but leaves your collection until you add another copy.'
          : 'This removes the copy and its purchase details. The album and your other copies stay.'}
      </ConfirmDialog>

      <ConfirmDialog open={confirmAlbum} title="Delete album and all copies?" confirmLabel="Delete everything" destructive busy={busy}
        onCancel={() => setConfirmAlbum(false)}
        onConfirm={() => void run(async () => { await deleteAlbumWithCopies(db, uid, albumId); navigate('/collection') })}>
        This permanently deletes “{album.title}”, {copies.length} {copies.length === 1 ? 'copy' : 'copies'} with their purchase details, your review and your listening history. This can’t be undone.
      </ConfirmDialog>
    </>
  )
}
