import { collection, doc, type Firestore } from 'firebase/firestore'

export const COLLECTIONS = [
  'albums',
  'copies',
  'reviews',
  'wantlist',
  'listeningSessions',
  'purchaseLocations',
  'priceObservations',
  'gear',
] as const
export type CollectionName = (typeof COLLECTIONS)[number]

export const userCol = (db: Firestore, uid: string, name: CollectionName) => collection(db, 'users', uid, name)
export const userDoc = (db: Firestore, uid: string, name: CollectionName, id: string) => doc(db, 'users', uid, name, id)
export const prefsDoc = (db: Firestore, uid: string) => doc(db, 'users', uid, 'settings', 'preferences')
export const publicCollectionDoc = (db: Firestore, shareId: string) => doc(db, 'publicCollections', shareId)
export const publicAlbumsCol = (db: Firestore, shareId: string) => collection(db, 'publicCollections', shareId, 'albums')
export const sharingDoc = (db: Firestore, uid: string) => doc(db, 'users', uid, 'settings', 'sharing')
export const publicAlbumDoc = (db: Firestore, shareId: string, albumId: string) => doc(db, 'publicCollections', shareId, 'albums', albumId)
export const pricingSettingsDoc = (db: Firestore, uid: string) => doc(db, 'users', uid, 'settings', 'pricing')
export const PUBLIC_SUBS = ['albums', 'wantlist', 'listens', 'gear', 'places'] as const
export type PublicSub = (typeof PUBLIC_SUBS)[number]
export const publicSubCol = (db: Firestore, shareId: string, name: PublicSub) => collection(db, 'publicCollections', shareId, name)
export const publicSubDoc = (db: Firestore, shareId: string, name: PublicSub, id: string) => doc(db, 'publicCollections', shareId, name, id)
/** Pointer document that tells anonymous visitors which share to show on the public website. */
export const publicSiteDoc = (db: Firestore) => doc(db, 'publicSite', 'main')
