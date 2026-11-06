import { Pencil, Trash2 } from 'lucide-react'
import type { StoredCopy } from '../lib/albumsRepo'

const money = (n: number, c?: string) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c ?? 'USD' }).format(n) } catch { return `${n} ${c ?? ''}` }
}

export function CopyCard({ copy, locationName, onEdit, onDelete }: { copy: StoredCopy; locationName?: string; onEdit: () => void; onDelete: () => void }) {
  const title = [copy.format, copy.vinylColor, copy.pressingYear, copy.releaseCountry].filter(Boolean).join(', ')
  const rows: [string, string | undefined][] = [
    ['Label', copy.label], ['Catalog no.', copy.catalogNumber], ['Barcode', copy.barcode],
    ['Record', copy.recordCondition], ['Sleeve', copy.sleeveCondition],
    ['Bought', copy.purchaseDate], ['Paid', copy.purchasePrice !== undefined ? money(copy.purchasePrice, copy.currency) : undefined],
    ['From', copy.seller], ['Location', locationName], ['Edition', copy.editionNotes], ['Notes', copy.privateNotes],
  ]
  return (
    <li className="rounded-2xl bg-sleeve p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-medium">{title || 'Copy'}</h3>
        <div className="flex gap-1">
          <button onClick={onEdit} aria-label={`Edit ${title || 'copy'}`} className="rounded-md p-2 hover:bg-sleeve-hi"><Pencil aria-hidden className="size-4" /></button>
          <button onClick={onDelete} aria-label={`Delete ${title || 'copy'}`} className="rounded-md p-2 text-bad hover:bg-sleeve-hi"><Trash2 aria-hidden className="size-4" /></button>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="contents"><dt className="text-dust">{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </li>
  )
}
