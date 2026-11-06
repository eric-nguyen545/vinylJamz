import { reviewInputSchema, type ReviewInput } from './schemas'
import { fromCanonical, ratingStep, toCanonical } from './rating'
import type { FormErrors, Result } from './formState'

export interface ReviewFormState {
  rating: string
  review: string
  vibes: string[]
  topThreeTrackIds: string[]
  firstListenedAt: string
  isFavorite: boolean
}

export const emptyReviewForm = (): ReviewFormState => ({ rating: '', review: '', vibes: [], topThreeTrackIds: [], firstListenedAt: '', isFavorite: false })

export function reviewToForm(r: Partial<ReviewInput> | null, ratingMax: number): ReviewFormState {
  if (!r) return emptyReviewForm()
  return {
    rating: r.rating === undefined ? '' : String(fromCanonical(r.rating, ratingMax)),
    review: r.review ?? '', vibes: r.vibes ?? [], topThreeTrackIds: r.topThreeTrackIds ?? [],
    firstListenedAt: r.firstListenedAt ?? '', isFavorite: r.isFavorite ?? false,
  }
}

export const normalizeVibe = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40)

export function addVibe(list: string[], raw: string): string[] {
  const v = normalizeVibe(raw)
  if (!v || list.includes(v) || list.length >= 30) return list
  return [...list, v]
}

export function formToReview(f: ReviewFormState, ratingMax: number, validTrackIds: string[]): Result<ReviewInput> {
  const errors: FormErrors = {}
  let rating: number | undefined
  if (f.rating.trim() !== '') {
    const v = Number(f.rating)
    const step = ratingStep(ratingMax)
    if (!Number.isFinite(v) || v < 0 || v > ratingMax) errors.rating = `Enter a number from 0 to ${ratingMax}.`
    else if (Math.abs(v / step - Math.round(v / step)) > 1e-9) errors.rating = `Use steps of ${step}.`
    else rating = toCanonical(v, ratingMax)
  }
  if (Object.keys(errors).length) return { ok: false, errors }
  const parsed = reviewInputSchema.safeParse({
    rating,
    review: f.review.trim() || undefined,
    vibes: f.vibes,
    topThreeTrackIds: f.topThreeTrackIds.filter((id) => validTrackIds.includes(id)),
    firstListenedAt: f.firstListenedAt || undefined,
    isFavorite: f.isFavorite,
  })
  if (parsed.success) return { ok: true, value: parsed.data }
  for (const i of parsed.error.issues) errors[String(i.path[0] ?? 'form')] ??= i.message
  return { ok: false, errors }
}
