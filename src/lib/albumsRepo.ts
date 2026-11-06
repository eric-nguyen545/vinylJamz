import {
  doc, getDoc, getDocs, query, where, writeBatch, runTransaction, serverTimestamp, updateDoc,
  type DocumentSnapshot, type Firestore,
} from 'firebase/firestore'
import { userCol, userDoc } from '../firebase/paths'
import {
  albumInputSchema, copyInputSchema,
  type AlbumInput, type CopyInput, type Stored,
} from './schemas'
import { classifyDuplicates, makeNormalizedKey, type DuplicateMatch } from './normalize'

export class AlbumExistsError extends Error {
  albumId: string
  constructor(albumId: string) { super('This album is already in your collection.'); this.name = 'AlbumExistsError'; this.albumId = albumId }
}

/** Stable ID for provider-backed albums so repeat imports can't create duplicates. */
export const stableAlbumId = (a: { musicBrainzReleaseGroupId?: string; discogsMasterId?: string; discogsReleaseId?: string }) =>
  a.musicBrainzReleaseGroupId ? `mbrg_${a.musicBrainzReleaseGroupId}`
    : a.discogsMasterId ? `dcm_${a.discogsMasterId}`
    : a.discogsReleaseId ? `dcr_${a.discogsReleaseId}` : undefined

export type StoredAlbum = Stored<AlbumInput>
export type StoredCopy = Stored<CopyInput>

export function snapToAlbum(snap: DocumentSnapshot): StoredAlbum | null {
  const data = snap.data()
  if (!data) return null
  const parsed = albumInputSchema.safeParse(data)
  if (!parsed.success) { console.warn('Skipping invalid album', snap.id, parsed.error.issues); return null }
  return { ...parsed.data, id: snap.id, createdAt: data.createdAt, updatedAt: data.updatedAt }
}

export function snapToCopy(snap: DocumentSnapshot): StoredCopy | null {
  const data = snap.data()
  if (!data) return null
  const parsed = copyInputSchema.safeParse(data)
  if (!parsed.success) { console.warn('Skipping invalid copy', snap.id, parsed.error.issues); return null }
  return { ...parsed.data, id: snap.id, createdAt: data.createdAt, updatedAt: data.updatedAt }
}

/** Existing albums that match by provider ID, or by normalized artist/title (suggestion only). */
export async function findDuplicates(
  db: Firestore, uid: string,
  draft: { title: string; primaryArtist: string; musicBrainzReleaseGroupId?: string; discogsMasterId?: string; discogsReleaseId?: string },
): Promise<DuplicateMatch[]> {
  const found = new Map<string, StoredAlbum>()
  const sid = stableAlbumId(draft)
  if (sid) {
    const a = snapToAlbum(await getDoc(userDoc(db, uid, 'albums', sid)))
    if (a) found.set(a.id, a)
  }
  const byKey = await getDocs(query(userCol(db, uid, 'albums'), where('normalizedKey', '==', makeNormalizedKey(draft.primaryArtist, draft.title))))
  for (const s of byKey.docs) { const a = snapToAlbum(s); if (a) found.set(a.id, a) }
  return classifyDuplicates([...found.values()], draft)
}

/** Creates an album and (optionally) its first copy in one atomic batch. */
export async function createAlbum(
  db: Firestore, uid: string, albumInput: AlbumInput, copyInput?: Omit<CopyInput, 'albumId'>,
): Promise<{ albumId: string; copyId?: string }> {
  const sid = stableAlbumId(albumInput)
  const albumRef = sid ? userDoc(db, uid, 'albums', sid) : doc(userCol(db, uid, 'albums'))
  if (sid && (await getDoc(albumRef)).exists()) throw new AlbumExistsError(albumRef.id)

  const album = albumInputSchema.parse({ ...albumInput, owned: Boolean(copyInput), copyCount: copyInput ? 1 : 0 })
  const batch = writeBatch(db)
  batch.set(albumRef, { ...album, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  let copyId: string | undefined
  if (copyInput) {
    const copyRef = doc(userCol(db, uid, 'copies'))
    copyId = copyRef.id
    batch.set(copyRef, { ...copyInputSchema.parse({ ...copyInput, albumId: albumRef.id }), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  }
  await batch.commit()
  return { albumId: albumRef.id, copyId }
}

/** Adds a copy and updates the album's copyCount/owned flag atomically. */
export async function addCopy(db: Firestore, uid: string, albumId: string, copyInput: Omit<CopyInput, 'albumId'>): Promise<string> {
  const albumRef = userDoc(db, uid, 'albums', albumId)
  const copyRef = doc(userCol(db, uid, 'copies'))
  const parsed = copyInputSchema.parse({ ...copyInput, albumId })
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(albumRef)
    if (!snap.exists()) throw new Error('That album no longer exists.')
    const count = Number(snap.data().copyCount ?? 0)
    tx.set(copyRef, { ...parsed, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    tx.update(albumRef, { copyCount: count + 1, owned: true, archived: false, updatedAt: serverTimestamp() })
  })
  return copyRef.id
}

export async function updateCopy(db: Firestore, uid: string, albumId: string, copyId: string, copyInput: Omit<CopyInput, 'albumId'>) {
  const parsed = copyInputSchema.parse({ ...copyInput, albumId })
  // Fields cleared in the form must be removed, so write explicit nulls-as-deletes via full replacement.
  const ref = userDoc(db, uid, 'copies', copyId)
  const existing = await getDoc(ref)
  const createdAt = existing.data()?.createdAt ?? serverTimestamp()
  const batch = writeBatch(db)
  batch.set(ref, { ...parsed, createdAt, updatedAt: serverTimestamp() })
  await batch.commit()
}

export async function deleteCopy(db: Firestore, uid: string, albumId: string, copyId: string) {
  const albumRef = userDoc(db, uid, 'albums', albumId)
  const copyRef = userDoc(db, uid, 'copies', copyId)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(albumRef)
    const count = Number(snap.data()?.copyCount ?? 1)
    tx.delete(copyRef)
    if (snap.exists()) tx.update(albumRef, { copyCount: Math.max(0, count - 1), owned: count - 1 > 0, updatedAt: serverTimestamp() })
  })
}

export async function setArchived(db: Firestore, uid: string, albumId: string, archived: boolean) {
  await updateDoc(userDoc(db, uid, 'albums', albumId), { archived, updatedAt: serverTimestamp() })
}

export async function listCopies(db: Firestore, uid: string, albumId: string): Promise<StoredCopy[]> {
  const snap = await getDocs(query(userCol(db, uid, 'copies'), where('albumId', '==', albumId)))
  return snap.docs.map(snapToCopy).filter((c): c is StoredCopy => c !== null)
    .sort((a, b) => (b.purchaseDate ?? '').localeCompare(a.purchaseDate ?? ''))
}

/** Deletes an album with its copies, review, listening sessions and price observations in one batch. */
export async function deleteAlbumWithCopies(db: Firestore, uid: string, albumId: string): Promise<number> {
  const related = await Promise.all((['copies', 'listeningSessions', 'priceObservations'] as const).map((c) =>
    getDocs(query(userCol(db, uid, c), where('albumId', '==', albumId)))))
  const total = related.reduce((n, s) => n + s.size, 0)
  if (total > 450) throw new Error('This album has too many linked records to delete in one step.')
  const batch = writeBatch(db)
  related.forEach((s) => s.docs.forEach((d) => batch.delete(d.ref)))
  batch.delete(userDoc(db, uid, 'reviews', albumId))
  batch.delete(userDoc(db, uid, 'albums', albumId))
  await batch.commit()
  return related[0]!.size
}
