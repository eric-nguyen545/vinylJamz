import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Ellipsis } from 'lucide-react'
import { NAV_ITEMS } from './nav'

/** The bottom bar holds the everyday pages; everything else lives under "More". */
const PRIMARY = ['/', '/collection', '/wantlist', '/journal']

export function MobileNavigation() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const items = NAV_ITEMS.filter((n) => n.available)
  const primary = items.filter((n) => PRIMARY.includes(n.to))
  const more = items.filter((n) => !PRIMARY.includes(n.to))
  const moreActive = more.some((n) => pathname.startsWith(n.to))

  return (
    <nav aria-label="Primary" onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }} className="fixed inset-x-0 bottom-0 z-20 border-t border-groove bg-sleeve pb-[env(safe-area-inset-bottom)] md:hidden">
      {open && (
        <>
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 -z-10 cursor-default" />
          <ul id="more-menu" className="absolute bottom-full right-2 mb-2 w-60 rounded-2xl border border-groove bg-sleeve p-2 shadow-xl">
            {more.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink to={to} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium ${isActive ? 'bg-label text-label-ink' : 'hover:bg-sleeve-hi'}`}>
                  <Icon aria-hidden className="size-4" />{label}
                </NavLink>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex justify-around">
        {primary.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
            className={({ isActive }) => `flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs ${isActive ? 'text-label' : 'text-dust'}`}>
            <Icon aria-hidden className="size-5" />{label}
          </NavLink>
        ))}
        <button aria-expanded={open} aria-controls="more-menu" onClick={() => setOpen((o) => !o)}
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs ${open || moreActive ? 'text-label' : 'text-dust'}`}>
          <Ellipsis aria-hidden className="size-5" />More
        </button>
      </div>
    </nav>
  )
}
