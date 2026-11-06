import { useCallback, useEffect, useState } from 'react'
import {
  count, getAggregateFromServer, getCountFromServer, getDocs, limit, orderBy, query, startAt, sum, where, type Firestore,
} from 'firebase/firestore'
import { getFirebase } from '../firebase/config'
import { userCol } from '../firebase/paths'
import { snapToAlbum, type StoredAlbum } from './albumsRepo'
import { snapToSession, type StoredSession } from './sessionsRepo'
import { ACTIVE_WANT_STATUSES } from './schemas'

export interface DashboardMoney { currency: string; records: number; gear: number }
export interface DashboardData {
  counts: { albums: number; copies: number; wantlist: number; listensThisMonth: number }
  recent: StoredAlbum[]
  sessions: StoredSession[]
  /** null when the totals couldn't be read (usually the new indexes haven't been deployed yet). */
  money: DashboardMoney | null
}

/** First day of the month as YYYY-MM-DD, for "listens this month". */
export const monthStart = (d: Date = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'
/** A random place in the A-Z sort order to start a one-document read from. */
export const randomStart = (rng: () => number = Math.random) => LETTERS[Math.floor(rng() * LETTERS.length)] ?? 'a'

/** One cheap read: the first owned album at or after a random letter, wrapping to the start if none. */
export async function randomOwnedAlbum(db: Firestore, uid: string, rng: () => number = Math.random): Promise<StoredAlbum | null> {
  const base = [where('owned', '==', true), where('archived', '==', false), orderBy('sortTitle', 'asc')] as const
  const hit = await getDocs(query(userCol(db, uid, 'albums'), ...base, startAt(randomStart(rng)), limit(1)))
  const doc = hit.docs[0] ?? (await getDocs(query(userCol(db, uid, 'albums'), ...base, limit(1)))).docs[0]
  return doc ? snapToAlbum(doc) : null
}

async function readMoney(db: Firestore, uid: string, currency: string): Promise<DashboardMoney | null> {
  try {
    const agg = (name: 'copies' | 'gear') => getAggregateFromServer(query(userCol(db, uid, name), where('currency', '==', currency)), { total: sum('purchasePrice'), n: count() })
    const [r, g] = await Promise.all([agg('copies'), agg('gear')])
    return { currency, records: r.data().total ?? 0, gear: g.data().total ?? 0 }
  } catch { return null }
}

export function useDashboard(uid: string, currency: string) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { db } = getFirebase()
        const owned = [where('owned', '==', true), where('archived', '==', false)] as const
        const [albums, copies, wants, listens, recent, sessions, money] = await Promise.all([
          getCountFromServer(query(userCol(db, uid, 'albums'), ...owned)),
          getCountFromServer(userCol(db, uid, 'copies')),
          getCountFromServer(query(userCol(db, uid, 'wantlist'), where('status', 'in', ACTIVE_WANT_STATUSES))),
          getCountFromServer(query(userCol(db, uid, 'listeningSessions'), where('date', '>=', monthStart()))),
          getDocs(query(userCol(db, uid, 'albums'), ...owned, orderBy('createdAt', 'desc'), limit(8))),
          getDocs(query(userCol(db, uid, 'listeningSessions'), orderBy('date', 'desc'), limit(5))),
          readMoney(db, uid, currency),
        ])
        if (cancelled) return
        setData({
          counts: { albums: albums.data().count, copies: copies.data().count, wantlist: wants.data().count, listensThisMonth: listens.data().count },
          recent: recent.docs.map(snapToAlbum).filter((a): a is StoredAlbum => a !== null),
          sessions: sessions.docs.map(snapToSession).filter((s): s is StoredSession => s !== null),
          money,
        })
        setError(null)
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your dashboard.') }
    }
    void load()
    return () => { cancelled = true }
  }, [uid, currency, nonce])

  const retry = useCallback(() => { setData(null); setError(null); setNonce((n) => n + 1) }, [])
  return { data, error, retry }
}
