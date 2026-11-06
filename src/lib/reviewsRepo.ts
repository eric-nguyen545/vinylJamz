import { getDoc, serverTimestamp, setDoc, deleteDoc, type DocumentSnapshot, type Firestore } from 'firebase/firestore'
import { userDoc } from '../firebase/paths'
import { reviewInputSchema, type ReviewInput, type Stored } from './schemas'

export type StoredReview = Stored<ReviewInput>

/** One review per album; the document ID is the album ID. */
export const reviewRef = (db: Firestore, uid: string, albumId: string) => userDoc(db, uid, 'reviews', albumId)

export function snapToReview(snap: DocumentSnapshot): StoredReview | null {
  const data = snap.data()
  if (!data) return null
  const parsed = reviewInputSchema.safeParse(data)
  if (!parsed.success) { console.warn('Skipping invalid review', snap.id, parsed.error.issues); return null }
  return { ...parsed.data, id: snap.id, createdAt: data.createdAt, updatedAt: data.updatedAt }
}

export async function getReview(db: Firestore, uid: string, albumId: string): Promise<StoredReview | null> {
  return snapToReview(await getDoc(reviewRef(db, uid, albumId)))
}

/** Full replace so fields the owner clears are actually removed; createdAt is preserved. */
export async function saveReview(db: Firestore, uid: string, albumId: string, input: ReviewInput): Promise<void> {
  const ref = reviewRef(db, uid, albumId)
  const existing = await getDoc(ref)
  await setDoc(ref, {
    ...reviewInputSchema.parse(input),
    createdAt: existing.data()?.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export const deleteReview = (db: Firestore, uid: string, albumId: string) => deleteDoc(reviewRef(db, uid, albumId))
