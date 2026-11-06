import {
  deleteDoc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where, writeBatch, type Firestore,
} from 'firebase/firestore'
import { PUBLIC_SUBS, publicCollectionDoc, publicSiteDoc, publicSubCol, publicSubDoc, sharingDoc, userCol, type PublicSub } from '../firebase/paths'
import { buildPublicAlbum, buildPublicGear, buildPublicListen, buildPublicPlace, buildPublicWant } from './publicProjection'
import { snapToAlbum, snapToCopy, type StoredAlbum } from './albumsRepo'
import type { StoredGear } from './gearRepo'
import type { StoredLocation } from './locationsRepo'
import { snapToReview } from './reviewsRepo'
import { listSessions } from './sessionsRepo'
import { sharingSettingsSchema, type CopyInput, type ReviewInput, type SharingSettings } from './schemas'
import type { StoredWant } from './wantlistRepo'

export async function loadSharing(db: Firestore, uid: string): Promise<SharingSettings | null> {
  const snap = await getDoc(sharingDoc(db, uid))
  if (!snap.exists()) return null
  const p = sharingSettingsSchema.safeParse(snap.data())
  return p.success ? p.data : null
}

export const saveSharing = (db: Firestore, uid: string, s: SharingSettings) =>
  setDoc(sharingDoc(db, uid), sharingSettingsSchema.parse(s))

export async function listOwnedAlbums(db: Firestore, uid: string): Promise<StoredAlbum[]> {
  const snap = await getDocs(query(userCol(db, uid, 'albums'), where('owned', '==', true), where('archived', '==', false), orderBy('sortTitle', 'asc'), limit(2000)))
  return snap.docs.map(snapToAlbum).filter((a): a is StoredAlbum => a !== null)
}

export type PublishedIds = Record<PublicSub, string[]>

export async function listPublishedIds(db: Firestore, shareId: string): Promise<PublishedIds> {
  const entries = await Promise.all(PUBLIC_SUBS.map(async (name) => [name, (await getDocs(publicSubCol(db, shareId, name))).docs.map((d) => d.id)] as const))
  return Object.fromEntries(entries) as PublishedIds
}

