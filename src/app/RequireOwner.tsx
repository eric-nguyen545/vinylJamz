import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { LoadingState } from '../components/States'
import { missingFirebaseVars } from '../firebase/config'

export function RequireOwner() {
  const { state, signOut } = useAuth()

  if (state.status === 'loading') return <div className="p-8"><LoadingState label="Checking sign-in" /></div>

  if (state.status === 'unconfigured') {
    return (
      <Message title="Firebase isn’t configured">
        <p>Copy <code>.env.example</code> to <code>.env</code> and fill in these values, then restart the dev server:</p>
        <ul className="mt-2 list-disc pl-5 font-mono text-sm">{missingFirebaseVars.map((v) => <li key={v}>{v}</li>)}</ul>
      </Message>
    )
  }

  if (state.status === 'error') {
    return (
      <Message title="The app couldn’t start">
        <p role="alert">{state.message}</p>
        <p className="mt-2 text-sm">Open the browser console (F12) for details. If you just edited <code>.env</code>, restart <code>npm run dev</code>.</p>
      </Message>
    )
  }

  // Visitors who aren't signed in land on the public site (or its "private" notice), never on an edit page.
  if (state.status === 'signed-out') return <Navigate to="/view" replace />

  if (state.status === 'not-owner') {
    return (
      <Message title="This account isn’t the owner">
        <p>You’re signed in as {state.email ?? 'an unknown account'}, but only the owner account can open the private collection.</p>
        <p className="mt-2">
          Setting up? Your account UID is <code className="select-all rounded bg-sleeve-hi px-1.5 py-0.5">{state.uid}</code>. Put it in <code>VITE_OWNER_UID</code>
          and in <code>firestore.rules</code>, then redeploy.
        </p>
        <button onClick={() => void signOut()} className="mt-4 rounded-lg bg-label px-4 py-2 font-medium text-label-ink">Sign out</button>
      </Message>
    )
  }

  return <Outlet />
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="mb-4 text-3xl font-bold">{title}</h1>
      <div className="text-dust">{children}</div>
    </div>
  )
}
