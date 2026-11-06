import type { Track } from '../lib/schemas'
import { ratingStep } from '../lib/rating'
import type { ReviewFormState } from '../lib/reviewForm'
import type { FormErrors } from '../lib/formState'
import { Field, inputClass } from './Field'
import { VibeTagInput } from './VibeTagInput'

interface Props {
  value: ReviewFormState
  errors: FormErrors
  tracklist: Track[]
  ratingMax: number
  busy?: boolean
  onChange: (v: ReviewFormState) => void
  onSubmit: () => void
  onCancel: () => void
}

export function ReviewForm({ value, errors, tracklist, ratingMax, busy, onChange, onSubmit, onCancel }: Props) {
  const toggleTrack = (id: string) => {
    const has = value.topThreeTrackIds.includes(id)
    if (!has && value.topThreeTrackIds.length >= 3) return
    onChange({ ...value, topThreeTrackIds: has ? value.topThreeTrackIds.filter((x) => x !== id) : [...value.topThreeTrackIds, id] })
  }
  const full = value.topThreeTrackIds.length >= 3

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit() }} className="flex flex-col gap-6 rounded-2xl border border-groove p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={`Rating (0–${ratingMax})`} hint={`Steps of ${ratingStep(ratingMax)}. Leave blank for unrated.`} error={errors.rating}>
          <input className={inputClass} inputMode="decimal" value={value.rating} onChange={(e) => onChange({ ...value, rating: e.target.value })} />
        </Field>
        <Field label="First listened" error={errors.firstListenedAt}>
          <input className={inputClass} type="date" value={value.firstListenedAt} onChange={(e) => onChange({ ...value, firstListenedAt: e.target.value })} />
        </Field>
        <label className="flex items-center gap-3 self-end pb-2 text-sm font-medium">
          <input type="checkbox" checked={value.isFavorite} onChange={(e) => onChange({ ...value, isFavorite: e.target.checked })} className="size-5 accent-[var(--color-label)]" />
          Favorite album
        </label>
      </div>

      <Field label="Review" hint="Private unless you choose to share it on your public page." error={errors.review}>
        <textarea className={inputClass} rows={6} maxLength={10000} value={value.review} onChange={(e) => onChange({ ...value, review: e.target.value })} />
      </Field>

      <VibeTagInput value={value.vibes} onChange={(vibes) => onChange({ ...value, vibes })} error={errors.vibes} />

      <fieldset>
        <legend className="text-sm font-medium">Top three tracks <span className="font-normal text-dust">({value.topThreeTrackIds.length}/3)</span></legend>
        {tracklist.length === 0
          ? <p className="mt-1 text-sm text-dust">This album has no saved tracklist, so tracks can’t be picked.</p>
          : (
            <ul className="mt-2 max-h-64 overflow-y-auto rounded-xl bg-sleeve text-sm">
              {tracklist.map((t) => {
                const checked = value.topThreeTrackIds.includes(t.id)
                return (
                  <li key={t.id}>
                    <label className={`flex items-center gap-3 px-4 py-2 ${!checked && full ? 'opacity-50' : 'cursor-pointer hover:bg-sleeve-hi'}`}>
                      <input type="checkbox" checked={checked} disabled={!checked && full} onChange={() => toggleTrack(t.id)} className="size-4 accent-[var(--color-label)]" />
                      <span className="w-8 shrink-0 text-dust">{t.position}</span>
                      <span>{t.title}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
      </fieldset>

      <div className="flex gap-3">
        <button type="submit" disabled={busy} className="rounded-lg bg-label px-5 py-2 font-semibold text-label-ink disabled:opacity-50">{busy ? 'Saving…' : 'Save review'}</button>
        <button type="button" onClick={onCancel} className="rounded-lg bg-sleeve-hi px-5 py-2 font-medium hover:bg-groove">Cancel</button>
      </div>
    </form>
  )
}
