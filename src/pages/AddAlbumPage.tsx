import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import { PageHeader } from '../components/PageHeader'
import { ErrorState, LoadingState } from '../components/States'
import { AlbumArtwork } from '../components/AlbumArtwork'
import { AlbumMetadataForm } from '../components/AlbumMetadataForm'
import { PressingForm } from '../components/PressingForm'
import { WantlistFields } from '../components/WantlistFields'
import { Field, inputClass } from '../components/Field'
import { getFirebase } from '../firebase/config'
import { AlbumExistsError, addCopy, createAlbum, findDuplicates } from '../lib/albumsRepo'
import {
  copyToForm, draftToForm, emptyAlbumBase, emptyAlbumForm, formToAlbum, formToCopy,
  type AlbumBase, type AlbumFormState, type CopyFormState, type FormErrors,
} from '../lib/formState'
import { makeNormalizedKey, type DuplicateMatch } from '../lib/normalize'
import { authFromSettings } from '../lib/providers/discogs'
import { createCatalogProvider } from '../lib/providers/fallback'
import { ProviderError, type AlbumSearchResult, type ProviderSource, type ReleaseCandidate, type SearchMode } from '../lib/providers/types'
import { usePricingSettings } from '../lib/usePricingSettings'
import { usePreferences } from '../lib/usePreferences'
import { usePurchaseLocations } from '../lib/useLocations'
import { emptyWantForm, formToWant, type WantFormState } from '../lib/wantlistForm'
import { WantlistExistsError, createWantlistEntry } from '../lib/wantlistRepo'

type Step =
  | { name: 'search' }
  | { name: 'releases'; group: AlbumSearchResult; candidates: ReleaseCandidate[] }
  | { name: 'confirm' }

const errMsg = (e: unknown) => (e instanceof ProviderError || e instanceof Error ? e.message : 'Something went wrong.')

export function AddAlbumPage() {
  const { state } = useAuth()
  if (state.status !== 'owner') return null
  return <AddAlbum uid={state.user.uid} />
}

