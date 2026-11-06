import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State { error: Error | null }

/** Last line of defense: an unexpected crash shows a message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State { return { error } }

  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Unhandled app error', error, info.componentStack) }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <h1 className="text-3xl font-bold">Something broke</h1>
        <p className="mt-2 text-dust">The app hit an unexpected error. Your data is safe; nothing was changed by this screen.</p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-sleeve p-3 text-sm text-bad">{this.state.error.message}</pre>
        <p className="mt-3 text-sm text-dust">More detail is in the browser console (F12).</p>
        <button onClick={() => window.location.reload()} className="mt-6 rounded-lg bg-label px-5 py-2 font-semibold text-label-ink">Reload</button>
      </main>
    )
  }
}
