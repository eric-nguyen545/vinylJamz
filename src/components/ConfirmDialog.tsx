import { useEffect, useId, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Native <dialog>: focus is trapped and Esc closes it. */
export function ConfirmDialog({ open, title, children, confirmLabel, destructive, busy, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); onCancel() }} aria-labelledby={titleId}
      className="m-auto w-[min(28rem,92vw)] rounded-2xl border border-groove bg-sleeve p-6 text-paper backdrop:bg-black/70">
      <h2 id={titleId} className="text-xl font-bold">{title}</h2>
      <div className="mt-2 text-dust">{children}</div>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="rounded-lg bg-sleeve-hi px-4 py-2 font-medium hover:bg-groove">Cancel</button>
        <button type="button" disabled={busy} onClick={onConfirm}
          className={`rounded-lg px-4 py-2 font-semibold disabled:opacity-50 ${destructive ? 'bg-bad text-black' : 'bg-label text-label-ink'}`}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
