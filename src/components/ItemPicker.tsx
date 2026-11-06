import { useMemo, useState } from 'react'
import { normalizeText } from '../lib/normalize'
import { inputClass } from './Field'

export interface PickItem { id: string; label: string; sub?: string }

interface Props { title: string; items: PickItem[]; selected: Set<string>; onChange: (next: Set<string>) => void; emptyText?: string }

/** A filterable checklist with select-all / clear that act on whatever the filter currently shows. */
export function ItemPicker({ title, items, selected, onChange, emptyText = 'Nothing to choose from yet.' }: Props) {
  const [filter, setFilter] = useState('')
  const shown = useMemo(() => {
    const n = normalizeText(filter)
    return n ? items.filter((i) => normalizeText(`${i.label} ${i.sub ?? ''}`).includes(n)) : items
  }, [items, filter])
  const setMany = (ids: string[], on: boolean) => { const n = new Set(selected); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); onChange(n) }
  const toggle = (id: string) => setMany([id], !selected.has(id))
  const count = items.filter((i) => selected.has(i.id)).length

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <p className="font-medium">{title} <span className="font-normal text-dust">({count} of {items.length} public)</span></p>
        <div className="flex gap-2 text-sm">
          <button type="button" onClick={() => setMany(shown.map((i) => i.id), true)} className="rounded-lg bg-sleeve-hi px-3 py-1.5 font-medium hover:bg-groove">Make {filter ? 'matching' : 'all'} public</button>
          <button type="button" onClick={() => setMany(shown.map((i) => i.id), false)} className="rounded-lg bg-sleeve-hi px-3 py-1.5 font-medium hover:bg-groove">Make {filter ? 'matching' : 'all'} private</button>
        </div>
      </div>
      {items.length === 0
        ? <p className="text-dust">{emptyText}</p>
        : (
          <>
            <label className="mb-3 block max-w-md"><span className="sr-only">Filter {title}</span><input type="search" className={inputClass} placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} /></label>
            <ul className="max-h-80 divide-y divide-groove overflow-y-auto rounded-xl bg-sleeve">
              {shown.map((i) => (
                <li key={i.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-sleeve-hi">
                    <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} className="size-4 accent-[var(--color-label)]" />
                    <span className="min-w-0 flex-1 truncate">{i.label}{i.sub ? <span className="text-dust"> {i.sub}</span> : null}</span>
                    <span className="shrink-0 text-xs text-dust">{selected.has(i.id) ? 'Public' : 'Private'}</span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
    </div>
  )
}
