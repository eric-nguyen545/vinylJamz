import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../app/AuthContext'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Field, inputClass } from '../components/Field'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { getFirebase } from '../firebase/config'
import { formatDay } from '../lib/format'
import { GEAR_CATEGORIES, GEAR_CATEGORY_LABEL, emptyGearForm, formToGear, gearToForm, type GearFormState } from '../lib/gearForm'
import { createGear, deleteGear, listGear, updateGear, type StoredGear } from '../lib/gearRepo'
import type { FormErrors } from '../lib/formState'
import { GEAR_CONDITIONS, type GearCategory } from '../lib/schemas'
import { gearByCategory, gearWithoutPrice, investmentTotals } from '../lib/stats'
import { usePreferences } from '../lib/usePreferences'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'VND']
const money = (n: number, c: string) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n) } catch { return `${n} ${c}` } }

export function GearPage() {
  const { state } = useAuth()
  if (state.status !== 'owner') return null
  return <GearBody uid={state.user.uid} />
}

type Editing = { kind: 'new' } | { kind: 'edit'; item: StoredGear } | null

function GearBody({ uid }: { uid: string }) {
  const { db } = getFirebase()
  const prefs = usePreferences(uid)
  const [items, setItems] = useState<StoredGear[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [form, setForm] = useState<GearFormState>(emptyGearForm())
  const [errors, setErrors] = useState<FormErrors>({})
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<'all' | GearCategory>('all')
  const [confirm, setConfirm] = useState<StoredGear | null>(null)
  const [currency, setCurrency] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try { setItems(await listGear(db, uid)) } catch (e) { setError(e instanceof Error ? e.message : 'Could not load your gear.') }
  }, [db, uid])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const totals = useMemo(() => investmentTotals([], items ?? []).filter((r) => r.gearItems > 0), [items])
  const cur = currency && totals.some((t) => t.currency === currency) ? currency : totals[0]?.currency
  const cats = useMemo(() => (cur ? gearByCategory(items ?? [], cur) : []), [items, cur])
  const shown = useMemo(
    () => (items ?? []).filter((g) => filter === 'all' || g.category === filter).sort((a, b) => (b.purchaseDate ?? '').localeCompare(a.purchaseDate ?? '') || a.name.localeCompare(b.name)),
    [items, filter],
  )

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setActionError(null)
    try { await fn() } catch (e) { setActionError(e instanceof Error ? e.message : 'That action failed.') } finally { setBusy(false) }
  }

  function open(e: Editing) {
    setEditing(e); setErrors({})
    setForm(e?.kind === 'edit' ? gearToForm(e.item, prefs.defaultCurrency) : emptyGearForm(prefs.defaultCurrency))
  }

  const save = () => {
    const r = formToGear(form)
    setErrors(r.ok ? {} : r.errors)
    if (!r.ok || !editing) return Promise.resolve()
    return run(async () => {
      if (editing.kind === 'new') await createGear(db, uid, r.value)
      else await updateGear(db, uid, editing.item.id, r.value)
      setEditing(null); await load()
    })
  }

  const set = (k: keyof GearFormState) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value } as GearFormState)
  const add = <button onClick={() => open({ kind: 'new' })} className="inline-flex items-center gap-2 rounded-lg bg-label px-4 py-2 font-semibold text-label-ink"><Plus aria-hidden className="size-4" /> Add gear</button>

  return (
    <>
      <PageHeader title="Gear" description="Turntable, speakers, cartridge and everything else that isn’t a record. Costs here count toward your total invested on the Statistics page." actions={add} />
      {actionError && <div className="mb-4"><ErrorState message={actionError} /></div>}
      {error && <ErrorState title="Couldn’t load your gear" message={error} onRetry={() => void load()} />}
      {!error && !items && <LoadingState label="Loading your gear" />}

      {items && totals.length > 0 && (
        <section aria-labelledby="gear-total-h" className="mb-8 rounded-2xl bg-sleeve p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="gear-total-h" className="text-xl font-medium">Spent on gear</h2>
            {totals.length > 1 && (
              <label className="flex items-center gap-2 text-sm">Currency
                <select value={cur} onChange={(e) => setCurrency(e.target.value)} className="rounded-lg border border-groove bg-sleeve-hi px-3 py-1.5">{totals.map((t) => <option key={t.currency}>{t.currency}</option>)}</select>
              </label>
            )}
          </div>
          {cur && <p className="mt-1 font-display text-4xl font-bold">{money(totals.find((t) => t.currency === cur)!.gear, cur)}</p>}
          <p className="text-sm text-dust">{totals.find((t) => t.currency === cur)?.gearItems} priced {totals.find((t) => t.currency === cur)?.gearItems === 1 ? 'item' : 'items'}{gearWithoutPrice(items) > 0 ? `. ${gearWithoutPrice(items)} without a price ${gearWithoutPrice(items) === 1 ? 'is' : 'are'} not counted` : ''}. Currencies are never converted.</p>
          {cats.length > 0 && (
            <ul className="mt-4 divide-y divide-groove text-sm">
              {cats.map((c) => <li key={c.category} className="flex justify-between py-1.5"><span>{GEAR_CATEGORY_LABEL[c.category as GearCategory] ?? c.category} <span className="text-dust">({c.items})</span></span><span>{money(c.total, cur!)}</span></li>)}
            </ul>
          )}
        </section>
      )}

      {editing && (
        <form onSubmit={(e) => { e.preventDefault(); void save() }} className="mb-8 flex flex-col gap-4 rounded-2xl border border-groove p-5">
          <h2 className="text-xl font-medium">{editing.kind === 'new' ? 'Add gear' : 'Edit gear'}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name" error={errors.name} className="lg:col-span-2"><input className={inputClass} value={form.name} onChange={set('name')} placeholder="e.g. Rega Planar 3" required /></Field>
            <Field label="Category" error={errors.category}>
              <select className={inputClass} value={form.category} onChange={set('category')}>{GEAR_CATEGORIES.map((c) => <option key={c} value={c}>{GEAR_CATEGORY_LABEL[c]}</option>)}</select>
            </Field>
            <Field label="Brand" error={errors.brand}><input className={inputClass} value={form.brand} onChange={set('brand')} /></Field>
            <Field label="Model" error={errors.model}><input className={inputClass} value={form.model} onChange={set('model')} /></Field>
            <Field label="Condition" error={errors.condition}>
              <select className={inputClass} value={form.condition} onChange={set('condition')}><option value="">Not set</option>{GEAR_CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select>
            </Field>
            <Field label="Date bought" error={errors.purchaseDate}><input className={inputClass} type="date" value={form.purchaseDate} onChange={set('purchaseDate')} /></Field>
            <Field label="Price paid" hint="Include tax and shipping if you want the true cost." error={errors.purchasePrice}><input className={inputClass} inputMode="decimal" value={form.purchasePrice} onChange={set('purchasePrice')} /></Field>
            <Field label="Currency" error={errors.currency}>
              <select className={inputClass} value={form.currency} onChange={set('currency')}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
            </Field>
            <Field label="Seller or store" error={errors.seller}><input className={inputClass} value={form.seller} onChange={set('seller')} /></Field>
            <Field label="Notes" error={errors.notes} className="sm:col-span-2"><input className={inputClass} value={form.notes} onChange={set('notes')} /></Field>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={busy} className="rounded-lg bg-label px-5 py-2 font-semibold text-label-ink disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-lg bg-sleeve-hi px-5 py-2 font-medium hover:bg-groove">Cancel</button>
          </div>
        </form>
      )}

      {items && items.length === 0 && !editing && <EmptyState title="No gear yet" action={add}>Add your turntable, speakers, cartridge, cables and accessories to see what your whole setup has cost.</EmptyState>}

      {items && items.length > 0 && (
        <>
          <label className="mb-4 flex items-center gap-2 text-sm">Show
            <select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | GearCategory)} className="rounded-lg border border-groove bg-sleeve px-3 py-2">
              <option value="all">All gear ({items.length})</option>
              {GEAR_CATEGORIES.filter((c) => items.some((g) => g.category === c)).map((c) => <option key={c} value={c}>{GEAR_CATEGORY_LABEL[c]}</option>)}
            </select>
          </label>
          <ul className="grid gap-3 md:grid-cols-2">
            {shown.map((g) => (
              <li key={g.id} className="rounded-2xl bg-sleeve p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-medium">{g.name}</h3>
                    <p className="text-sm text-dust">{GEAR_CATEGORY_LABEL[g.category]}{g.brand || g.model ? `, ${[g.brand, g.model].filter(Boolean).join(' ')}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => open({ kind: 'edit', item: g })} aria-label={`Edit ${g.name}`} className="rounded-md p-2 hover:bg-sleeve-hi"><Pencil aria-hidden className="size-4" /></button>
                    <button onClick={() => setConfirm(g)} aria-label={`Delete ${g.name}`} className="rounded-md p-2 text-bad hover:bg-sleeve-hi"><Trash2 aria-hidden className="size-4" /></button>
                  </div>
                </div>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
                  {g.purchasePrice !== undefined && g.currency && <><dt className="text-dust">Paid</dt><dd>{money(g.purchasePrice, g.currency)}</dd></>}
                  {g.purchaseDate && <><dt className="text-dust">Bought</dt><dd>{formatDay(g.purchaseDate)}</dd></>}
                  {g.condition && <><dt className="text-dust">Condition</dt><dd className="capitalize">{g.condition}</dd></>}
                  {g.seller && <><dt className="text-dust">From</dt><dd>{g.seller}</dd></>}
                  {g.notes && <><dt className="text-dust">Notes</dt><dd>{g.notes}</dd></>}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmDialog open={confirm !== null} title="Delete this gear?" confirmLabel="Delete" destructive busy={busy} onCancel={() => setConfirm(null)}
        onConfirm={() => void run(async () => { if (confirm) await deleteGear(db, uid, confirm.id); setConfirm(null); await load() })}>
        “{confirm?.name}” will be removed, and its cost will no longer count toward your totals.
      </ConfirmDialog>
    </>
  )
}
