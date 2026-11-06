import { Suspense } from 'react'
import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom'
import { useAuth } from '../../app/AuthContext'
import { Brand } from '../../components/Sidebar'
import { LoadingState } from '../../components/States'
import { useDocumentTitle } from '../../lib/pageTitle'
import { usePublicSite, type PublicContext } from '../../lib/usePublicData'

export const usePublicContext = () => useOutletContext<PublicContext>()

const LINKS = [
  { section: 'collection', path: '', label: 'Collection' },
  { section: 'wantlist', path: '/wantlist', label: 'Wantlist' },
  { section: 'journal', path: '/journal', label: 'Listening journal' },
  { section: 'gear', path: '/gear', label: 'Gear' },
  { section: 'places', path: '/map', label: 'Map' },
  { section: 'stats', path: '/stats', label: 'Statistics' },
] as const

/** Read-only shell for visitors: no sign-in needed, nothing here can edit anything. */
export function PublicLayout() {
  const { shareId: param } = useParams()
  const state = usePublicSite(param)
  const { state: auth } = useAuth()
  const basePath = param ? `/public/${param}` : '/view'
  useDocumentTitle(state.status === 'ready' ? `${state.site.displayName} · Vinyl collection` : 'Vinyl collection')

  if (state.status === 'loading') return <div className="p-8"><LoadingState label="Loading collection" /></div>

  const signIn = auth.status === 'owner'
    ? <Link to="/" className="rounded-lg bg-label px-4 py-2 text-sm font-semibold text-label-ink">Open admin</Link>
    : <Link to="/login" className="rounded-lg bg-sleeve-hi px-4 py-2 text-sm font-medium hover:bg-groove">Owner sign in</Link>

  if (state.status === 'unavailable') {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <Brand />
        <h1 className="text-3xl font-bold">This collection is private</h1>
        <p className="text-dust">The link may be wrong, or the owner hasn’t made it public.</p>
        {signIn}
      </main>
    )
  }

  const { site, shareId } = state
  const ctx: PublicContext = { shareId, site, basePath }
  const links = LINKS.filter((l) => site.sections[l.section])
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-8">
      <div className="flex items-center justify-between gap-4"><Brand />{signIn}</div>
      <header className="mb-6 mt-10">
        <h1 className="text-4xl font-bold sm:text-5xl">{site.displayName}</h1>
        {site.bio && <p className="mt-2 max-w-xl text-dust">{site.bio}</p>}
      </header>
      {links.length > 1 && (
        <nav aria-label="Sections" className="mb-8 flex flex-wrap gap-2">
          {links.map((l) => (
            <NavLink key={l.section} to={`${basePath}${l.path}`} end className={({ isActive }) => `rounded-full px-4 py-1.5 text-sm font-medium ${isActive ? 'bg-label text-label-ink' : 'bg-sleeve hover:bg-sleeve-hi'}`}>{l.label}</NavLink>
          ))}
        </nav>
      )}
      <main><Suspense fallback={<LoadingState label="Loading" />}><Outlet context={ctx} /></Suspense></main>
      <footer className="mt-16 border-t border-groove pt-4 text-xs text-dust">
        <p>Read-only view. Only the owner can make changes.</p>
        <p className="mt-1">Metadata from <a href="https://www.discogs.com" target="_blank" rel="noreferrer" className="underline underline-offset-4">Discogs</a> and <a href="https://musicbrainz.org" target="_blank" rel="noreferrer" className="underline underline-offset-4">MusicBrainz</a>. Artwork from Cover Art Archive and Discogs. Not affiliated with either.</p>
      </footer>
    </div>
  )
}

export function SectionOff() {
  return <p className="rounded-2xl bg-sleeve p-6 text-dust">The owner hasn’t shared this section.</p>
}
