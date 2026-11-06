import { useState } from 'react'
import type { AlbumFormState, FormErrors } from '../lib/formState'
import { COVER_ART, musicBrainz } from '../lib/providers/musicbrainz'
import { Field, inputClass } from './Field'

interface Props { value: AlbumFormState; errors: FormErrors; onChange: (v: AlbumFormState) => void }

export function AlbumMetadataForm({ value, errors, onChange }: Props) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  /** Backup artwork: find the album on MusicBrainz and use its Cover Art Archive front cover. */
  async function findCoverArt() {
    setBusy(true); setNote(null)
    try {
      const hits = await musicBrainz.searchAlbums(`${value.artists.split(',')[0] ?? ''} ${value.title}`.trim(), 'text')
      const g = hits.find((h) => h.kind === 'release-group') ?? hits[0]
      if (!g) { setNote('No cover art found on MusicBrainz.'); return }
      onChange({ ...value, artworkUrl: `${COVER_ART}/${g.kind === 'release' ? 'release' : 'release-group'}/${g.id}/front-500` })
      setNote('Used the Cover Art Archive cover. If the preview stays blank, that album has no art there.')
    } catch { setNote('Could not reach MusicBrainz.') } finally { setBusy(false) }
  }
  const set = (k: keyof AlbumFormState) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value })
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Album title" error={errors.title} className="sm:col-span-2">
        <input className={inputClass} value={value.title} onChange={set('title')} required />
      </Field>
      <Field label="Artists" hint="Separate several with commas." error={errors.artists}>
        <input className={inputClass} value={value.artists} onChange={set('artists')} required />
      </Field>
      <Field label="Release year" error={errors.releaseYear}>
        <input className={inputClass} inputMode="numeric" value={value.year} onChange={set('year')} />
      </Field>
      <Field label="Genres" hint="Separate with commas." error={errors.genres}>
        <input className={inputClass} value={value.genres} onChange={set('genres')} />
      </Field>
      <Field label="Labels" hint="Separate with commas." error={errors.labelNames}>
        <input className={inputClass} value={value.labels} onChange={set('labels')} />
      </Field>
      <Field label="Artwork URL" hint="Optional. Link to an image, or leave blank." error={errors.artworkUrl} className="sm:col-span-2">
        <input className={inputClass} type="url" value={value.artworkUrl} onChange={set('artworkUrl')} />
      </Field>
      <div className="sm:col-span-2 -mt-2">
        <button type="button" disabled={busy || !value.title.trim()} onClick={() => void findCoverArt()} className="rounded-lg bg-sleeve-hi px-3 py-1.5 text-sm font-medium hover:bg-groove disabled:opacity-50">{busy ? 'Looking…' : 'Try Cover Art Archive'}</button>
        {note && <p role="status" className="mt-1 text-xs text-dust">{note}</p>}
      </div>
    </div>
  )
}