function AddAlbum({ uid }: { uid: string }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const prefs = usePreferences(uid)
  const { locations } = usePurchaseLocations(uid)
  const { settings: discogsSettings } = usePricingSettings(uid)
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null)
  const discogsAuth = useMemo(() => authFromSettings(discogsSettings), [discogsSettings])
  // Discogs first when credentials exist, MusicBrainz and Cover Art Archive as backup.
  const provider = useMemo(() => createCatalogProvider(discogsAuth, setFallbackNotice), [discogsAuth])
  const [dest, setDest] = useState<'owned' | 'wantlist'>(params.get('dest') === 'wantlist' ? 'wantlist' : 'owned')
  const [wantForm, setWantForm] = useState<WantFormState | null>(null)
  const [wantErrors, setWantErrors] = useState<FormErrors>({})
  const [step, setStep] = useState<Step>({ name: 'search' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // search
  const [mode, setMode] = useState<SearchMode>('text')
  const [text, setText] = useState('')
  const [results, setResults] = useState<AlbumSearchResult[] | null>(null)

  // confirm
  const [albumForm, setAlbumForm] = useState<AlbumFormState>(emptyAlbumForm())
  const [base, setBase] = useState<AlbumBase>(emptyAlbumBase())
  const [copyForm, setCopyForm] = useState<CopyFormState | null>(null)
  const [albumErrors, setAlbumErrors] = useState<FormErrors>({})
  const [copyErrors, setCopyErrors] = useState<FormErrors>({})
  const [dupes, setDupes] = useState<DuplicateMatch[]>([])
  const [checkedKey, setCheckedKey] = useState<string | null>(null)

  const { db } = getFirebase()
  const currentCopy = copyForm ?? copyToForm({}, prefs.defaultCurrency)
  const currentWant: WantFormState = { ...(wantForm ?? emptyWantForm(prefs.defaultCurrency)), desiredReleaseId: (wantForm ?? emptyWantForm()).desiredReleaseId || currentCopy.releaseId }

  async function runSearch(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setResults(null); setFallbackNotice(null)
    try { setResults(await provider.searchAlbums(text, mode)) } catch (err) { setError(errMsg(err)) } finally { setBusy(false) }
  }

  function startManual(prefill?: Partial<AlbumFormState>) {
    setAlbumForm({ ...emptyAlbumForm(), ...prefill }); setBase(emptyAlbumBase())
    setCopyForm(copyToForm({}, prefs.defaultCurrency)); setDupes([]); setCheckedKey(null); setAlbumErrors({}); setCopyErrors({})
    setStep({ name: 'confirm' })
  }

  async function openRelease(releaseId: string, source: ProviderSource, useCopyDefaults: boolean) {
    setBusy(true); setError(null)
    try {
      const details = await provider.getRelease(releaseId, source)
      if (!details) { setError('That release is missing a title or artist. Enter it manually instead.'); return }
      const { form, base: b } = draftToForm(details.album)
      setAlbumForm(form); setBase(b)
      setCopyForm(copyToForm(useCopyDefaults ? details.copyDefaults : {}, prefs.defaultCurrency))
      setAlbumErrors({}); setCopyErrors({})
      const d = await findDuplicates(db, uid, { ...details.album })
      setDupes(d); setCheckedKey(makeNormalizedKey(details.album.primaryArtist, details.album.title))
      setStep({ name: 'confirm' })
    } catch (err) { setError(errMsg(err)) } finally { setBusy(false) }
  }

  async function pick(r: AlbumSearchResult) {
    if (r.kind === 'release') return openRelease(r.id, r.source, true)
    setBusy(true); setError(null)
    try {
      const candidates = await provider.getReleaseCandidates(r.id, r.source)
      if (!candidates.length) { startManual({ title: r.title, artists: r.artistNames.join(', '), year: r.year ? String(r.year) : '' }); return }
      setStep({ name: 'releases', group: r, candidates })
    } catch (err) { setError(errMsg(err)) } finally { setBusy(false) }
  }

  async function save(addAnyway = false) {
    setError(null)
    const a = formToAlbum(albumForm, base)
    const c = formToCopy(currentCopy)
    setAlbumErrors(a.ok ? {} : a.errors); setCopyErrors(c.ok ? {} : c.errors)
    if (!a.ok || !c.ok) return
    setBusy(true)
    try {
      const key = makeNormalizedKey(a.value.primaryArtist, a.value.title)
      if (!addAnyway && key !== checkedKey) {
        const d = await findDuplicates(db, uid, a.value)
        setCheckedKey(key); setDupes(d)
        if (d.length) return
      } else if (!addAnyway && dupes.length) return
      const { albumId } = await createAlbum(db, uid, a.value, c.value)
      navigate(`/collection/${albumId}`)
    } catch (err) {
      if (err instanceof AlbumExistsError) setDupes([{ match: 'provider-id', album: { id: err.albumId, title: a.ok ? a.value.title : '', primaryArtist: a.ok ? a.value.primaryArtist : '' } }])
      else setError(errMsg(err))
    } finally { setBusy(false) }
  }

  async function saveWant(existingAlbumId?: string, addAnyway = false) {
    setError(null)
    const a = formToAlbum(albumForm, base)
    const w = formToWant(currentWant)
    setAlbumErrors(a.ok ? {} : a.errors); setWantErrors(w.ok ? {} : w.errors)
    if (!a.ok || !w.ok) return
    setBusy(true)
    try {
      const key = makeNormalizedKey(a.value.primaryArtist, a.value.title)
      if (!existingAlbumId && !addAnyway) {
        if (key !== checkedKey) {
          const d = await findDuplicates(db, uid, a.value)
          setCheckedKey(key); setDupes(d)
          if (d.length) return
        } else if (dupes.length) return
      }
      await createWantlistEntry(db, uid, a.value, w.value, existingAlbumId)
      navigate('/wantlist')
    } catch (err) {
      setError(err instanceof WantlistExistsError || err instanceof Error ? err.message : 'Something went wrong.')
    } finally { setBusy(false) }
  }

  async function addToExisting(albumId: string) {
    const c = formToCopy(currentCopy)
    setCopyErrors(c.ok ? {} : c.errors)
    if (!c.ok) return
    setBusy(true); setError(null)
    try { await addCopy(db, uid, albumId, c.value); navigate(`/collection/${albumId}`) } catch (err) { setError(errMsg(err)) } finally { setBusy(false) }
  }

  const hasProviderMatch = dupes.some((d) => d.match === 'provider-id')

  return (
    <>
      <PageHeader title="Add album" description="Find the album, pick the exact pressing, then confirm the details." />
      {error && <div className="mb-6"><ErrorState title="Couldn’t complete that" message={error} /></div>}

      {step.name === 'search' && (
        <section aria-labelledby="search-h">
          <h2 id="search-h" className="sr-only">Search</h2>
          <form onSubmit={(e) => void runSearch(e)} className="flex flex-wrap items-end gap-3">
            <Field label="Search by">
              <select className={inputClass} value={mode} onChange={(e) => setMode(e.target.value as SearchMode)}>
                <option value="text">Album or artist</option>
                <option value="barcode">Barcode</option>
                <option value="catalog">Catalog number</option>
              </select>
            </Field>
            <Field label="Search" className="min-w-64 flex-1">
              <input className={inputClass} value={text} onChange={(e) => setText(e.target.value)} required />
            </Field>
            <button type="submit" disabled={busy || discogsSettings === null} className="rounded-lg bg-label px-5 py-2.5 font-semibold text-label-ink disabled:opacity-50">Search</button>
          </form>
          <p className="mt-3 text-sm text-dust">
            {discogsAuth
              ? 'Searching Discogs first, with MusicBrainz and Cover Art Archive as backup.'
              : <>Discogs isn’t connected, so searches use MusicBrainz and Cover Art Archive. Add your Discogs credentials in <Link to="/settings" className="text-label underline underline-offset-4">Settings</Link> to search Discogs first.</>}
            {' '}Camera scanning isn’t available yet; type the barcode number instead.
          </p>
          {fallbackNotice && <p role="status" className="mt-3 rounded-lg border border-warn/40 bg-warn/10 p-3 text-sm">{fallbackNotice}</p>}
          {busy && <div className="mt-6"><LoadingState label={discogsAuth ? 'Searching Discogs' : 'Searching MusicBrainz'} /></div>}
          {results && !busy && (
            results.length === 0
              ? <p className="mt-6 text-dust">No matches. Try fewer words, or enter the album by hand.</p>
              : (
                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {results.map((r) => (
                    <li key={`${r.kind}-${r.id}`}>
                      <button onClick={() => void pick(r)} className="flex w-full items-center gap-4 rounded-xl bg-sleeve p-3 text-left hover:bg-sleeve-hi">
                        <AlbumArtwork url={r.artworkUrl} title={r.title} artist={r.artistNames.join(', ')} className="w-20 shrink-0 rounded" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{r.title}</span>
                          <span className="block truncate text-sm text-dust">{r.artistNames.join(', ')}{r.year ? `, ${r.year}` : ''}</span>
                          <span className="mt-0.5 inline-block rounded bg-groove px-1.5 py-0.5 text-[11px] text-dust">{r.source === 'discogs' ? 'Discogs' : 'MusicBrainz'}</span>
                          {r.kind === 'release' && <span className="block truncate text-xs text-dust">{[r.format, r.country, r.label, r.catalogNumber].filter(Boolean).join(', ')}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
          )}
          <div className="mt-8 border-t border-groove pt-6">
            <p className="mb-3 text-dust">Can’t find it, or MusicBrainz is down?</p>
            <button onClick={() => startManual()} className="rounded-lg bg-sleeve-hi px-4 py-2 font-medium hover:bg-groove">Enter details manually</button>
          </div>
        </section>
      )}

      {step.name === 'releases' && (
        <section aria-labelledby="rel-h">
          <button onClick={() => setStep({ name: 'search' })} className="mb-4 text-sm text-dust underline underline-offset-4">Back to results</button>
          <h2 id="rel-h" className="text-2xl font-bold">Which pressing do you own?</h2>
          <p className="mb-4 text-dust">{step.group.title} by {step.group.artistNames.join(', ')}. Identical covers can be different pressings, so check the label, catalog number or barcode on your copy.</p>
          {busy && <LoadingState label="Loading release details" />}
          <ul className="flex flex-col gap-2">
            {step.candidates.map((c) => (
              <li key={c.id}>
                <button disabled={busy} onClick={() => void openRelease(c.id, c.source, true)} className="flex w-full flex-wrap items-baseline justify-between gap-x-4 rounded-xl bg-sleeve p-4 text-left hover:bg-sleeve-hi disabled:opacity-60">
                  <span>
                    <span className="font-medium">{[c.format ?? 'Unknown format', c.country, c.date].filter(Boolean).join(', ')}</span>
                    {!c.isVinyl && <span className="ml-2 rounded bg-groove px-1.5 py-0.5 text-xs text-dust">Not vinyl</span>}
                  </span>
                  <span className="text-sm text-dust">{[c.label, c.catalogNumber, c.barcode].filter(Boolean).join(', ')}</span>
                </button>
              </li>
            ))}
          </ul>
          <button disabled={busy} onClick={() => void openRelease(step.candidates[0]!.id, step.candidates[0]!.source, false)} className="mt-6 rounded-lg bg-sleeve-hi px-4 py-2 font-medium hover:bg-groove disabled:opacity-60">
            I’m not sure of the pressing
          </button>
          <p className="mt-2 text-sm text-dust">Uses one release for the track list and leaves the pressing fields blank.</p>
        </section>
      )}

      {step.name === 'confirm' && (
        <form onSubmit={(e) => { e.preventDefault(); void (dest === 'owned' ? save() : saveWant()) }} className="flex flex-col gap-10">
          <button type="button" onClick={() => setStep({ name: 'search' })} className="self-start text-sm text-dust underline underline-offset-4">Back to search</button>

          <fieldset className="flex flex-wrap gap-3">
            <legend className="mb-2 text-sm font-medium">What is this?</legend>
            {([['owned', 'I own it'], ['wantlist', 'I want it']] as const).map(([v, label]) => (
              <label key={v} className={`cursor-pointer rounded-lg border px-4 py-2 font-medium ${dest === v ? 'border-label bg-label text-label-ink' : 'border-groove bg-sleeve'}`}>
                <input type="radio" name="dest" value={v} checked={dest === v} onChange={() => { setDest(v); setError(null) }} className="sr-only" />
                {label}
              </label>
            ))}
          </fieldset>

          {dupes.length > 0 && (
            <div role="alert" className="rounded-xl border border-warn/40 bg-warn/10 p-4">
              <p className="font-semibold">{hasProviderMatch ? 'This album is already saved in your library.' : 'You may already have this album saved.'}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {dupes.map((d) => (
                  <li key={d.album.id} className="flex flex-wrap items-center gap-3 text-sm">
                    <Link to={`/collection/${d.album.id}`} className="underline underline-offset-4">{d.album.title} by {d.album.primaryArtist}</Link>
                    <span className="text-dust">{d.match === 'provider-id' ? 'Same MusicBrainz album' : 'Similar title and artist'}</span>
                    {dest === 'owned'
                      ? <button type="button" disabled={busy} onClick={() => void addToExisting(d.album.id)} className="rounded-md bg-sleeve-hi px-3 py-1 font-medium hover:bg-groove">Add this pressing as another copy</button>
                      : <button type="button" disabled={busy} onClick={() => void saveWant(d.album.id)} className="rounded-md bg-sleeve-hi px-3 py-1 font-medium hover:bg-groove">Wishlist a pressing of this album</button>}
                  </li>
                ))}
              </ul>
              {!hasProviderMatch && (
                <button type="button" disabled={busy} onClick={() => void (dest === 'owned' ? save(true) : saveWant(undefined, true))} className="mt-3 rounded-md bg-label px-3 py-1.5 text-sm font-semibold text-label-ink">
                  It’s a different album, add it separately
                </button>
              )}
            </div>
          )}

          <section aria-labelledby="meta-h" className="flex flex-col gap-4">
            <h2 id="meta-h" className="text-2xl font-bold">Album</h2>
            <div className="flex flex-col gap-6 sm:flex-row">
              <AlbumArtwork url={albumForm.artworkUrl || undefined} title={albumForm.title || 'New album'} artist={albumForm.artists || 'Unknown'} size={500} eager className="w-48 shrink-0 self-start rounded-md" />
              <div className="flex-1"><AlbumMetadataForm value={albumForm} errors={albumErrors} onChange={setAlbumForm} /></div>
            </div>
            {base.tracklist.length > 0 && (
              <details className="rounded-xl bg-sleeve p-4">
                <summary className="cursor-pointer font-medium">{base.tracklist.length} tracks</summary>
                <ol className="mt-3 text-sm text-dust">{base.tracklist.map((t) => <li key={t.id}>{t.position}. {t.title}</li>)}</ol>
              </details>
            )}
            {base.metadataSources.includes('discogs') && <p className="text-xs text-dust">Metadata from <a href="https://www.discogs.com" target="_blank" rel="noreferrer" className="underline underline-offset-4">Discogs</a>. Edit anything above to correct it.</p>}
            {base.metadataSources.includes('musicbrainz') && <p className="text-xs text-dust">Metadata from MusicBrainz, artwork from Cover Art Archive. Edit anything above to correct it.</p>}
          </section>

          {dest === 'owned' ? (
            <section aria-labelledby="copy-h" className="flex flex-col gap-4">
              <h2 id="copy-h" className="text-2xl font-bold">Your copy</h2>
              <PressingForm value={currentCopy} errors={copyErrors} onChange={setCopyForm} locations={locations} />
            </section>
          ) : (
            <section aria-labelledby="want-h" className="flex flex-col gap-4">
              <h2 id="want-h" className="text-2xl font-bold">Wantlist details</h2>
              <WantlistFields value={currentWant} errors={wantErrors} onChange={setWantForm} />
            </section>
          )}

          <div><button type="submit" disabled={busy} className="rounded-lg bg-label px-6 py-3 font-semibold text-label-ink disabled:opacity-50">{busy ? 'Saving…' : dest === 'owned' ? 'Add to collection' : 'Add to wantlist'}</button></div>
        </form>
      )}
    </>
  )
}
