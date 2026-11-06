import { describe, expect, it } from 'vitest'
import { filterSessions, groupByMonth, listenCounts, thisMonthCount, vibeCounts } from './journal'

const s = (albumId: string, date: string, extra: object = {}) => ({ albumId, date, vibeTags: [] as string[], albumTitle: albumId.toUpperCase(), primaryArtist: 'X', ...extra })
const sessions = [
  s('a', '2026-03-04', { vibeTags: ['late night'], notes: 'Great on vinyl', locationText: 'Home' }),
  s('b', '2026-03-20', { vibeTags: ['driving', 'late night'] }),
  s('a', '2026-02-11'),
  s('a', '2026-03-05'),
]

describe('journal', () => {
  it('groups by month, newest first', () => {
    const g = groupByMonth(sessions)
    expect(g.map((x) => x.key)).toEqual(['2026-03', '2026-02'])
    expect(g[0]!.sessions.map((x) => x.date)).toEqual(['2026-03-20', '2026-03-05', '2026-03-04'])
  })
  it('counts listens per album and vibes per session', () => {
    expect(listenCounts(sessions)[0]).toMatchObject({ albumId: 'a', count: 3, title: 'A' })
    expect(vibeCounts(sessions)[0]).toEqual({ vibe: 'late night', count: 2 })
  })
  it('counts this month', () => { expect(thisMonthCount(sessions, '2026-03')).toBe(3) })
  it('filters by album, vibe and text', () => {
    expect(filterSessions(sessions, { albumId: 'b' })).toHaveLength(1)
    expect(filterSessions(sessions, { vibe: 'late night' })).toHaveLength(2)
    expect(filterSessions(sessions, { q: 'vinyl' })).toHaveLength(1)
    expect(filterSessions(sessions, { q: 'home' })).toHaveLength(1)
    expect(filterSessions(sessions, {})).toHaveLength(4)
  })
})
