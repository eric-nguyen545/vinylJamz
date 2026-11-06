import { WANT_STATUSES } from '../lib/schemas'
import { PRIORITY_LABEL, STATUS_LABEL, type WantFormState } from '../lib/wantlistForm'
import type { FormErrors } from '../lib/formState'
import { Field, inputClass } from './Field'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'VND']

interface Props { value: WantFormState; errors: FormErrors; onChange: (v: WantFormState) => void; showStatus?: boolean }

export function WantlistFields({ value, errors, onChange, showStatus }: Props) {
  const set = (k: keyof WantFormState) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value } as WantFormState)
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Priority" error={errors.priority}>
        <select className={inputClass} value={value.priority} onChange={set('priority')}>
          {(Object.keys(PRIORITY_LABEL) as (keyof typeof PRIORITY_LABEL)[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </select>
      </Field>
      {showStatus && (
        <Field label="Status" error={errors.status}>
          <select className={inputClass} value={value.status} onChange={set('status')}>
            {WANT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
      )}
      <Field label="Target price" error={errors.targetPrice}><input className={inputClass} inputMode="decimal" value={value.targetPrice} onChange={set('targetPrice')} /></Field>
      <Field label="Currency" error={errors.currency}>
        <select className={inputClass} value={value.currency} onChange={set('currency')}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
      </Field>
      <Field label="Pressing you’re after" hint="Color, country, catalog number…" error={errors.desiredPressingNotes} className="sm:col-span-2">
        <input className={inputClass} value={value.desiredPressingNotes} onChange={set('desiredPressingNotes')} />
      </Field>
      <Field label="Notes" error={errors.notes} className="sm:col-span-2">
        <input className={inputClass} value={value.notes} onChange={set('notes')} />
      </Field>
    </div>
  )
}
