const ARTICLES = /^(the|a|an)\s+/i

export function normalizeText(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export const makeSortTitle = (title: string) => normalizeText(title).replace(ARTICLES, '')
export const makeNormalizedKey = (artist: string, title: string) => `${normalizeText(artist).replace(ARTICLES, '')}|${makeSortTitle(title)}`

export interface DuplicateCandidate {
  id: string
  title: string
  primaryArtist: string
  releaseYear?: number
  musicBrainzReleaseGroupId?: string
  discogsMasterId?: string
}
export type DuplicateMatch = { album: DuplicateCandidate; match: 'provider-id' | 'title-artist' }

/** Provider IDs first, then normalized artist/title as a suggestion. Never merges anything. */
export function classifyDuplicates(
  existing: DuplicateCandidate[],
  draft: { title: string; primaryArtist: string; musicBrainzReleaseGroupId?: string; discogsMasterId?: string },
): DuplicateMatch[] {
  const key = makeNormalizedKey(draft.primaryArtist, draft.title)
  const seen = new Set<string>()
  const out: DuplicateMatch[] = []
  for (const a of existing) {
    if ((draft.musicBrainzReleaseGroupId && a.musicBrainzReleaseGroupId === draft.musicBrainzReleaseGroupId) || (draft.discogsMasterId && a.discogsMasterId === draft.discogsMasterId)) {
      out.push({ album: a, match: 'provider-id' }); seen.add(a.id)
    }
  }
  for (const a of existing) {
    if (!seen.has(a.id) && makeNormalizedKey(a.primaryArtist, a.title) === key) out.push({ album: a, match: 'title-artist' })
  }
  return out
}

/** Thumbnail variant for Cover Art Archive URLs; leaves other URLs untouched. */
export function thumbUrl(url: string | undefined, size: 250 | 500 = 250): string | undefined {
  if (!url) return undefined
  return url.replace(/\/front(-\d+)?$/, `/front-${size}`)
}
