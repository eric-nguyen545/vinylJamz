import { CONDITIONS, FORMATS, type CopyFormState, type FormErrors } from '../lib/formState'
import { Field, inputClass } from './Field'

interface Props { value: CopyFormState; errors: FormErrors; onChange: (v: CopyFormState) => void; locations?: { id: string; name: string }[] }
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'VND']

export function PressingForm({ value, errors, onChange, locations = [] }: Props) {
  const set = (k: keyof CopyFormState) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value })
  return (
    <div className="flex flex-col gap-8">
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-3 font-display text-lg font-medium">Pressing</legend>
        <Field label="Format" error={errors.format}>
          <select className={inputClass} value={value.format} onChange={set('format')}>{FORMATS.map((f) => <option key={f}>{f}</option>)}</select>
        </Field>
        <Field label="Vinyl color or variant" error={errors.vinylColor}><input className={inputClass} value={value.vinylColor} onChange={set('vinylColor')} /></Field>
        <Field label="Discs" error={errors.discCount}><input className={inputClass} inputMode="numeric" value={value.discCount} onChange={set('discCount')} /></Field>
        <Field label="Pressing year" error={errors.pressingYear}><input className={inputClass} inputMode="numeric" value={value.pressingYear} onChange={set('pressingYear')} /></Field>
        <Field label="Country" error={errors.releaseCountry}><input className={inputClass} value={value.releaseCountry} onChange={set('releaseCountry')} /></Field>
        <Field label="Label" error={errors.label}><input className={inputClass} value={value.label} onChange={set('label')} /></Field>
        <Field label="Catalog number" error={errors.catalogNumber}><input className={inputClass} value={value.catalogNumber} onChange={set('catalogNumber')} /></Field>
        <Field label="Barcode" error={errors.barcode}><input className={inputClass} value={value.barcode} onChange={set('barcode')} /></Field>
        <Field label="Record condition" error={errors.recordCondition}>
          <select className={inputClass} value={value.recordCondition} onChange={set('recordCondition')}>
            <option value="">Not graded</option>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Sleeve condition" error={errors.sleeveCondition}>
          <select className={inputClass} value={value.sleeveCondition} onChange={set('sleeveCondition')}>
            <option value="">Not graded</option>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Edition notes" error={errors.editionNotes} className="sm:col-span-2 lg:col-span-3">
          <input className={inputClass} value={value.editionNotes} onChange={set('editionNotes')} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-3 font-display text-lg font-medium">Purchase <span className="font-sans text-sm font-normal text-dust">(private, never shown publicly)</span></legend>
        <Field label="Date bought" error={errors.purchaseDate}><input className={inputClass} type="date" value={value.purchaseDate} onChange={set('purchaseDate')} /></Field>
        <Field label="Price paid" error={errors.purchasePrice}><input className={inputClass} inputMode="decimal" value={value.purchasePrice} onChange={set('purchasePrice')} /></Field>
        <Field label="Currency" error={errors.currency}>
          <select className={inputClass} value={value.currency} onChange={set('currency')}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Seller or store" error={errors.seller}><input className={inputClass} value={value.seller} onChange={set('seller')} /></Field>
        {locations.length > 0 && (
          <Field label="Purchase location" error={errors.purchaseLocationId} hint="Add places on the Map page.">
            <select className={inputClass} value={value.purchaseLocationId} onChange={set('purchaseLocationId')}>
              <option value="">None</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Private notes" error={errors.privateNotes} className="sm:col-span-2">
          <textarea className={inputClass} rows={2} value={value.privateNotes} onChange={set('privateNotes')} />
        </Field>
      </fieldset>
    </div>
  )
}
