import { useCallback, useEffect, useRef, useState } from 'react'
import { getDocs, limit, orderBy, query, startAfter, where, type DocumentSnapshot, type QueryConstraint } from 'firebase/firestore'
import { getFirebase } from '../firebase/config'
import { userCol } from '../firebase/paths'
import { snapToAlbum, type StoredAlbum } from './albumsRepo'

export type AlbumSort = 'title' | 'recent'
const PAGE = 48

/** Paged read of owned, non-archived albums. Never loads the whole collection unless asked. */
export function useOwnedAlbums(uid: string, sort: AlbumSort) {
  const [items, setItems] = useState<StoredAlbum[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const cursor = useRef<DocumentSnapshot | null>(null)
  const busy = useRef(false)
  const gen = useRef(0)

  const fetchPage = useCallback(async (reset: boolean) => {
    if (busy.current) return
    busy.current = true
    const mine = reset ? ++gen.current : gen.current
    if (reset) { cursor.current = null; setItems([]) }
    setLoading(true); setError(null)
    try {
      const { db } = getFirebase()
      const order: QueryConstraint = sort === 'title' ? orderBy('sortTitle', 'asc') : orderBy('createdAt', 'desc')
      const snap = await getDocs(query(
        userCol(db, uid, 'albums'), where('owned', '==', true), where('archived', '==', false), order,
        ...(cursor.current ? [startAfter(cursor.current)] : []), limit(PAGE),
      ))
      if (mine !== gen.current) return
      cursor.current = snap.docs.at(-1) ?? cursor.current
      setHasMore(snap.size === PAGE)
      const page = snap.docs.map(snapToAlbum).filter((a): a is StoredAlbum => a !== null)
      setItems((prev) => (reset ? page : [...prev, ...page]))
    } catch (e) {
      if (mine === gen.current) setError(e instanceof Error ? e.message : 'Could not load your albums.')
    } finally {
      busy.current = false
      if (mine === gen.current) setLoading(false)
    }
  }, [uid, sort])

  // Deferred so state updates happen after the effect body, not synchronously inside it.
  useEffect(() => { void Promise.resolve().then(() => fetchPage(true)) }, [fetchPage])

  const loadMore = useCallback(() => fetchPage(false), [fetchPage])
  const reload = useCallback(() => fetchPage(true), [fetchPage])
  return { items, loading, error, hasMore, loadMore, reload }
}
