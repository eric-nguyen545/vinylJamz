import { useId, useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { addVibe } from '../lib/reviewForm'

const SUGGESTIONS = ['late night', 'driving', 'rainy day', 'focus', 'party', 'melancholy', 'summer', 'cooking', 'workout']

interface Props { value: string[]; onChange: (v: string[]) => void; error?: string; label?: string }

/** Chip-style tag entry: Enter or comma adds, Backspace on empty input removes the last tag. */
export function VibeTagInput({ value, onChange, error, label = 'Vibes' }: Props) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const commit = () => { onChange(addVibe(value, draft)); setDraft('') }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() }
    else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
  }
  return (
    <div>
      <label htmlFor={`${id}-in`} className="text-sm font-medium">{label}</label>
      <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-groove bg-sleeve p-2">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-sleeve-hi py-1 pl-3 pr-1 text-sm">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))} className="rounded-full p-1 hover:bg-groove"><X aria-hidden className="size-3" /></button>
          </span>
        ))}
        <input id={`${id}-in`} list={`${id}-list`} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={() => draft && commit()}
          placeholder={value.length ? '' : 'Type a vibe, press Enter'} className="min-w-32 flex-1 bg-transparent px-1 py-1 outline-none" />
        <datalist id={`${id}-list`}>{SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  )
}
