import { addDoc, deleteDoc, deleteField, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where, type DocumentSnapshot, type Firestore } from 'firebase/firestore'
import { pricingSettingsDoc, userCol, userDoc } from '../firebase/paths'
import { priceObservationInputSchema, pricingSettingsSchema, type AlbumInput, type PriceObservationInput, type PricingSettings, type Stored } from './schemas'

export type StoredObservation = Stored<PriceObservationInput>

export function snapToObservation(snap: DocumentSnapshot): StoredObservation | null {
  const data = snap.data()
  if (!data) return null
  const parsed = priceObservationInputSchema.safeParse(data)
  if (!parsed.success) { console.warn('Skipping invalid price observation', snap.id, parsed.error.issues); return null }
  return { ...parsed.data, id: snap.id, createdAt: data.createdAt, updatedAt: data.updatedAt }
}
const keep = (o: StoredObservation | null): o is StoredObservation => o !== null

export async function listObservationsForAlbum(db: Firestore, uid: string, albumId: string): Promise<StoredObservation[]> {
  const snap = await getDocs(query(userCol(db, uid, 'priceObservations'), where('albumId', '==', albumId), orderBy('observedAt', 'desc'), limit(200)))
  return snap.docs.map(snapToObservation).filter(keep)
}

export async function listAllObservations(db: Firestore, uid: string): Promise<StoredObservation[]> {
  const snap = await getDocs(query(userCol(db, uid, 'priceObservations'), limit(5000)))
  return snap.docs.map(snapToObservation).filter(keep)
}

export async function createObservation(db: Firestore, uid: string, input: PriceObservationInput): Promise<string> {
  const ref = await addDoc(userCol(db, uid, 'priceObservations'), { ...priceObservationInputSchema.parse(input), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return ref.id
}

export const deleteObservation = (db: Firestore, uid: string, id: string) => deleteDoc(userDoc(db, uid, 'priceObservations', id))

export async function setDiscogsRelease(db: Firestore, uid: string, albumId: string, releaseId: string | undefined): Promise<void> {
  await updateDoc(userDoc(db, uid, 'albums', albumId), {
    discogsReleaseId: releaseId ?? deleteField(), updatedAt: serverTimestamp(),
  })
}

export async function loadPricingSettings(db: Firestore, uid: string): Promise<PricingSettings> {
  const snap = await getDoc(pricingSettingsDoc(db, uid))
  const p = pricingSettingsSchema.safeParse(snap.data() ?? {})
  return p.success ? p.data : {}
}

export const savePricingSettings = (db: Firestore, uid: string, s: PricingSettings) =>
  setDoc(pricingSettingsDoc(db, uid), pricingSettingsSchema.parse(s))

export async function saveDiscogsStats(db: Firestore, uid: string, albumId: string, stats: NonNullable<AlbumInput['discogsStats']>): Promise<void> {
  await updateDoc(userDoc(db, uid, 'albums', albumId), { discogsStats: stats, updatedAt: serverTimestamp() })
}
