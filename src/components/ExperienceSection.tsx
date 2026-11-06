import { useState } from 'react'
import { Heart } from 'lucide-react'
import type { StoredAlbum } from '../lib/albumsRepo'
import type { StoredReview } from '../lib/reviewsRepo'
import { deleteReview, saveReview } from '../lib/reviewsRepo'
import { formatRating } from '../lib/rating'
import { formToReview, reviewToForm, type ReviewFormState } from '../lib/reviewForm'
import type { FormErrors } from '../lib/formState'
import { getFirebase } from '../firebase/config'
import { ConfirmDialog } from './ConfirmDialog'
import { EmptyState, ErrorState } from './States'
import { ReviewForm } from './ReviewForm'

interface Props { uid: string; album: StoredAlbum; review: StoredReview | null; ratingMax: number; onChanged: () => Promise<void> | void }

export function ExperienceSection({ uid, album, review, ratingMax, onChanged }: Props) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<ReviewFormState>(() => reviewToForm(review, ratingMax))
  const [errors, setErrors] = useState<FormErrors>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { db } = getFirebase()

  function open() { setForm(reviewToForm(review, ratingMax)); setErrors({}); setError(null); setEditing(true) }

  async function save() {
    const r = formToReview(form, ratingMax, album.tracklist.map((t) => t.id))
    setErrors(r.ok ? {} : r.errors)
    if (!r.ok) return
    setBusy(true); setError(null)
    try { await saveReview(db, uid, album.id, r.value); setEditing(false); await onChanged() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save your review.') }
    finally { setBusy(false) }
  }

  async function remove() {
    setBusy(true); setError(null)
    try { await deleteReview(db, uid, album.id); setConfirmDelete(false); await onChanged() }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete your review.') }
    finally { setBusy(false) }
  }

  const topTracks = (review?.topThreeTrackIds ?? []).map((id) => album.tracklist.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => Boolean(t))

  return (
    <section aria-labelledby="exp-h" className="mt-12">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="exp-h" className="text-2xl font-bold">My experience</h2>
        {!editing && (
          <div className="flex gap-2">
            {review && <button onClick={() => setConfirmDelete(true)} className="rounded-lg px-3 py-2 text-sm font-medium text-bad hover:bg-sleeve-hi">Delete review</button>}
            <button onClick={open} className="rounded-lg bg-sleeve-hi px-4 py-2 font-medium hover:bg-groove">{review ? 'Edit review' : 'Add review'}</button>
          </div>
        )}
      </div>
      {error && <div className="mb-4"><ErrorState message={error} /></div>}

      {editing && (
        <ReviewForm value={form} errors={errors} tracklist={album.tracklist} ratingMax={ratingMax} busy={busy}
          onChange={setForm} onSubmit={() => void save()} onCancel={() => setEditing(false)} />
      )}

      {!editing && !review && <EmptyState title="Not reviewed yet">Add a rating, a few vibes or your thoughts. All of it stays private unless you share it.</EmptyState>}

      {!editing && review && (
        <div className="flex flex-col gap-5 rounded-2xl bg-sleeve p-5">
          <div className="flex flex-wrap items-center gap-4">
            {review.rating !== undefined && <p className="font-display text-3xl font-bold">{formatRating(review.rating, ratingMax)}</p>}
            {review.isFavorite && <span className="inline-flex items-center gap-1 rounded-full bg-label px-3 py-1 text-sm font-semibold text-label-ink"><Heart aria-hidden className="size-4" /> Favorite</span>}
            {review.firstListenedAt && <p className="text-sm text-dust">First listened {review.firstListenedAt}</p>}
          </div>
          {review.vibes.length > 0 && (
            <ul aria-label="Vibes" className="flex flex-wrap gap-2">{review.vibes.map((v) => <li key={v} className="rounded-full bg-sleeve-hi px-3 py-1 text-sm">{v}</li>)}</ul>
          )}
          {review.review && <p className="max-w-prose whitespace-pre-wrap">{review.review}</p>}
          {topTracks.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm text-dust">Top tracks</h3>
              <ol className="list-decimal pl-5">{topTracks.map((t) => <li key={t.id}>{t.title}</li>)}</ol>
            </div>
          )}
          {review.rating === undefined && !review.review && review.vibes.length === 0 && topTracks.length === 0 && !review.isFavorite && !review.firstListenedAt && (
            <p className="text-dust">This review is empty. Edit it to add something.</p>
          )}
        </div>
      )}

      <ConfirmDialog open={confirmDelete} title="Delete your review?" confirmLabel="Delete review" destructive busy={busy}
        onCancel={() => setConfirmDelete(false)} onConfirm={() => void remove()}>
        This removes your rating, text, vibes and top tracks for this album. The album and its copies stay.
      </ConfirmDialog>
    </section>
  )
}
