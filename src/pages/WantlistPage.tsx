import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '../app/AuthContext'
import { AlbumArtwork } from '../components/AlbumArtwork'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PageHeader } from '../components/PageHeader'
import { PressingForm } from '../components/PressingForm'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { WantlistFields } from '../components/WantlistFields'
import { getFirebase } from '../firebase/config'
import { copyToForm, formToCopy, type CopyFormState, type FormErrors } from '../lib/formState'
import { ACTIVE_WANT_STATUSES } from '../lib/schemas'
import { usePreferences } from '../lib/usePreferences'
import { usePurchaseLocations } from '../lib/useLocations'
import { PRIORITY_LABEL, PRIORITY_RANK, STATUS_LABEL, formToWant, wantToForm, type WantFormState } from '../lib/wantlistForm'
import { deleteWantlistItem, listWantlist, purchaseWantlistItem, updateWantlistItem, type StoredWant } from '../lib/wantlistRepo'

type Filter = 'active' | 'purchased' | 'passed' | 'all'
type Panel = { id: string; mode: 'edit'; form: WantFormState } | { id: string; mode: 'buy'; form: CopyFormState } | null

const money = (n: number, c?: string) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c ?? 'USD' }).format(n) } catch { return `${n} ${c ?? ''}` } }

export function WantlistPage() {
  const { state } = useAuth()
  if (state.status !== 'owner') return null
  return <WantlistBody uid={state.user.uid} />
}

