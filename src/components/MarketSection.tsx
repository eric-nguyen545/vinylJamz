import { useCallback, useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { getFirebase } from '../firebase/config'
import type { StoredAlbum, StoredCopy } from '../lib/albumsRepo'
import type { FormErrors } from '../lib/formState'
import { formatDay } from '../lib/format'
import { TYPE_HELP, TYPE_LABEL, TYPE_PREFERENCE, latestByType } from '../lib/pricing'
import { emptyPriceForm, formToObservation, type PriceFormState } from '../lib/priceForm'
import { createObservation, deleteObservation, listObservationsForAlbum, type StoredObservation } from '../lib/pricingRepo'
import { spendingTotals } from '../lib/stats'
import { authFromSettings } from '../lib/providers/discogs'
import { usePricingSettings } from '../lib/usePricingSettings'
import { ConfirmDialog } from './ConfirmDialog'
import { DiscogsPanel } from './DiscogsPanel'
import { PriceObservationForm } from './PriceObservationForm'
import { EmptyState, ErrorState } from './States'

const money = (n: number, c: string) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n) } catch { return `${n} ${c}` } }

interface Props { uid: string; album: StoredAlbum; copies: StoredCopy[]; defaultCurrency: string; onAlbumChanged: () => Promise<void> | void }

export function MarketSection({ uid, album, copies, defaultCurrency, onAlbumChanged }: Props) {
  const { db } = getFirebase()
  const { settings } = usePricingSettings(uid)
  const discogsAuth = useMemo(() => authFromSettings(settings), [settings])
  const [obs, setObs] = useState<StoredObservation[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<PriceFormState>(emptyPriceForm(defaultCurrency))
  const [errors, setErrors] = useState<FormErrors>({})
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<StoredObservation | null>(null)

  const load = useCallback(async () => {
    try { setObs(await listObservationsForAlbum(db, uid, album.id)); setError(null) } catch (e) { setError(e instanceof Error ? e.message : 'Could not load prices.') }
  }, [db, uid, album.id])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const latest = useMemo(() => latestByType(obs ?? []), [obs])
  const paid = useMemo(() => spendingTotals(copies), [copies])

  async function save() {
    const r = formToObservation(form, album.id)
    setErrors(r.ok ? {} : r.errors)
    if (!r.ok) return
    setBusy(true)
    try { await createObservation(db, uid, r.value); setAdding(false); await load() } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.') } finally { setBusy(false) }
  }

  const shown = TYPE_PREFERENCE.filter((t) => latest[t])

  return (
    <section aria-labelledby="market-h" className="mt-12">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="market-h" className="text-2xl font-bold">Market and value</h2>
        {!adding && <button onClick={() => { setForm(emptyPriceForm(defaultCurrency)); setErrors({}); setAdding(true) }} className="rounded-lg bg-sleeve-hi px-4 py-2 font-medium hover:bg-groove">Record a price</button>}
      </div>
      <p className="mb-4 max-w-2xl text-sm text-dust">Prices here are observations someone recorded on a date. Asking prices, sold prices and estimates are different things and are never averaged together.</p>
      {error && <div className="mb-4"><ErrorState message={error} onRetry={() => void load()} /></div>}

      {adding && <PriceObservationForm value={form} errors={errors} copies={copies} busy={busy} onChange={setForm} onSubmit={() => void save()} onCancel={() => setAdding(false)} />}

      {paid.length > 0 && <p className="mb-4 text-sm">You paid {paid.map((p) => `${money(p.total, p.currency)} for ${p.copies} ${p.copies === 1 ? 'copy' : 'copies'}`).join(' and ')}.</p>}

      {obs && shown.length === 0 && <EmptyState title="No prices recorded">Record a sold price, an asking price or an estimate to track what this album is worth.</EmptyState>}
      {shown.length > 0 && (
        <dl className="grid gap-3 sm:grid-cols-3">
          {shown.map((t) => { const o = latest[t]!; return (
            <div key={t} className="rounded-2xl bg-sleeve p-4">
              <dt className="text-sm text-dust">Latest {TYPE_LABEL[t].toLowerCase()}</dt>
              <dd className="mt-1 font-display text-2xl font-bold">{money(o.price, o.currency)}</dd>
              <dd className="text-xs text-dust">{formatDay(o.observedAt)}, {o.provider}{o.condition ? `, ${o.condition}` : ''}</dd>
              <dd className="mt-1 text-xs text-dust">{TYPE_HELP[t]}</dd>
            </div>) })}
        </dl>
      )}

      {obs && obs.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-dust">Price history ({obs.length})</summary>
          <ul className="mt-2 divide-y divide-groove rounded-xl bg-sleeve text-sm">
            {obs.slice(0, 20).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
                <span className="w-24 text-dust">{formatDay(o.observedAt)}</span>
                <span className="font-medium">{money(o.price, o.currency)}</span>
                <span>{TYPE_LABEL[o.observationType]}</span>
                <span className="text-dust">{o.provider}{o.copyId ? ', specific copy' : ''}</span>
                {o.sourceUrl && <a href={o.sourceUrl} target="_blank" rel="noreferrer" className="text-label underline underline-offset-4">source</a>}
                <button onClick={() => setConfirm(o)} aria-label={`Delete ${money(o.price, o.currency)} price from ${formatDay(o.observedAt)}`} className="ml-auto rounded-md p-1.5 text-bad hover:bg-sleeve-hi"><Trash2 aria-hidden className="size-4" /></button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-6">
        <DiscogsPanel uid={uid} album={album} auth={discogsAuth} currency={defaultCurrency} onChanged={async () => { await load(); await onAlbumChanged() }} />
      </div>

      <ConfirmDialog open={confirm !== null} title="Delete this price?" confirmLabel="Delete price" destructive busy={busy} onCancel={() => setConfirm(null)}
        onConfirm={() => { if (!confirm) return; setBusy(true); void deleteObservation(db, uid, confirm.id).then(async () => { setConfirm(null); await load() }).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not delete.')).finally(() => setBusy(false)) }}>
        This removes the recorded price only.
      </ConfirmDialog>
    </section>
  )
}
