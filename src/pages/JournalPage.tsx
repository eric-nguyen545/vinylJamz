import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '../app/AuthContext'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { inputClass } from '../components/Field'
import { PageHeader } from '../components/PageHeader'
import { SessionCard } from '../components/SessionCard'
import { SessionEditor } from '../components/SessionEditor'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { getFirebase } from '../firebase/config'
import type { StoredAlbum } from '../lib/albumsRepo'
import { monthLabel, todayLocal } from '../lib/format'
import { filterSessions, groupByMonth, listenCounts, thisMonthCount, vibeCounts } from '../lib/journal'
import { listOwnedAlbums } from '../lib/publicRepo'
import { deleteSession, listSessions, type StoredSession } from '../lib/sessionsRepo'

export function JournalPage() {
  const { state } = useAuth()
  if (state.status !== 'owner') return null
  return <JournalBody uid={state.user.uid} />
}

function JournalBody({ uid }: { uid: string }) {
  const { db } = getFirebase()
  const [params, setParams] = useSearchParams()
  const albumFilter = params.get('album') ?? undefined
  const [sessions, setSessions] = useState<StoredSession[] | null>(null)
  const [albums, setAlbums] = useState<StoredAlbum[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<'new' | StoredSession | null>(null)
  const [confirm, setConfirm] = useState<StoredSession | null>(null)
  const [busy, setBusy] = useState(false)
  const [vibe, setVibe] = useState('')
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const [s, a] = await Promise.all([listSessions(db, uid), listOwnedAlbums(db, uid)])
      setSessions(s); setAlbums(a)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load your journal.') }
  }, [db, uid])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const shown = useMemo(() => filterSessions(sessions ?? [], { vibe: vibe || undefined, q, albumId: albumFilter }), [sessions, vibe, q, albumFilter])
  const groups = useMemo(() => groupByMonth(shown), [shown])
  const vibes = useMemo(() => vibeCounts(sessions ?? []), [sessions])
  const top = useMemo(() => listenCounts(sessions ?? [], 5), [sessions])
  const filteredAlbumTitle = albumFilter ? (sessions ?? []).find((s) => s.albumId === albumFilter)?.albumTitle : undefined

  async function remove() {
    if (!confirm) return
    setBusy(true)
    try { await deleteSession(db, uid, confirm.id); setConfirm(null); await load() } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete.') } finally { setBusy(false) }
  }

  const log = <button onClick={() => setEditing('new')} className="inline-flex items-center gap-2 rounded-lg bg-label px-4 py-2 font-semibold text-label-ink"><Plus aria-hidden className="size-4" /> Log a listen</button>

  return (
    <>
      <PageHeader title="Music Journal" description="A private log of what you’ve played, when, and how it felt." actions={log} />
      {error && <div className="mb-6"><ErrorState message={error} onRetry={() => void load()} /></div>}
      {!error && !sessions && <LoadingState label="Loading your journal" />}

      {editing && (
        <div className="mb-8">
          <SessionEditor uid={uid} albums={albums} session={editing === 'new' ? undefined : editing} onSaved={async () => { setEditing(null); await load() }} onCancel={() => setEditing(null)} />
        </div>
      )}

      {sessions && sessions.length === 0 && !editing && (
        <EmptyState title="Nothing logged yet" action={log}>Log a listen to start your journal. You can also do it from any album page.</EmptyState>
      )}

      {sessions && sessions.length > 0 && (
        <>
          <dl className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl bg-sleeve p-5"><dt className="text-sm text-dust">Total listens</dt><dd className="mt-1 font-display text-3xl font-bold">{sessions.length}</dd></div>
            <div className="rounded-2xl bg-sleeve p-5"><dt className="text-sm text-dust">This month</dt><dd className="mt-1 font-display text-3xl font-bold">{thisMonthCount(sessions, todayLocal().slice(0, 7))}</dd></div>
            <div className="col-span-2 rounded-2xl bg-sleeve p-5 lg:col-span-1">
              <dt className="text-sm text-dust">Most played</dt>
              <dd><ol className="mt-1 text-sm">{top.map((t) => <li key={t.albumId} className="flex justify-between gap-3"><Link to={`/journal?album=${t.albumId}`} className="truncate underline-offset-4 hover:underline">{t.title}</Link><span className="text-dust">{t.count}</span></li>)}</ol></dd>
            </div>
          </dl>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <label className="min-w-56 flex-1"><span className="sr-only">Search the journal</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search albums, notes, places" className={inputClass} /></label>
            {vibes.length > 0 && (
              <label className="flex items-center gap-2 text-sm">Vibe
                <select value={vibe} onChange={(e) => setVibe(e.target.value)} className="rounded-lg border border-groove bg-sleeve px-3 py-2">
                  <option value="">All</option>{vibes.map((v) => <option key={v.vibe} value={v.vibe}>{v.vibe} ({v.count})</option>)}
                </select>
              </label>
            )}
            {albumFilter && <button onClick={() => setParams({})} className="rounded-lg bg-sleeve-hi px-3 py-2 text-sm font-medium hover:bg-groove">Showing {filteredAlbumTitle ?? 'one album'} · Clear</button>}
          </div>

          {shown.length === 0 && <p className="text-dust">No listens match these filters.</p>}
          <div className="flex flex-col gap-8">
            {groups.map((g) => (
              <section key={g.key} aria-label={monthLabel(g.key)}>
                <h2 className="mb-3 text-xl font-medium">{monthLabel(g.key)} <span className="text-base font-normal text-dust">({g.sessions.length})</span></h2>
                <ul className="flex flex-col gap-3">{g.sessions.map((s) => <SessionCard key={s.id} session={s} onEdit={() => setEditing(s)} onDelete={() => setConfirm(s)} />)}</ul>
              </section>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog open={confirm !== null} title="Delete this listen?" confirmLabel="Delete listen" destructive busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => void remove()}>
        This removes the log entry only. The album is unaffected.
      </ConfirmDialog>
    </>
  )
}
