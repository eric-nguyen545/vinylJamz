import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { getFirebase, isFirebaseConfigured, ownerUid } from '../firebase/config'

export type AuthState =
  | { status: 'loading' }
  | { status: 'unconfigured' }
  | { status: 'error'; message: string }
  | { status: 'signed-out' }
  | { status: 'not-owner'; uid: string; email: string | null }
  | { status: 'owner'; user: User }

interface AuthApi {
  state: AuthState
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const Ctx = createContext<AuthApi | null>(null)

export function authErrorMessage(err: unknown): string {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Email or password is incorrect.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes or reset your password.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    default:
      return 'Could not sign in. Try again.'
  }
}

/** Turns a startup failure into something a person can act on. */
export function initErrorMessage(err: unknown): string {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : ''
  if (code === 'auth/invalid-api-key') return 'Firebase says the API key is invalid. Check VITE_FIREBASE_API_KEY in your .env file (no quotes, no spaces, copied from the Firebase web app config), then stop and restart npm run dev.'
  return err instanceof Error ? err.message : 'Firebase could not start.'
}

type Init = { kind: 'ok'; fb: ReturnType<typeof getFirebase> } | { kind: 'unconfigured' } | { kind: 'error'; message: string }

let started: Init | null = null

/** Starts Firebase once, up front, so a bad config becomes a visible message instead of a crash. */
function startFirebase(): Init {
  if (started) return started
  if (!isFirebaseConfigured) return (started = { kind: 'unconfigured' })
  try { started = { kind: 'ok', fb: getFirebase() } } catch (e) { console.error('Firebase failed to start', e); started = { kind: 'error', message: initErrorMessage(e) } }
  return started
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const init = startFirebase()
  const [state, setState] = useState<AuthState>(() =>
    init.kind === 'ok' ? { status: 'loading' } : init.kind === 'unconfigured' ? { status: 'unconfigured' } : { status: 'error', message: init.message })

  useEffect(() => {
    if (init.kind !== 'ok') return
    return onAuthStateChanged(init.fb.auth, (user) => {
      if (!user) setState({ status: 'signed-out' })
      else if (ownerUid && user.uid === ownerUid) setState({ status: 'owner', user })
      else setState({ status: 'not-owner', uid: user.uid, email: user.email })
    }, (err) => setState({ status: 'error', message: initErrorMessage(err) }))
  }, [init])

  const api = useMemo<AuthApi>(
    () => ({
      state,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(getFirebase().auth, email, password)
      },
      signOut: async () => {
        await fbSignOut(getFirebase().auth)
      },
      resetPassword: async (email) => {
        await sendPasswordResetEmail(getFirebase().auth, email)
      },
    }),
    [state],
  )
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useAuth(): AuthApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}
