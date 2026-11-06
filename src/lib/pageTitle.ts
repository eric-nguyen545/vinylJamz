import { useEffect } from 'react'
import { NAV_ITEMS } from '../components/nav'

const APP = 'Vinyl Archive'

/** Human title for a route, used for the tab title and so screen readers hear where they are. */
export function pageTitle(pathname: string): string {
  if (pathname === '/') return `Dashboard · ${APP}`
  if (pathname === '/collection/add') return `Add album · ${APP}`
  if (/^\/collection\/[^/]+/.test(pathname)) return `Album · ${APP}`
  const hit = NAV_ITEMS.filter((n) => n.to !== '/').find((n) => pathname === n.to || pathname.startsWith(`${n.to}/`))
  return hit ? `${hit.label} · ${APP}` : APP
}

export function useDocumentTitle(title: string): void {
  useEffect(() => { document.title = title }, [title])
}
