import { useSyncExternalStore } from 'react'

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb) }
}

/** Tells the person when the browser has no connection, since saving and loading will fail. */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
  if (online) return null
  return <p role="status" className="border-b border-warn/40 bg-warn/10 px-4 py-2 text-center text-sm">You’re offline. Changes can’t be saved until you reconnect.</p>
}
