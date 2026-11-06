import type { StoredCopy } from '../lib/albumsRepo'
import type { FormErrors } from '../lib/formState'
import { TYPE_HELP, TYPE_LABEL } from '../lib/pricing'
import type { PriceFormState } from '../lib/priceForm'
import { Field, inputClass } from './Field'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'VND']
const copyLabel = (c: StoredCopy) => [c.format, c.vinylColor, c.pressingYear, c.releaseCountry].filter(Boolean).join(', ') || 'Copy'

interface Props { value: PriceFormState; errors: FormErrors; copies: StoredCopy[]; busy?: boolean; onChange: (v: PriceFormState) => void; onSubmit: () => void; onCancel: () => void }

export function PriceObservationForm({ value, errors, copies, busy, onChange, onSubmit, onCancel }: Props) {
  const set = (k: keyof PriceFormState) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value } as PriceFormState)
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit() }} className="mb-6 flex flex-col gap-4 rounded-2xl border border-groove p-5">
      <h3 className="text-xl font-medium">Record a price</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="What is this price?" hint={TYPE_HELP[value.type]} className="lg:col-span-2">
          <select className={inputClass} value={value.type} onChange={set('type')}>
            {(['sold', 'listing', 'estimate'] as const).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </Field>
        <Field label="Price" error={errors.price}><input className={inputClass} inputMode="decimal" value={value.price} onChange={set('price')} /></Field>
        <Field label="Currency" error={errors.currency}>
          <select className={inputClass} value={value.currency} onChange={set('currency')}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Date seen" error={errors.observedAt}><input className={inputClass} type="date" value={value.observedAt} onChange={set('observedAt')} /></Field>
        <Field label="Applies to" hint="A specific copy overrides the album-level price in value totals.">
          <select className={inputClass} value={value.copyId} onChange={set('copyId')}>
            <option value="">The album in general</option>{copies.map((c) => <option key={c.id} value={c.id}>{copyLabel(c)}</option>)}
          </select>
        </Field>
        <Field label="Condition" error={errors.condition}><input className={inputClass} value={value.condition} onChange={set('condition')} placeholder="e.g. VG+" /></Field>
        <Field label="Source link" hint="Optional." error={errors.sourceUrl}><input className={inputClass} type="url" value={value.sourceUrl} onChange={set('sourceUrl')} /></Field>
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={busy} className="rounded-lg bg-label px-5 py-2 font-semibold text-label-ink disabled:opacity-50">{busy ? 'Saving…' : 'Save price'}</button>
        <button type="button" onClick={onCancel} className="rounded-lg bg-sleeve-hi px-5 py-2 font-medium hover:bg-groove">Cancel</button>
      </div>
    </form>
  )
}
