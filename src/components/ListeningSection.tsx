import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getFirebase } from '../firebase/config'
import type { StoredAlbum } from '../lib/albumsRepo'
import { formatDay } from '../lib/format'
import { deleteSession, listSessionsForAlbum, type StoredSession } from '../lib/sessionsRepo'
import { ConfirmDialog } from './ConfirmDialog'
import { SessionCard } from './SessionCard'
import { SessionEditor } from './SessionEditor'
import { ErrorState } from './States'

export function ListeningSection({ uid, album }: { uid: string; album: StoredAlbum }) {
  const { db } = getFirebase()
  const [sessions, setSessions] = useState<StoredSession[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<'new' | StoredSession | null>(null)
  const [confirm, setConfirm] = useState<StoredSession | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setSessions(await listSessionsForAlbum(db, uid, album.id)); setError(null) } catch (e) { setError(e instanceof Error ? e.message : 'Could not load listening history.') }
  }, [db, uid, album.id])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const ref = { id: album.id, title: album.title, primaryArtist: album.primaryArtist, artworkUrl: album.artworkUrl }
  const last = sessions?.[0]

  return (
    <section aria-labelledby="listen-h" className="mt-12">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="listen-h" className="text-2xl font-bold">Listening history</h2>
          {sessions && <p className="text-sm text-dust">{sessions.length === 0 ? 'No listens logged yet.' : `${sessions.length} ${sessions.length === 1 ? 'listen' : 'listens'}, last on ${formatDay(last!.date)}.`}</p>}
        </div>
        {!editing && <button onClick={() => setEditing('new')} className="rounded-lg bg-sleeve-hi px-4 py-2 font-medium hover:bg-groove">Log a listen</button>}
      </div>
      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {editing && <div className="mb-4"><SessionEditor uid={uid} fixedAlbum={ref} session={editing === 'new' ? undefined : editing} onSaved={async () => { setEditing(null); await load() }} onCancel={() => setEditing(null)} /></div>}
      {sessions && sessions.length > 0 && (
        <>
          <ul className="flex flex-col gap-3">{sessions.slice(0, 5).map((s) => <SessionCard key={s.id} session={s} showAlbum={false} onEdit={() => setEditing(s)} onDelete={() => setConfirm(s)} />)}</ul>
          {sessions.length > 5 && <Link to={`/journal?album=${album.id}`} className="mt-3 inline-block text-sm text-label underline underline-offset-4">See all {sessions.length} in the journal</Link>}
        </>
      )}
      <ConfirmDialog open={confirm !== null} title="Delete this listen?" confirmLabel="Delete listen" destructive busy={busy} onCancel={() => setConfirm(null)}
        onConfirm={() => { if (!confirm) return; setBusy(true); void deleteSession(db, uid, confirm.id).then(async () => { setConfirm(null); await load() }).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not delete.')).finally(() => setBusy(false)) }}>
        This removes the log entry only. The album is unaffected.
      </ConfirmDialog>
    </section>
  )
}
