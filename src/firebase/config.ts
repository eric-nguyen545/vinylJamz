import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth'
import { initializeFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore'

const env = import.meta.env

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
  appId: env.VITE_FIREBASE_APP_ID ?? '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
}

export const missingFirebaseVars = (
  [
    ['VITE_FIREBASE_API_KEY', firebaseConfig.apiKey],
    ['VITE_FIREBASE_AUTH_DOMAIN', firebaseConfig.authDomain],
    ['VITE_FIREBASE_PROJECT_ID', firebaseConfig.projectId],
    ['VITE_FIREBASE_APP_ID', firebaseConfig.appId],
  ] as const
).filter(([, v]) => !v).map(([k]) => k)

export const isFirebaseConfigured = missingFirebaseVars.length === 0

/** UI gate only. Real enforcement is the owner UID baked into firestore.rules. */
export const ownerUid = env.VITE_OWNER_UID ?? ''

let cached: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null

export function getFirebase() {
  if (cached) return cached
  if (!isFirebaseConfigured) throw new Error('Firebase is not configured. Copy .env.example to .env and fill it in.')
  const app = getApps()[0] ?? initializeApp(firebaseConfig)
  const auth = getAuth(app)
  const db = initializeFirestore(app, { ignoreUndefinedProperties: true })
  if (env.VITE_USE_EMULATORS === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
  }
  cached = { app, auth, db }
  return cached
}
