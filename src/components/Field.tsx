import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'

export const inputClass = 'w-full rounded-lg border border-groove bg-sleeve px-3 py-2 text-base font-normal'

/**
 * A labelled form control. The label is tied to the control with htmlFor, and the hint and error are
 * linked through aria-describedby, so a screen reader announces them with the field (and the error
 * is not mixed into the field's name).
 */
export function Field({ label, error, hint, children, className = '' }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })
    : children
  return (
    <div className={`flex flex-col gap-1 text-sm font-medium ${className}`}>
      <label htmlFor={id}>{label}</label>
      {control}
      {hint && <span id={hintId} className="text-xs font-normal text-dust">{hint}</span>}
      {error && <span id={errorId} role="alert" className="text-xs font-normal text-bad">{error}</span>}
    </div>
  )
}
