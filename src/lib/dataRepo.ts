import { getDoc, getDocs, serverTimestamp, Timestamp, writeBatch, type Firestore } from 'firebase/firestore'
import { prefsDoc, userCol, userDoc } from '../firebase/paths'
import { BACKUP_COLLECTIONS, type CollectionKey, type ExistingData, type ImportOp, type RawDoc } from './backup'

export interface AllData { docs: Record<CollectionKey, RawDoc[]>; preferences: Record<string, unknown> | null }

const toIso = (v: unknown): string | undefined =>
  v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: unknown }).toDate === 'function' ? (v as Timestamp).toDate().toISOString() : undefined

/** Reads every record in the library, exactly as stored (timestamps become ISO strings). */
export async function loadAll(db: Firestore, uid: string): Promise<AllData> {
  const entries = await Promise.all(BACKUP_COLLECTIONS.map(async (key) => {
    const snap = await getDocs(userCol(db, uid, key))
    const docs: RawDoc[] = snap.docs.map((d) => {
      const { createdAt, updatedAt: _u, ...data } = d.data()
      void _u
      return { id: d.id, createdAt: toIso(createdAt), data }
    })
    return [key, docs] as const
  }))
  const prefs = await getDoc(prefsDoc(db, uid))
  return { docs: Object.fromEntries(entries) as Record<CollectionKey, RawDoc[]>, preferences: prefs.exists() ? prefs.data() : null }
}

export function toExisting(all: AllData): ExistingData {
  const docs = Object.fromEntries(BACKUP_COLLECTIONS.map((k) => [k, Object.fromEntries(all.docs[k].map((d) => [d.id, d.data]))])) as ExistingData['docs']
  return { docs, preferences: all.preferences }
}

const BATCH = 400

/**
 * Writes the planned operations in batches of 400. Batches are atomic individually but not together,
 * so a failure part-way leaves earlier batches written. Re-running the same import is safe because
 * already-imported records are then reported as unchanged.
 */
export async function runImport(
  db: Firestore, uid: string, ops: ImportOp[], onProgress: (done: number, total: number) => void,
): Promise<number> {
  let done = 0
  onProgress(0, ops.length)
  for (let i = 0; i < ops.length; i += BATCH) {
    const batch = writeBatch(db)
    for (const op of ops.slice(i, i + BATCH)) {
      if (op.kind === 'set') {
        const created = op.createdAt && !Number.isNaN(Date.parse(op.createdAt)) ? Timestamp.fromDate(new Date(op.createdAt)) : serverTimestamp()
        batch.set(userDoc(db, uid, op.collection, op.id), { ...op.data, createdAt: created, updatedAt: serverTimestamp() })
      } else if (op.kind === 'albumCounts') {
        batch.update(userDoc(db, uid, 'albums', op.id), { copyCount: op.copyCount, owned: op.owned, updatedAt: serverTimestamp() })
      } else {
        batch.set(prefsDoc(db, uid), op.data)
      }
    }
    await batch.commit()
    done += Math.min(BATCH, ops.length - i)
    onProgress(done, ops.length)
  }
  return done
}
