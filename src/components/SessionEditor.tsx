import { useState } from 'react'
import { getFirebase } from '../firebase/config'
import type { StoredAlbum } from '../lib/albumsRepo'
import type { FormErrors } from '../lib/formState'
import { emptySessionForm, formToSession, sessionToForm, type AlbumRef, type SessionFormState } from '../lib/sessionForm'
import { createSession, updateSession, type StoredSession } from '../lib/sessionsRepo'
import { normalizeText } from '../lib/normalize'
import { AlbumArtwork } from './AlbumArtwork'
import { Field, inputClass } from './Field'
import { ErrorState } from './States'

interface Props {
  uid: string
  /** Album fixed by context (album page); otherwise the picker is shown. */
  fixedAlbum?: AlbumRef
  albums?: StoredAlbum[]
  session?: StoredSession
  onSaved: () => void | Promise<void>
  onCancel: () => void
}

function AlbumPicker({ albums, value, onChange, error }: { albums: StoredAlbum[]; value: AlbumRef | null; onChange: (a: AlbumRef | null) => void; error?: string }) {
  const [q, setQ] = useState('')
  const needle = normalizeText(q)
  const matches = needle ? albums.filter((a) => normalizeText(`${a.title} ${a.artistNames.join(' ')}`).includes(needle)).slice(0, 8) : []
  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-sleeve p-3">
        <AlbumArtwork url={value.artworkUrl} title={value.title} artist={value.primaryArtist} className="w-12 shrink-0 rounded" />
        <div className="min-w-0 flex-1"><p className="truncate font-medium">{value.title}</p><p className="truncate text-sm text-dust">{value.primaryArtist}</p></div>
        <button type="button" onClick={() => onChange(null)} className="rounded-lg bg-sleeve-hi px-3 py-1.5 text-sm font-medium hover:bg-groove">Change</button>
      </div>
    )
  }
  return (
    <div>
      <Field label="Album" error={error}><input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your collection" /></Field>
      {needle && (matches.length === 0
        ? <p className="mt-2 text-sm text-dust">No albums match.</p>
        : <ul className="mt-2 divide-y divide-groove rounded-xl bg-sleeve">{matches.map((a) => (
            <li key={a.id}><button type="button" onClick={() => onChange({ id: a.id, title: a.title, primaryArtist: a.primaryArtist, artworkUrl: a.artworkUrl })} className="block w-full truncate px-4 py-2 text-left hover:bg-sleeve-hi">{a.title} <span className="text-dust">by {a.artistNames.join(', ')}</span></button></li>
          ))}</ul>)}
    </div>
  )
}

export function SessionEditor({ uid, fixedAlbum, albums = [], session, onSaved, onCancel }: Props) {
  const initialAlbum: AlbumRef | null = fixedAlbum ?? (session ? { id: session.albumId, title: session.albumTitle ?? 'Album', primaryArtist: session.primaryArtist ?? '', artworkUrl: session.artworkUrl } : null)
  const [album, setAlbum] = useState<AlbumRef | null>(initialAlbum)
  const [form, setForm] = useState<SessionFormState>(session ? sessionToForm(session) : emptySessionForm())
  const [errors, setErrors] = useState<FormErrors>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const r = formToSession(form, album)
    setErrors(r.ok ? {} : r.errors)
    if (!r.ok) return
    setBusy(true); setError(null)
    try {
      const { db } = getFirebase()
      if (session) await updateSession(db, uid, session.id, r.value)
      else await createSession(db, uid, r.value)
      await onSaved()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this listen.') } finally { setBusy(false) }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save() }} className="flex flex-col gap-4 rounded-2xl border border-groove p-5">
      <h3 className="text-xl font-medium">{session ? 'Edit listen' : 'Log a listen'}</h3>
      {error && <ErrorState message={error} />}
      {fixedAlbum ? null : <AlbumPicker albums={albums} value={album} onChange={setAlbum} error={errors.album} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" error={errors.date}><input className={inputClass} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="Where" hint="Optional. Home, the car, a friend’s place…" error={errors.locationText}><input className={inputClass} value={form.locationText} onChange={(e) => setForm({ ...form, locationText: e.target.value })} /></Field>
      </div>
      <label className="flex items-center gap-3 text-sm font-medium">
        <input type="checkbox" checked={form.completedAlbum} onChange={(e) => setForm({ ...form, completedAlbum: e.target.checked })} className="size-5 accent-[var(--color-label)]" />
        Listened to the whole album
      </label>
      <Field label="Mood" hint="Optional. Describe the mood or anything else in your own words." error={errors.vibeTags}>
        <textarea className={inputClass} rows={2} maxLength={500} value={form.mood} onChange={(e) => setForm({ ...form, mood: e.target.value })} />
      </Field>
      <Field label="Notes" error={errors.notes}><textarea className={inputClass} rows={3} maxLength={5000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      <div className="flex gap-3">
        <button type="submit" disabled={busy} className="rounded-lg bg-label px-5 py-2 font-semibold text-label-ink disabled:opacity-50">{busy ? 'Saving…' : 'Save listen'}</button>
        <button type="button" onClick={onCancel} className="rounded-lg bg-sleeve-hi px-5 py-2 font-medium hover:bg-groove">Cancel</button>
      </div>
    </form>
  )
}
