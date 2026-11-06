/** Ratings are stored on a canonical 0-10 scale so changing the display scale never corrupts data. */
export const ratingStep = (ratingMax: number) => (ratingMax === 100 ? 1 : 0.5)

export const toCanonical = (value: number, ratingMax: number) => Math.round((value / ratingMax) * 10 * 100) / 100

export function fromCanonical(canonical: number, ratingMax: number): number {
  const step = ratingStep(ratingMax)
  return Math.round(((canonical / 10) * ratingMax) / step) * step
}

export function formatRating(canonical: number | undefined, ratingMax: number): string {
  if (canonical === undefined) return ''
  const v = fromCanonical(canonical, ratingMax)
  return `${Number.isInteger(v) ? v : v.toFixed(1)} / ${ratingMax}`
}

/** Mean of canonical ratings (0-10), one decimal; undefined when nothing is rated. */
export function averageRating(canonical: Array<number | undefined>): number | undefined {
  const valid = canonical.filter((r): r is number => typeof r === 'number' && Number.isFinite(r))
  if (!valid.length) return undefined
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10
}
