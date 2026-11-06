import { addDoc, deleteDoc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, type DocumentSnapshot, type Firestore } from 'firebase/firestore'
import { userCol, userDoc } from '../firebase/paths'
import { gearInputSchema, type GearInput, type Stored } from './schemas'

export type StoredGear = Stored<GearInput>

export function snapToGear(snap: DocumentSnapshot): StoredGear | null {
  const data = snap.data()
  if (!data) return null
  const parsed = gearInputSchema.safeParse(data)
  if (!parsed.success) { console.warn('Skipping invalid gear item', snap.id, parsed.error.issues); return null }
  return { ...parsed.data, id: snap.id, createdAt: data.createdAt, updatedAt: data.updatedAt }
}

export async function listGear(db: Firestore, uid: string): Promise<StoredGear[]> {
  const snap = await getDocs(query(userCol(db, uid, 'gear'), limit(1000)))
  return snap.docs.map(snapToGear).filter((g): g is StoredGear => g !== null)
}

export async function createGear(db: Firestore, uid: string, input: GearInput): Promise<string> {
  const ref = await addDoc(userCol(db, uid, 'gear'), { ...gearInputSchema.parse(input), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return ref.id
}

/** Full replace so cleared fields are really removed; createdAt is preserved. */
export async function updateGear(db: Firestore, uid: string, id: string, input: GearInput): Promise<void> {
  const ref = userDoc(db, uid, 'gear', id)
  const existing = await getDoc(ref)
  await setDoc(ref, { ...gearInputSchema.parse(input), createdAt: existing.data()?.createdAt ?? serverTimestamp(), updatedAt: serverTimestamp() })
}

export const deleteGear = (db: Firestore, uid: string, id: string) => deleteDoc(userDoc(db, uid, 'gear', id))
