import {
  addDoc, deleteField, getDocs, limit, query, serverTimestamp, setDoc, where, writeBatch, getDoc,
  type DocumentSnapshot, type Firestore,
} from 'firebase/firestore'
import { userCol, userDoc } from '../firebase/paths'
import { purchaseLocationInputSchema, type PurchaseLocationInput, type Stored } from './schemas'

export type StoredLocation = Stored<PurchaseLocationInput>

export function snapToLocation(snap: DocumentSnapshot): StoredLocation | null {
  const data = snap.data()
  if (!data) return null
  const parsed = purchaseLocationInputSchema.safeParse(data)
  if (!parsed.success) { console.warn('Skipping invalid location', snap.id, parsed.error.issues); return null }
  return { ...parsed.data, id: snap.id, createdAt: data.createdAt, updatedAt: data.updatedAt }
}

export async function listLocations(db: Firestore, uid: string): Promise<StoredLocation[]> {
  const snap = await getDocs(query(userCol(db, uid, 'purchaseLocations'), limit(500)))
  return snap.docs.map(snapToLocation).filter((l): l is StoredLocation => l !== null).sort((a, b) => a.name.localeCompare(b.name))
}

export async function createLocation(db: Firestore, uid: string, input: PurchaseLocationInput): Promise<string> {
  const ref = await addDoc(userCol(db, uid, 'purchaseLocations'), {
    ...purchaseLocationInputSchema.parse(input), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
  return ref.id
}

/** Full replace so cleared fields (like coordinates) are really removed; createdAt is preserved. */
export async function updateLocation(db: Firestore, uid: string, id: string, input: PurchaseLocationInput): Promise<void> {
  const ref = userDoc(db, uid, 'purchaseLocations', id)
  const existing = await getDoc(ref)
  await setDoc(ref, { ...purchaseLocationInputSchema.parse(input), createdAt: existing.data()?.createdAt ?? serverTimestamp(), updatedAt: serverTimestamp() })
}

export async function countCopiesAt(db: Firestore, uid: string, locationId: string): Promise<number> {
  return (await getDocs(query(userCol(db, uid, 'copies'), where('purchaseLocationId', '==', locationId)))).size
}

/** Deletes a location and detaches it from any copies in one batch; copies themselves are kept. */
export async function deleteLocation(db: Firestore, uid: string, id: string): Promise<number> {
  const copies = await getDocs(query(userCol(db, uid, 'copies'), where('purchaseLocationId', '==', id)))
  if (copies.size > 450) throw new Error('Too many copies use this location to detach in one step.')
  const batch = writeBatch(db)
  copies.docs.forEach((c) => batch.update(c.ref, { purchaseLocationId: deleteField(), updatedAt: serverTimestamp() }))
  batch.delete(userDoc(db, uid, 'purchaseLocations', id))
  await batch.commit()
  return copies.size
}
