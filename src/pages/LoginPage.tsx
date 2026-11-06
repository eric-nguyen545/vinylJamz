import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { authErrorMessage, useAuth } from '../app/AuthContext'
import { Brand } from '../components/Sidebar'
import { LoadingState } from '../components/States'
import { missingFirebaseVars } from '../firebase/config'
import { useDocumentTitle } from '../lib/pageTitle'

export function LoginPage() {
  const { state, signIn, resetPassword } = useAuth()
  useDocumentTitle('Sign in · Vinyl Archive')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (state.status === 'loading') return <div className="p-8"><LoadingState label="Checking sign-in" /></div>
  if (state.status === 'owner' || state.status === 'not-owner') return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setNotice(null)
    try { await signIn(email.trim(), password) } catch (err) { setError(authErrorMessage(err)) } finally { setBusy(false) }
  }

  async function onReset() {
    setError(null); setNotice(null)
    if (!email.trim()) { setError('Enter your email above, then choose “Reset password”.'); return }
    try {
      await resetPassword(email.trim())
      setNotice('If that email has an account, a reset link is on its way.')
    } catch {
      setNotice('If that email has an account, a reset link is on its way.')
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-6">
      <Brand />
      <div>
        <h1 className="text-3xl font-bold">Sign in</h1>
        <p className="mt-1 text-dust">Your collection is private. Only the owner account can open it.</p>
      </div>
      {state.status === 'error' && <p role="alert" className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm">{state.message}</p>}
      {state.status === 'unconfigured' && (
        <p role="alert" className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm">
          Firebase isn’t configured yet. Missing: {missingFirebaseVars.join(', ')}.
        </p>
      )}
      <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-groove bg-sleeve px-3 py-2 text-base font-normal" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-groove bg-sleeve px-3 py-2 text-base font-normal" />
        </label>
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        {notice && <p role="status" className="text-sm text-ok">{notice}</p>}
        <button type="submit" disabled={busy || state.status === 'unconfigured' || state.status === 'error'}
          className="rounded-lg bg-label px-4 py-2.5 font-semibold text-label-ink disabled:opacity-50">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" onClick={() => void onReset()} disabled={state.status === 'unconfigured' || state.status === 'error'}
          className="text-sm text-dust underline underline-offset-4 hover:text-paper disabled:opacity-50">
          Reset password
        </button>
      </form>
    </div>
  )
}
