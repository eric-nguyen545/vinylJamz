import { addDoc, deleteDoc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where, type DocumentSnapshot, type Firestore } from 'firebase/firestore'
import { userCol, userDoc } from '../firebase/paths'
import { listeningSessionInputSchema, type ListeningSessionInput, type Stored } from './schemas'

export type StoredSession = Stored<ListeningSessionInput>

export function snapToSession(snap: DocumentSnapshot): StoredSession | null {
  const data = snap.data()
  if (!data) return null
  const parsed = listeningSessionInputSchema.safeParse(data)
  if (!parsed.success) { console.warn('Skipping invalid session', snap.id, parsed.error.issues); return null }
  return { ...parsed.data, id: snap.id, createdAt: data.createdAt, updatedAt: data.updatedAt }
}

const keep = (s: StoredSession | null): s is StoredSession => s !== null

/** Newest first. Capped at 2000, which is far beyond personal-scale listening logs. */
export async function listSessions(db: Firestore, uid: string): Promise<StoredSession[]> {
  const snap = await getDocs(query(userCol(db, uid, 'listeningSessions'), orderBy('date', 'desc'), limit(2000)))
  return snap.docs.map(snapToSession).filter(keep)
}

export async function listSessionsForAlbum(db: Firestore, uid: string, albumId: string): Promise<StoredSession[]> {
  const snap = await getDocs(query(userCol(db, uid, 'listeningSessions'), where('albumId', '==', albumId), orderBy('date', 'desc'), limit(500)))
  return snap.docs.map(snapToSession).filter(keep)
}

export async function createSession(db: Firestore, uid: string, input: ListeningSessionInput): Promise<string> {
  const ref = await addDoc(userCol(db, uid, 'listeningSessions'), { ...listeningSessionInputSchema.parse(input), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  return ref.id
}

/** Full replace so cleared optional fields are removed; createdAt is preserved. */
export async function updateSession(db: Firestore, uid: string, id: string, input: ListeningSessionInput): Promise<void> {
  const ref = userDoc(db, uid, 'listeningSessions', id)
  const existing = await getDoc(ref)
  await setDoc(ref, { ...listeningSessionInputSchema.parse(input), createdAt: existing.data()?.createdAt ?? serverTimestamp(), updatedAt: serverTimestamp() })
}

export const deleteSession = (db: Firestore, uid: string, id: string) => deleteDoc(userDoc(db, uid, 'listeningSessions', id))
