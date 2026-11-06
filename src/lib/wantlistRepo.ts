import {
  deleteField, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, updateDoc, where, writeBatch,
  type DocumentSnapshot, type Firestore,
} from 'firebase/firestore'
import { userCol, userDoc } from '../firebase/paths'
import {
  ACTIVE_WANT_STATUSES, albumInputSchema, copyInputSchema, wantlistInputSchema,
  type AlbumInput, type CopyInput, type Stored, type WantlistInput,
} from './schemas'
import { snapToAlbum, stableAlbumId } from './albumsRepo'

export type StoredWant = Stored<WantlistInput>
export type WantEditable = Omit<WantlistInput, 'albumId' | 'albumTitle' | 'primaryArtist' | 'artworkUrl' | 'releaseYear' | 'purchasedCopyId'>

export class WantlistExistsError extends Error {
  constructor() { super('That album and pressing is already on your wantlist.'); this.name = 'WantlistExistsError' }
}

export function snapToWant(snap: DocumentSnapshot): StoredWant | null {
  const data = snap.data()
  if (!data) return null
  const parsed = wantlistInputSchema.safeParse(data)
  if (!parsed.success) { console.warn('Skipping invalid wantlist item', snap.id, parsed.error.issues); return null }
  return { ...parsed.data, id: snap.id, createdAt: data.createdAt, updatedAt: data.updatedAt }
}

/** Personal-scale list (capped at 500), newest first. Filtering happens client-side. */
export async function listWantlist(db: Firestore, uid: string): Promise<StoredWant[]> {
  const snap = await getDocs(query(userCol(db, uid, 'wantlist'), orderBy('createdAt', 'desc'), limit(500)))
  return snap.docs.map(snapToWant).filter((w): w is StoredWant => w !== null)
}

/**
 * Adds a wantlist item. Reuses an existing album record (provider ID match or an explicit
 * existingAlbumId); otherwise creates an unowned album stub in the same batch.
 */
export async function createWantlistEntry(
  db: Firestore, uid: string, albumInput: AlbumInput, want: WantEditable, existingAlbumId?: string,
): Promise<{ albumId: string; wantId: string }> {
  const sid = stableAlbumId(albumInput)
  const albumId = existingAlbumId ?? sid
  const albumRef = albumId ? userDoc(db, uid, 'albums', albumId) : doc(userCol(db, uid, 'albums'))
  const existing = albumId ? snapToAlbum(await getDoc(albumRef)) : null
  const snapshotSource = existing ?? albumInput

  const same = await getDocs(query(userCol(db, uid, 'wantlist'), where('albumId', '==', albumRef.id)))
  const clash = same.docs.map(snapToWant).some((w) => w && ACTIVE_WANT_STATUSES.includes(w.status) && (w.desiredReleaseId ?? '') === (want.desiredReleaseId ?? ''))
  if (clash) throw new WantlistExistsError()

  const wantRef = doc(userCol(db, uid, 'wantlist'))
  const batch = writeBatch(db)
  if (!existing) {
    const album = albumInputSchema.parse({ ...albumInput, owned: false, copyCount: 0 })
    batch.set(albumRef, { ...album, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  }
  batch.set(wantRef, {
    ...wantlistInputSchema.parse({
      ...want, albumId: albumRef.id, albumTitle: snapshotSource.title, primaryArtist: snapshotSource.primaryArtist,
      artworkUrl: snapshotSource.artworkUrl, releaseYear: snapshotSource.releaseYear,
    }),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
  await batch.commit()
  return { albumId: albumRef.id, wantId: wantRef.id }
}

/** Updates editable fields; cleared optional fields are removed from the document. */
export async function updateWantlistItem(db: Firestore, uid: string, wantId: string, input: WantEditable): Promise<void> {
  const parsed = wantlistInputSchema.omit({ albumId: true, albumTitle: true, primaryArtist: true, artworkUrl: true, releaseYear: true, purchasedCopyId: true }).parse(input)
  const fields: (keyof WantEditable)[] = ['desiredReleaseId', 'desiredPressingNotes', 'targetPrice', 'currency', 'priority', 'status', 'notes']
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() }
  for (const f of fields) update[f] = parsed[f] === undefined ? deleteField() : parsed[f]
  await updateDoc(userDoc(db, uid, 'wantlist', wantId), update)
}

/** "Bought it": creates the copy, updates the album, and marks the item purchased atomically. */
export async function purchaseWantlistItem(
  db: Firestore, uid: string, wantId: string, albumId: string, copyInput: Omit<CopyInput, 'albumId'>,
): Promise<string> {
  const parsed = copyInputSchema.parse({ ...copyInput, albumId })
  const albumRef = userDoc(db, uid, 'albums', albumId)
  const wantRef = userDoc(db, uid, 'wantlist', wantId)
  const copyRef = doc(userCol(db, uid, 'copies'))
  await runTransaction(db, async (tx) => {
    const [album, want] = await Promise.all([tx.get(albumRef), tx.get(wantRef)])
    if (!album.exists()) throw new Error('That album no longer exists.')
    if (!want.exists()) throw new Error('That wantlist item no longer exists.')
    if (want.data().status === 'purchased') throw new Error('This item is already marked as purchased.')
    tx.set(copyRef, { ...parsed, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    tx.update(albumRef, { copyCount: Number(album.data().copyCount ?? 0) + 1, owned: true, archived: false, updatedAt: serverTimestamp() })
    tx.update(wantRef, { status: 'purchased', purchasedCopyId: copyRef.id, updatedAt: serverTimestamp() })
  })
  return copyRef.id
}

/** Removes an item; also removes the album stub if nothing else (copies, other wants) uses it. */
export async function deleteWantlistItem(db: Firestore, uid: string, want: StoredWant): Promise<void> {
  const albumRef = userDoc(db, uid, 'albums', want.albumId)
  const [album, others] = await Promise.all([
    getDoc(albumRef),
    getDocs(query(userCol(db, uid, 'wantlist'), where('albumId', '==', want.albumId))),
  ])
  const batch = writeBatch(db)
  batch.delete(userDoc(db, uid, 'wantlist', want.id))
  const orphan = album.exists() && album.data().owned !== true && Number(album.data().copyCount ?? 0) === 0 && others.docs.every((d) => d.id === want.id)
  if (orphan) { batch.delete(userDoc(db, uid, 'reviews', want.albumId)); batch.delete(albumRef) }
  await batch.commit()
}
