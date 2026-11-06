import type { ListeningSessionInput } from './schemas'

type S = Pick<ListeningSessionInput, 'albumId' | 'date' | 'vibeTags' | 'notes' | 'locationText' | 'albumTitle' | 'primaryArtist'>

/** Groups by YYYY-MM, newest month first, newest day first inside each month. */
export function groupByMonth<T extends Pick<S, 'date'>>(sessions: T[]): { key: string; sessions: T[] }[] {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
  const out: { key: string; sessions: T[] }[] = []
  for (const s of sorted) {
    const key = s.date.slice(0, 7)
    const last = out.at(-1)
    if (last?.key === key) last.sessions.push(s)
    else out.push({ key, sessions: [s] })
  }
  return out
}

export function listenCounts(sessions: Pick<S, 'albumId' | 'albumTitle' | 'primaryArtist'>[], n = 5) {
  const m = new Map<string, { albumId: string; title: string; artist: string; count: number }>()
  for (const s of sessions) {
    const e = m.get(s.albumId) ?? { albumId: s.albumId, title: s.albumTitle ?? 'Album', artist: s.primaryArtist ?? '', count: 0 }
    e.count++
    m.set(s.albumId, e)
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title)).slice(0, n)
}

export function vibeCounts(sessions: Pick<S, 'vibeTags'>[]) {
  const m = new Map<string, number>()
  for (const s of sessions) for (const v of new Set(s.vibeTags)) m.set(v, (m.get(v) ?? 0) + 1)
  return [...m].map(([vibe, count]) => ({ vibe, count })).sort((a, b) => b.count - a.count || a.vibe.localeCompare(b.vibe))
}

export function thisMonthCount(sessions: Pick<S, 'date'>[], monthKey: string) {
  return sessions.filter((s) => s.date.startsWith(monthKey)).length
}

export interface JournalFilter { vibe?: string; q?: string; albumId?: string }

export function filterSessions<T extends S>(sessions: T[], f: JournalFilter): T[] {
  const q = f.q?.trim().toLowerCase()
  return sessions.filter((s) => {
    if (f.albumId && s.albumId !== f.albumId) return false
    if (f.vibe && !s.vibeTags.includes(f.vibe)) return false
    if (q && ![s.albumTitle, s.primaryArtist, s.notes, s.locationText].some((t) => t?.toLowerCase().includes(q))) return false
    return true
  })
}
