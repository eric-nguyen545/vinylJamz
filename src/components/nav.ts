import { BarChart3, BookHeart, Disc3, Download, Heart, LayoutDashboard, Map, Settings, ShieldCheck, Speaker, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** false = route not built yet; shown disabled and labelled, never as a dead link. */
  available: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, available: true },
  { to: '/collection', label: 'My Collection', icon: Disc3, available: true },
  { to: '/wantlist', label: 'Wantlist', icon: Heart, available: true },
  { to: '/map', label: 'Map Explorer', icon: Map, available: true },
  { to: '/journal', label: 'Music Journal', icon: BookHeart, available: true },
  { to: '/gear', label: 'Gear', icon: Speaker, available: true },
  { to: '/statistics', label: 'Statistics', icon: BarChart3, available: true },
  { to: '/admin', label: 'Admin', icon: ShieldCheck, available: true },
  { to: '/data', label: 'Backup and Export', icon: Download, available: true },
  { to: '/settings', label: 'Settings', icon: Settings, available: true },
]
