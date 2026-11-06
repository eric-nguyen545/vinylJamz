import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dices, Disc3, Headphones, Plus, Speaker } from 'lucide-react'
import { useAuth } from '../app/AuthContext'
import { AlbumArtwork } from '../components/AlbumArtwork'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { getFirebase } from '../firebase/config'
import { formatDay } from '../lib/format'
import { randomOwnedAlbum, useDashboard } from '../lib/useDashboard'
import { usePreferences } from '../lib/usePreferences'
import type { StoredAlbum } from '../lib/albumsRepo'

const money = (n: number, c: string) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n) } catch { return `${n} ${c}` } }

function Stat({ label, value, sub, to }: { label: string; value: string | number; sub?: string; to?: string }) {
  const body = (
    <>
      <dt className="text-sm text-dust">{label}</dt>
      <dd className="mt-1 font-display text-4xl font-bold">{value}</dd>
      {sub && <dd className="text-xs text-dust">{sub}</dd>}
    </>
  )
  return to
    ? <Link to={to} className="block rounded-2xl bg-sleeve p-5 transition hover:bg-sleeve-hi">{body}</Link>
    : <div className="rounded-2xl bg-sleeve p-5">{body}</div>
}

export function DashboardPage() {
  const { state } = useAuth()
  if (state.status !== 'owner') return null
  return <DashboardBody uid={state.user.uid} />
}

function greeting(h = new Date().getHours()) { return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }

