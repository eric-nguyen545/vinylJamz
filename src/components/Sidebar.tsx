import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NAV_ITEMS } from './nav'

const KEY = 'vinyl-archive:sidebar-collapsed'

/** Remembers the collapsed state on this device. Storage can be unavailable (private mode), so failures are ignored. */
export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(KEY) === '1' } catch { return false } })
  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(KEY, next ? '1' : '0') } catch { /* not persisted */ }
  }
  return [collapsed, toggle]
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <svg aria-hidden viewBox="0 0 32 32" className="size-8 shrink-0">
        <circle cx="16" cy="16" r="15" fill="#242734" />
        <circle cx="16" cy="16" r="11" fill="none" stroke="#3a3d4d" />
        <circle cx="16" cy="16" r="5.5" fill="#e3b04b" />
        <circle cx="16" cy="16" r="1.5" fill="#14151b" />
      </svg>
      <span className={compact ? 'sr-only' : 'font-display text-xl font-bold'}>Vinyl Archive</span>
    </div>
  )
}

export function Sidebar() {
  const [collapsed, toggle] = useSidebarCollapsed()
  return (
    <aside className={`hidden shrink-0 flex-col gap-8 border-r border-groove bg-sleeve py-6 transition-[width] duration-200 motion-reduce:transition-none md:flex ${collapsed ? 'w-[4.5rem] items-center px-2' : 'w-64 px-4'}`}>
      <Brand compact={collapsed} />
      <nav aria-label="Primary" className="flex w-full flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, available }) =>
          available ? (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center rounded-lg py-2 text-sm font-medium ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'} ${isActive ? 'bg-label text-label-ink' : 'text-paper hover:bg-sleeve-hi'}`
              }
            >
              <Icon aria-hidden className="size-5 shrink-0" />
              <span className={collapsed ? 'sr-only' : ''}>{label}</span>
            </NavLink>
          ) : (
            <span key={to} aria-disabled="true" className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-dust">
              <Icon aria-hidden className="size-5" />
              {label}
              <span className="ml-auto rounded bg-groove px-1.5 py-0.5 text-xs text-dust">Soon</span>
            </span>
          ),
        )}
      </nav>
      <button onClick={toggle} aria-expanded={!collapsed} title={collapsed ? 'Expand sidebar' : undefined}
        className={`flex items-center rounded-lg py-2 text-sm text-dust hover:bg-sleeve-hi hover:text-paper ${collapsed ? 'justify-center px-0' : 'gap-3 px-3'}`}>
        {collapsed ? <PanelLeftOpen aria-hidden className="size-5" /> : <PanelLeftClose aria-hidden className="size-5" />}
        <span className={collapsed ? 'sr-only' : ''}>{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
      </button>
    </aside>
  )
}
