import { Suspense, useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Brand, Sidebar } from './Sidebar'
import { MobileNavigation } from './MobileNavigation'
import { OfflineBanner } from './OfflineBanner'
import { LoadingState } from './States'
import { pageTitle } from '../lib/pageTitle'

export function AppShell() {
  const { pathname } = useLocation()
  const first = useRef(true)

  // On every page change: update the tab title and move focus to the content, so keyboard and
  // screen reader users land at the top of the new page instead of staying on the old link.
  useEffect(() => {
    document.title = pageTitle(pathname)
    if (first.current) { first.current = false; return }
    document.getElementById('main')?.focus()
  }, [pathname])

  return (
    <div className="flex min-h-screen">
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }} className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-label focus:px-3 focus:py-2 focus:text-label-ink">
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <div className="border-b border-groove bg-sleeve px-4 py-3 md:hidden"><Brand /></div>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-8 outline-none sm:px-8 md:pb-10">
          <Suspense fallback={<LoadingState label="Loading page" />}><Outlet /></Suspense>
        </main>
      </div>
      <MobileNavigation />
    </div>
  )
}