function DashboardBody({ uid }: { uid: string }) {
  const prefs = usePreferences(uid)
  const { data, error, retry } = useDashboard(uid, prefs.defaultCurrency)
  const [pick, setPick] = useState<StoredAlbum | null | undefined>(undefined)
  const [rolling, setRolling] = useState(false)

  const roll = async () => {
    setRolling(true)
    try { setPick(await randomOwnedAlbum(getFirebase().db, uid)) } catch { setPick(null) } finally { setRolling(false) }
  }
  const total = data?.counts.albums
  useEffect(() => { if (total && total > 0) void Promise.resolve().then(roll) }, [total]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHeader title={greeting()} description="Here’s where your collection stands." actions={
        <div className="flex flex-wrap gap-2 text-sm">
          <Link to="/collection/add" className="inline-flex items-center gap-2 rounded-lg bg-label px-4 py-2 font-semibold text-label-ink"><Plus aria-hidden className="size-4" /> Add album</Link>
          <Link to="/journal" className="inline-flex items-center gap-2 rounded-lg bg-sleeve-hi px-4 py-2 font-medium hover:bg-groove"><Headphones aria-hidden className="size-4" /> Log a listen</Link>
          <Link to="/gear" className="inline-flex items-center gap-2 rounded-lg bg-sleeve-hi px-4 py-2 font-medium hover:bg-groove"><Speaker aria-hidden className="size-4" /> Add gear</Link>
        </div>
      } />
      {error && <ErrorState title="Couldn’t load your dashboard" message={error} onRetry={retry} />}
      {!error && !data && <LoadingState label="Loading your collection" />}

      {data && (
        <>
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Albums" value={data.counts.albums} to="/collection" />
            <Stat label="Physical copies" value={data.counts.copies} />
            <Stat label="On your wantlist" value={data.counts.wantlist} to="/wantlist" />
            <Stat label="Listens this month" value={data.counts.listensThisMonth} to="/journal" />
          </dl>

          {data.money
            ? (
              <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Stat label="Spent on records" value={money(data.money.records, data.money.currency)} to="/statistics" />
                <Stat label="Spent on gear" value={money(data.money.gear, data.money.currency)} to="/gear" />
                <Stat label="Total invested" value={money(data.money.records + data.money.gear, data.money.currency)} sub={`In ${data.money.currency}`} to="/statistics" />
              </dl>
            )
            : data.counts.copies > 0 && <p className="mt-4 text-sm text-dust">Spending totals need the latest Firestore indexes. Run <code>npx firebase deploy --only firestore:indexes</code>, then reload.</p>}

          {data.counts.albums === 0
            ? <div className="mt-8"><EmptyState title="Your shelf is empty" action={<Link to="/collection/add" className="rounded-lg bg-label px-4 py-2 font-semibold text-label-ink">Add your first album</Link>}>Spending, ratings and listening history will appear here once you have records to measure.</EmptyState></div>
            : (
              <div className="mt-8 grid gap-6 lg:grid-cols-2">
                <section aria-labelledby="pick-h" className="overflow-hidden rounded-2xl bg-sleeve">
                  <div className="flex items-center justify-between gap-3 p-5 pb-0">
                    <h2 id="pick-h" className="text-xl font-medium">Tonight’s pick</h2>
                    <button onClick={() => void roll()} disabled={rolling} className="inline-flex items-center gap-2 rounded-lg bg-sleeve-hi px-3 py-1.5 text-sm font-medium hover:bg-groove disabled:opacity-50"><Dices aria-hidden className="size-4" /> {rolling ? 'Rolling…' : 'Pick another'}</button>
                  </div>
                  {pick
                    ? (
                      <div className="flex gap-5 p-5">
                        <Link to={`/collection/${pick.id}`} className="w-36 shrink-0 sm:w-44"><AlbumArtwork url={pick.artworkUrl} title={pick.title} artist={pick.primaryArtist} size={500} className="rounded-md ring-1 ring-groove" /></Link>
                        <div className="min-w-0 self-center">
                          <Link to={`/collection/${pick.id}`} className="font-display text-2xl font-bold underline-offset-4 hover:underline">{pick.title}</Link>
                          <p className="text-dust">{pick.artistNames.join(', ')}{pick.releaseYear ? `, ${pick.releaseYear}` : ''}</p>
                          {pick.genres.length > 0 && <p className="mt-1 text-sm text-dust">{pick.genres.slice(0, 3).join(', ')}</p>}
                        </div>
                      </div>
                    )
                    : <p className="p-5 text-dust">{pick === undefined ? 'Choosing something for you…' : 'Nothing to pick yet.'}</p>}
                </section>

                <section aria-labelledby="listens-h" className="rounded-2xl bg-sleeve p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 id="listens-h" className="text-xl font-medium">Recently played</h2>
                    <Link to="/journal" className="text-sm text-label underline underline-offset-4">Open journal</Link>
                  </div>
                  {data.sessions.length === 0
                    ? <p className="mt-4 text-dust">No listens logged yet. Log one from any album page or the journal.</p>
                    : <ul className="mt-3 divide-y divide-groove">{data.sessions.map((s) => (
                        <li key={s.id} className="flex items-center gap-3 py-2">
                          <AlbumArtwork url={s.artworkUrl} title={s.albumTitle ?? 'Album'} artist={s.primaryArtist ?? ''} className="w-10 shrink-0 rounded" />
                          <div className="min-w-0 flex-1"><Link to={`/collection/${s.albumId}`} className="block truncate font-medium underline-offset-4 hover:underline">{s.albumTitle ?? 'Album'}</Link><p className="truncate text-sm text-dust">{s.primaryArtist}</p></div>
                          <span className="shrink-0 text-sm text-dust">{formatDay(s.date)}</span>
                        </li>
                      ))}</ul>}
                </section>
              </div>
            )}

          {data.recent.length > 0 && (
            <section aria-labelledby="recent-h" className="mt-8">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="recent-h" className="flex items-center gap-2 text-xl font-medium"><Disc3 aria-hidden className="size-5 text-label" /> Recently added</h2>
                <Link to="/collection" className="text-sm text-label underline underline-offset-4">See everything</Link>
              </div>
              <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
                {data.recent.map((a) => (
                  <li key={a.id}><Link to={`/collection/${a.id}`} className="group block"><AlbumArtwork url={a.artworkUrl} title={a.title} artist={a.primaryArtist} className="rounded-md ring-1 ring-groove transition group-hover:ring-label" /><span className="mt-1 block truncate text-xs text-dust">{a.title}</span></Link></li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  )
}