/** What a sync must write and delete. Pure, so it can be unit-tested. */
export function planSync(selectedIds: string[], existingIds: string[], knownIds: string[]) {
  const known = new Set(knownIds)
  const toSet = [...new Set(selectedIds)].filter((id) => known.has(id))
  const keep = new Set(toSet)
  const toDelete = existingIds.filter((id) => !keep.has(id))
  return { toSet, toDelete }
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Whether a section's data should exist publicly at all, given the mode and its switch. */
export const sectionLive = (s: Pick<SharingSettings, 'mode' | 'sections'>, section: keyof SharingSettings['sections']) => s.mode !== 'off' && s.sections[section]

/**
 * Writes the parent document (visibility + section switches) and the pointer that lets anonymous
 * visitors find the public website. The pointer only reveals the share ID in "public" mode.
 */
export async function setSiteMode(db: Firestore, s: SharingSettings): Promise<void> {
  await setDoc(publicCollectionDoc(db, s.shareId), {
    enabled: s.mode !== 'off', displayName: s.displayName, ...(s.bio ? { bio: s.bio } : {}), sections: s.sections, updatedAt: serverTimestamp(),
  })
  await setDoc(publicSiteDoc(db), { enabled: s.mode === 'public', shareId: s.mode === 'public' ? s.shareId : '', updatedAt: serverTimestamp() })
}

export interface OwnerData { albums: StoredAlbum[]; wantlist: StoredWant[]; gear: StoredGear[]; locations: StoredLocation[] }
export interface Selection { albums: string[]; wantlist: string[]; gear: string[]; places: string[] }
export type PublishResult = Record<PublicSub, { published: number; removed: number }>

async function syncSub(db: Firestore, shareId: string, name: PublicSub, desired: Map<string, Record<string, unknown>>, existing: string[]) {
  const { toSet, toDelete } = planSync([...desired.keys()], existing, [...desired.keys()])
  for (const ids of chunk(toSet, 400)) {
    const batch = writeBatch(db)
    ids.forEach((id) => batch.set(publicSubDoc(db, shareId, name, id), { ...desired.get(id)!, publishedAt: serverTimestamp() }))
    await batch.commit()
  }
  for (const ids of chunk(toDelete, 400)) {
    const batch = writeBatch(db)
    ids.forEach((id) => batch.delete(publicSubDoc(db, shareId, name, id)))
    await batch.commit()
  }
  return { published: toSet.length, removed: toDelete.length }
}

/**
 * Rebuilds the sanitized public projection of everything the owner selected, and removes whatever is no
 * longer selected or whose section is switched off. Only allowlisted fields are copied by the builders.
 * Journal entries are only published for albums that are themselves published.
 */
export async function publishSite(db: Firestore, uid: string, s: SharingSettings, sel: Selection, data: OwnerData): Promise<PublishResult> {
  const o = s.fieldOptions
  const none = () => new Map<string, Record<string, unknown>>()
  const desired: Record<PublicSub, Map<string, Record<string, unknown>>> = { albums: none(), wantlist: none(), listens: none(), gear: none(), places: none() }

  if (s.mode !== 'off') {
    const albumIds = new Set(sel.albums)
    if (sectionLive(s, 'collection')) {
      const reviews = new Map<string, ReviewInput>()
      if (o.rating || o.review || o.vibes || o.topTracks) for (const d of (await getDocs(userCol(db, uid, 'reviews'))).docs) { const r = snapToReview(d); if (r) reviews.set(d.id, r) }
      const copies = new Map<string, CopyInput[]>()
      if (o.pressingSummary || o.money) for (const d of (await getDocs(userCol(db, uid, 'copies'))).docs) { const c = snapToCopy(d); if (c) copies.set(c.albumId, [...(copies.get(c.albumId) ?? []), c]) }
      for (const a of data.albums) if (albumIds.has(a.id)) desired.albums.set(a.id, { ...buildPublicAlbum(a, reviews.get(a.id), copies.get(a.id) ?? [], o) })
      if (sectionLive(s, 'journal')) {
        for (const x of await listSessions(db, uid)) if (albumIds.has(x.albumId)) desired.listens.set(x.id, { ...buildPublicListen(x, o) })
      }
    }
    if (sectionLive(s, 'wantlist')) for (const w of data.wantlist) if (sel.wantlist.includes(w.id)) desired.wantlist.set(w.id, { ...buildPublicWant(w, o) })
    if (sectionLive(s, 'gear')) for (const g of data.gear) if (sel.gear.includes(g.id)) desired.gear.set(g.id, { ...buildPublicGear(g, o) })
    if (sectionLive(s, 'places')) for (const l of data.locations) { const p = sel.places.includes(l.id) ? buildPublicPlace(l) : null; if (p) desired.places.set(l.id, { ...p }) }
  }

  const existing = s.mode === 'off' ? ({ albums: [], wantlist: [], listens: [], gear: [], places: [] } as PublishedIds) : await listPublishedIds(db, s.shareId)
  // Parent first so reads are allowed; data next; the pointer is written with the parent.
  await setSiteMode(db, s)
  const result = {} as PublishResult
  for (const name of PUBLIC_SUBS) result[name] = await syncSub(db, s.shareId, name, desired[name], existing[name])
  return result
}

/** Removes every published document for a share ID (used when creating a new link). */
export async function deletePublicData(db: Firestore, shareId: string): Promise<void> {
  const ids = await listPublishedIds(db, shareId)
  for (const name of PUBLIC_SUBS) {
    for (const part of chunk(ids[name], 400)) {
      const batch = writeBatch(db)
      part.forEach((id) => batch.delete(publicSubDoc(db, shareId, name, id)))
      await batch.commit()
    }
  }
  await deleteDoc(publicCollectionDoc(db, shareId))
}