function WantlistBody({ uid }: { uid: string }) {
  const navigate = useNavigate()
  const prefs = usePreferences(uid)
  const { locations } = usePurchaseLocations(uid)
  const { db } = getFirebase()
  const [items, setItems] = useState<StoredWant[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('active')
  const [panel, setPanel] = useState<Panel>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<StoredWant | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try { setItems(await listWantlist(db, uid)) } catch (e) { setError(e instanceof Error ? e.message : 'Could not load your wantlist.') }
  }, [db, uid])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const shown = useMemo(() => {
    const keep = (w: StoredWant) =>
      filter === 'all' ? true : filter === 'active' ? ACTIVE_WANT_STATUSES.includes(w.status) : filter === 'purchased' ? w.status === 'purchased' : w.status === 'no-longer-interested'
    return (items ?? []).filter(keep).sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority])
  }, [items, filter])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setActionError(null)
    try { await fn() } catch (e) { setActionError(e instanceof Error ? e.message : 'That action failed.') } finally { setBusy(false) }
  }

  async function saveEdit(w: StoredWant, form: WantFormState) {
    const r = formToWant(form)
    setErrors(r.ok ? {} : r.errors)
    if (!r.ok) return
    await run(async () => { await updateWantlistItem(db, uid, w.id, r.value); setPanel(null); await load() })
  }

  async function saveBuy(w: StoredWant, form: CopyFormState) {
    const r = formToCopy(form)
    setErrors(r.ok ? {} : r.errors)
    if (!r.ok) return
    await run(async () => { await purchaseWantlistItem(db, uid, w.id, w.albumId, r.value); navigate(`/collection/${w.albumId}`) })
  }

  const add = (
    <Link to="/collection/add?dest=wantlist" className="inline-flex items-center gap-2 rounded-lg bg-label px-4 py-2 font-semibold text-label-ink">
      <Plus aria-hidden className="size-4" /> Add to wantlist
    </Link>
  )

  return (
    <>
      <PageHeader title="Wantlist" description="Records you’re hunting for, highest priority first." actions={add} />
      <label className="mb-6 flex items-center gap-2 text-sm">
        Show
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="rounded-lg border border-groove bg-sleeve px-3 py-2">
          <option value="active">Still hunting</option>
          <option value="purchased">Purchased</option>
          <option value="passed">No longer interested</option>
          <option value="all">Everything</option>
        </select>
      </label>

      {actionError && <div className="mb-6"><ErrorState message={actionError} /></div>}
      {error && <ErrorState title="Couldn’t load your wantlist" message={error} onRetry={() => void load()} />}
      {!error && !items && <LoadingState label="Loading your wantlist" />}
      {items && shown.length === 0 && (
        <EmptyState title={items.length === 0 ? 'Your wantlist is empty' : 'Nothing here'} action={items.length === 0 ? add : undefined}>
          {items.length === 0 ? 'Add records you want to track down, with a target price and the pressing you’re after.' : 'No items match this filter.'}
        </EmptyState>
      )}

      <ul className="flex flex-col gap-4">
        {shown.map((w) => {
          const open = panel?.id === w.id ? panel : null
          return (
            <li key={w.id} className="rounded-2xl bg-sleeve p-4">
              <div className="flex gap-4">
                <AlbumArtwork url={w.artworkUrl} title={w.albumTitle ?? 'Album'} artist={w.primaryArtist ?? ''} className="w-24 shrink-0 self-start rounded" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-medium">{w.albumTitle ?? 'Untitled album'}</h2>
                      <p className="truncate text-dust">{w.primaryArtist}{w.releaseYear ? `, ${w.releaseYear}` : ''}</p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className={`rounded-full px-2.5 py-1 font-semibold ${w.priority === 'high' ? 'bg-label text-label-ink' : 'bg-sleeve-hi'}`}>{PRIORITY_LABEL[w.priority]} priority</span>
                      <span className="rounded-full bg-sleeve-hi px-2.5 py-1">{STATUS_LABEL[w.status]}</span>
                    </div>
                  </div>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
                    {w.targetPrice !== undefined && <><dt className="text-dust">Target</dt><dd>{money(w.targetPrice, w.currency)}</dd></>}
                    {w.desiredPressingNotes && <><dt className="text-dust">Pressing</dt><dd>{w.desiredPressingNotes}</dd></>}
                    {w.notes && <><dt className="text-dust">Notes</dt><dd>{w.notes}</dd></>}
                  </dl>
                  {!open && (
                    <div className="mt-3 flex flex-wrap gap-2 text-sm">
                      {w.status === 'purchased'
                        ? <Link to={`/collection/${w.albumId}`} className="rounded-lg bg-sleeve-hi px-3 py-1.5 font-medium hover:bg-groove">View in collection</Link>
                        : <button onClick={() => { setErrors({}); setPanel({ id: w.id, mode: 'buy', form: copyToForm({ releaseId: w.desiredReleaseId, format: 'LP' }, w.currency ?? prefs.defaultCurrency) }) }} className="rounded-lg bg-label px-3 py-1.5 font-semibold text-label-ink">I bought it</button>}
                      {w.status !== 'purchased' && <button onClick={() => { setErrors({}); setPanel({ id: w.id, mode: 'edit', form: wantToForm(w, prefs.defaultCurrency) }) }} className="rounded-lg bg-sleeve-hi px-3 py-1.5 font-medium hover:bg-groove">Edit</button>}
                      <button onClick={() => setConfirm(w)} className="rounded-lg px-3 py-1.5 font-medium text-bad hover:bg-sleeve-hi">Remove</button>
                    </div>
                  )}
                </div>
              </div>

              {open?.mode === 'edit' && (
                <form onSubmit={(e) => { e.preventDefault(); void saveEdit(w, open.form) }} className="mt-4 border-t border-groove pt-4">
                  <WantlistFields value={open.form} errors={errors} showStatus onChange={(form) => setPanel({ id: w.id, mode: 'edit', form })} />
                  <div className="mt-4 flex gap-3">
                    <button type="submit" disabled={busy} className="rounded-lg bg-label px-4 py-2 font-semibold text-label-ink disabled:opacity-50">{busy ? 'Saving…' : 'Save changes'}</button>
                    <button type="button" onClick={() => setPanel(null)} className="rounded-lg bg-sleeve-hi px-4 py-2 font-medium hover:bg-groove">Cancel</button>
                  </div>
                </form>
              )}

              {open?.mode === 'buy' && (
                <form onSubmit={(e) => { e.preventDefault(); void saveBuy(w, open.form) }} className="mt-4 border-t border-groove pt-4">
                  <h3 className="mb-1 text-lg font-medium">Add it to your collection</h3>
                  <p className="mb-4 text-sm text-dust">Confirm the pressing you actually received, then add what you paid.</p>
                  <PressingForm value={open.form} errors={errors} locations={locations} onChange={(form) => setPanel({ id: w.id, mode: 'buy', form })} />
                  <div className="mt-6 flex gap-3">
                    <button type="submit" disabled={busy} className="rounded-lg bg-label px-4 py-2 font-semibold text-label-ink disabled:opacity-50">{busy ? 'Saving…' : 'Add to collection'}</button>
                    <button type="button" onClick={() => setPanel(null)} className="rounded-lg bg-sleeve-hi px-4 py-2 font-medium hover:bg-groove">Cancel</button>
                  </div>
                </form>
              )}
            </li>
          )
        })}
      </ul>

      <ConfirmDialog open={confirm !== null} title="Remove from wantlist?" confirmLabel="Remove" destructive busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void run(async () => { if (confirm) await deleteWantlistItem(db, uid, confirm); setConfirm(null); await load() })}>
        {confirm?.status === 'purchased'
          ? 'This removes the wantlist record only. The copy in your collection stays.'
          : `“${confirm?.albumTitle ?? 'This album'}” will be removed from your wantlist.`}
      </ConfirmDialog>
    </>
  )
}
