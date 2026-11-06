import { listeningSessionInputSchema, dateString, type ListeningSessionInput } from './schemas'
import type { FormErrors, Result } from './formState'
import { todayLocal } from './format'

export interface SessionFormState { date: string; completedAlbum: boolean; locationText: string; vibeTags: string[]; notes: string }

export const emptySessionForm = (today = todayLocal()): SessionFormState => ({ date: today, completedAlbum: true, locationText: '', vibeTags: [], notes: '' })

export const sessionToForm = (s: Partial<ListeningSessionInput>): SessionFormState => ({
  date: s.date?.slice(0, 10) ?? todayLocal(), completedAlbum: s.completedAlbum ?? true,
  locationText: s.locationText ?? '', vibeTags: s.vibeTags ?? [], notes: s.notes ?? '',
})

export interface AlbumRef { id: string; title: string; primaryArtist: string; artworkUrl?: string }

export function formToSession(f: SessionFormState, album: AlbumRef | null, today = todayLocal()): Result<ListeningSessionInput> {
  const errors: FormErrors = {}
  if (!album) errors.album = 'Choose an album.'
  if (!dateString.safeParse(f.date).success) errors.date = 'Enter a valid date.'
  else if (f.date > today) errors.date = 'The date can’t be in the future.'
  if (Object.keys(errors).length || !album) return { ok: false, errors }
  const parsed = listeningSessionInputSchema.safeParse({
    albumId: album.id, date: f.date, completedAlbum: f.completedAlbum, locationText: f.locationText.trim() || undefined,
    vibeTags: f.vibeTags, notes: f.notes.trim() || undefined,
    albumTitle: album.title, primaryArtist: album.primaryArtist, artworkUrl: album.artworkUrl,
  })
  if (parsed.success) return { ok: true, value: parsed.data }
  for (const i of parsed.error.issues) errors[String(i.path[0] ?? 'form')] ??= i.message
  return { ok: false, errors }
}
