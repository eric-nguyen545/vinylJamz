import type { ReactNode } from 'react'
import { AlertTriangle, Inbox } from 'lucide-react'

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-groove px-6 py-14 text-center">
      <Inbox aria-hidden className="size-8 text-dust" />
      <h2 className="text-xl font-medium">{title}</h2>
      {children && <p className="max-w-md text-dust">{children}</p>}
      {action}
    </div>
  )
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 text-dust">
      <span aria-hidden className="record-spin size-5 rounded-full border-2 border-groove border-t-label" />
      <span>{label}…</span>
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-bad/40 bg-bad/10 p-4">
      <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-bad" />
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-dust">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="mt-2 rounded-md bg-sleeve-hi px-3 py-1.5 text-sm font-medium hover:bg-groove">
            Try again
          </button>
        )}
      </div>
    </div>
  )
}
