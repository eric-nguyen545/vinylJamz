import { useEffect, useState } from 'react'
import { getDoc, getDocs, limit, query } from 'firebase/firestore'
import type { z } from 'zod'
import { getFirebase, isFirebaseConfigured } from '../firebase/config'
import { publicCollectionDoc, publicSiteDoc, publicSubCol, type PublicSub } from '../firebase/paths'
import { publicSectionsSchema, type PublicSections } from './schemas'

export interface PublicSite { displayName: string; bio?: string; sections: PublicSections }
export interface PublicContext { shareId: string; site: PublicSite; basePath: string }
export type PublicSiteState = { status: 'loading' } | { status: 'unavailable' } | { status: 'ready'; shareId: string; site: PublicSite }

const SHARE_ID = /^[0-9a-f]{32}$/

/**
 * Finds what an anonymous visitor may see. With no share ID (the public website at #/view) it follows the
 * pointer document; with one (an unlisted link) it uses that directly. Missing, disabled and
 * permission-denied all look the same to a visitor.
 */
export function usePublicSite(shareParam?: string): PublicSiteState {
  const [state, setState] = useState<PublicSiteState>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    async function run() {
      const fail = () => { if (!cancelled) setState({ status: 'unavailable' }) }
      if (!isFirebaseConfigured) return fail()
      try {
        const { db } = getFirebase()
        let shareId = shareParam
        if (!shareId) {
          const pointer = await getDoc(publicSiteDoc(db))
          const id = pointer.data()?.shareId
          if (!pointer.exists() || pointer.data()?.enabled !== true || typeof id !== 'string') return fail()
          shareId = id
        }
        if (!SHARE_ID.test(shareId)) return fail()
        const parent = await getDoc(publicCollectionDoc(db, shareId))
        const d = parent.data()
        if (!parent.exists() || d?.enabled !== true) return fail()
        const sections = publicSectionsSchema.parse(d.sections ?? {})
        if (!cancelled) setState({ status: 'ready', shareId, site: { displayName: String(d.displayName ?? 'Vinyl collection'), bio: typeof d.bio === 'string' ? d.bio : undefined, sections } })
      } catch { fail() }
    }
    void run()
    return () => { cancelled = true }
  }, [shareParam])
  return state
}

/** Reads one public collection and parses each document; documents that don't fit the schema are skipped. */
export function usePublicList<S extends z.ZodType>(shareId: string, name: PublicSub, schema: S) {
  const [result, setResult] = useState<{ items: (z.infer<S> & { id: string })[] | null; error: string | null }>({ items: null, error: null })
  useEffect(() => {
    let cancelled = false
    getDocs(query(publicSubCol(getFirebase().db, shareId, name), limit(2000)))
      .then((snap) => {
        const items: (z.infer<S> & { id: string })[] = []
        for (const d of snap.docs) { const p = schema.safeParse(d.data()); if (p.success) items.push({ ...(p.data as object), id: d.id } as z.infer<S> & { id: string }) }
        if (!cancelled) setResult({ items, error: null })
      })
      .catch(() => { if (!cancelled) setResult({ items: null, error: 'This section couldn’t be loaded. It may not be shared.' }) })
    return () => { cancelled = true }
  }, [shareId, name, schema])
  return result
}
