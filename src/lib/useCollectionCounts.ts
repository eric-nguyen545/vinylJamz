import { useCallback, useEffect, useState } from 'react'
import { getCountFromServer, query, where } from 'firebase/firestore'
import { getFirebase } from '../firebase/config'
import { userCol } from '../firebase/paths'
import { ACTIVE_WANT_STATUSES } from './schemas'

export interface Counts { albums: number; copies: number; wantlist: number }

/** Uses server-side count aggregation so the dashboard never reads whole collections. */
export function useCollectionCounts(uid: string) {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    const { db } = getFirebase()
    Promise.all([
      getCountFromServer(query(userCol(db, uid, 'albums'), where('owned', '==', true), where('archived', '==', false))),
      getCountFromServer(userCol(db, uid, 'copies')),
      getCountFromServer(query(userCol(db, uid, 'wantlist'), where('status', 'in', ACTIVE_WANT_STATUSES))),
    ])
      .then(([a, c, w]) => { if (!cancelled) { setError(null); setCounts({ albums: a.data().count, copies: c.data().count, wantlist: w.data().count }) } })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your collection.') })
    return () => { cancelled = true }
  }, [uid, nonce])

  const retry = useCallback(() => { setCounts(null); setError(null); setNonce((n) => n + 1) }, [])
  return { counts, error, retry }
}
