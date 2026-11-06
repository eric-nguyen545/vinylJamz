import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { useAuth } from '../app/AuthContext'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Field, inputClass } from '../components/Field'
import { ItemPicker, type PickItem } from '../components/ItemPicker'
import { PageHeader } from '../components/PageHeader'
import { ErrorState, LoadingState } from '../components/States'
import { getFirebase } from '../firebase/config'
import { listGear } from '../lib/gearRepo'
import { listLocations } from '../lib/locationsRepo'
import { generateShareId } from '../lib/publicProjection'
import { deletePublicData, listOwnedAlbums, listPublishedIds, loadSharing, publishSite, saveSharing, type OwnerData } from '../lib/publicRepo'
import { defaultPublicFieldOptions, defaultPublicSections, PUBLIC_SECTIONS, type PublicFieldOptions, type PublicSection, type PublicSections, type SharingSettings, type VisibilityMode } from '../lib/schemas'
import { buildShareUrl, buildSiteUrl } from '../lib/shareUrl'
import { listWantlist } from '../lib/wantlistRepo'
import { GEAR_CATEGORY_LABEL } from '../lib/gearForm'

const MODES: { value: VisibilityMode; title: string; text: string }[] = [
  { value: 'off', title: 'Private', text: 'Only you, signed in. Nothing is readable by anyone else.' },
  { value: 'unlisted', title: 'Unlisted link', text: 'Anyone with the secret link can view. Nothing links to it.' },
  { value: 'public', title: 'Public website', text: 'Anyone can open the site’s front page without signing in. Editing always needs your login.' },
]

const SECTION_INFO: Record<PublicSection, { label: string; text: string }> = {
  collection: { label: 'Collection', text: 'Albums you pick below, with the fields you choose.' },
  wantlist: { label: 'Wantlist', text: 'Records you’re hunting for. Your notes stay private.' },
  journal: { label: 'Listening journal', text: 'Your listens, only for albums that are public. Places are never shown.' },
  gear: { label: 'Gear', text: 'Turntable, speakers and other equipment you pick. Seller and notes stay private.' },
  places: { label: 'Map', text: 'Names and positions of stores you pick. Addresses and notes stay private.' },
  stats: { label: 'Statistics', text: 'Charts built from the public collection. Needs the collection section.' },
}

const FIELD_LABELS: { key: keyof PublicFieldOptions; label: string; hint: string }[] = [
  { key: 'artwork', label: 'Cover art', hint: 'Links to the image.' },
  { key: 'tracklist', label: 'Tracklist', hint: 'Track titles and lengths.' },
  { key: 'rating', label: 'My rating', hint: 'Shown out of 10.' },
  { key: 'review', label: 'My review text', hint: 'Your written thoughts.' },
  { key: 'vibes', label: 'Vibe tags', hint: 'Tags like “late night”.' },
  { key: 'topTracks', label: 'Top three tracks', hint: 'Titles only.' },
  { key: 'pressingSummary', label: 'Pressing details', hint: 'Format, color, year, country, label.' },
  { key: 'discogsStats', label: 'Discogs community numbers', hint: 'Rating, have/want, for sale, as last refreshed.' },
  { key: 'journalNotes', label: 'Notes on listens', hint: 'The notes you wrote on journal entries.' },
  { key: 'money', label: 'Show prices', hint: 'What you paid for records and gear, and wantlist target prices. Off keeps all money private.' },
]

export function AdminPage() {
  const { state } = useAuth()
  if (state.status !== 'owner') return null
  return <AdminBody uid={state.user.uid} />
}

type Picks = { albums: Set<string>; wantlist: Set<string>; gear: Set<string>; places: Set<string> }

function AdminBody({ uid }: { uid: string }) {
  const { db } = getFirebase()
  const [data, setData] = useState<OwnerData | null>(null)
  const [settings, setSettings] = useState<SharingSettings | null>(null)
  const [mode, setMode] = useState<VisibilityMode>('off')
  const [name, setName] = useState('My vinyl collection')
  const [bio, setBio] = useState('')
  const [sections, setSections] = useState<PublicSections>(defaultPublicSections)
  const [fields, setFields] = useState<PublicFieldOptions>(defaultPublicFieldOptions)
  const [picks, setPicks] = useState<Picks>({ albums: new Set(), wantlist: new Set(), gear: new Set(), places: new Set() })
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'public' | 'rotate' | 'wipe' | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [albums, wantlist, gear, locations, s] = await Promise.all([listOwnedAlbums(db, uid), listWantlist(db, uid), listGear(db, uid), listLocations(db, uid), loadSharing(db, uid)])
        const published = s ? await listPublishedIds(db, s.shareId).catch(() => null) : null
        if (cancelled) return
        setData({ albums, wantlist, gear, locations })
        setSettings(s)
        if (s) { setMode(s.mode); setName(s.displayName); setBio(s.bio ?? ''); setSections(s.sections); setFields(s.fieldOptions) }
        const keep = (ids: string[] | undefined, valid: { id: string }[]) => new Set((ids ?? []).filter((id) => valid.some((v) => v.id === id)))
        setPicks({ albums: keep(published?.albums, albums), wantlist: keep(published?.wantlist, wantlist), gear: keep(published?.gear, gear), places: keep(published?.places, locations) })
      } catch (e) { if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load admin data.') }
    }
    void load()
    return () => { cancelled = true }
  }, [db, uid])

  const items = useMemo(() => {
    if (!data) return null
    const placed = data.locations.filter((l) => l.latitude !== undefined && l.longitude !== undefined)
    return {
      albums: data.albums.map<PickItem>((a) => ({ id: a.id, label: a.title, sub: `by ${a.artistNames.join(', ')}` })),
      wantlist: data.wantlist.map<PickItem>((w) => ({ id: w.id, label: w.albumTitle ?? 'Album', sub: w.primaryArtist ? `by ${w.primaryArtist}` : undefined })),
      gear: data.gear.map<PickItem>((g) => ({ id: g.id, label: g.name, sub: `(${GEAR_CATEGORY_LABEL[g.category]})` })),
      places: placed.map<PickItem>((l) => ({ id: l.id, label: l.name })),
      unplaced: data.locations.length - placed.length,
    }
  }, [data])

  const siteOpts = { publicAppUrl: import.meta.env.VITE_PUBLIC_APP_URL, origin: window.location.origin, basePath: import.meta.env.BASE_URL }
  const unlistedUrl = settings && mode !== 'off' ? buildShareUrl(settings.shareId, siteOpts) : null
  const siteUrl = settings && mode === 'public' ? buildSiteUrl(siteOpts) : null

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null); setNotice(null)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : 'That action failed.') } finally { setBusy(false); setConfirm(null) }
  }

  const draft = (shareId: string): SharingSettings => ({ shareId, mode, displayName: name.trim() || 'My vinyl collection', bio: bio.trim() || undefined, sections, fieldOptions: fields })
  const selection = () => ({ albums: [...picks.albums], wantlist: [...picks.wantlist], gear: [...picks.gear], places: [...picks.places] })

  const apply = () => run(async () => {
    if (!data) return
    const next = draft(settings?.shareId ?? generateShareId())
    await saveSharing(db, uid, next)
    const r = await publishSite(db, uid, next, selection(), data)
    setSettings(next)
    setNotice(mode === 'off'
      ? 'Everything is private now. Nothing is readable without your login.'
      : `Published: ${r.albums.published} albums, ${r.wantlist.published} wantlist items, ${r.listens.published} listens, ${r.gear.published} gear items, ${r.places.published} places.`)
  })

  const rotate = () => run(async () => {
    if (!settings || !data) return
    await deletePublicData(db, settings.shareId)
    const next = draft(generateShareId())
    await saveSharing(db, uid, next)
    await publishSite(db, uid, next, selection(), data)
    setSettings(next)
    setNotice('Created a new link. The old one stops working.')
  })

  const wipe = () => run(async () => {
    if (!settings) return
    await deletePublicData(db, settings.shareId)
    const next = { ...draft(settings.shareId), mode: 'off' as const }
    await saveSharing(db, uid, next)
    await publishSite(db, uid, next, selection(), data!) // writes the disabled parent + pointer
    setMode('off'); setSettings(next)
    setNotice('All published copies were deleted and sharing is off.')
  })

  async function copy(text: string, key: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000) } catch { setError('Couldn’t copy automatically. Select the link and copy it.') }
  }

  const needsAlbums = mode !== 'off' && sections.collection && picks.albums.size === 0
  const setSection = (k: PublicSection, on: boolean) => setSections((s) => ({ ...s, [k]: on, ...(k === 'collection' && !on ? { journal: false, stats: false } : {}) }))

  if (loadError) return <ErrorState title="Couldn’t load admin data" message={loadError} />
  if (!data || !items) return <LoadingState label="Loading admin" />

  return (
    <>
      <PageHeader title="Admin" description="Choose what the world can see. Everything is private until you say otherwise, and nothing can be edited without your login." />
      {error && <div className="mb-6"><ErrorState message={error} /></div>}
      {notice && <p role="status" className="mb-6 rounded-lg bg-ok/10 p-3 text-sm text-ok">{notice}</p>}

      <fieldset className="mb-10">
        <legend className="mb-3 text-xl font-medium">Who can view</legend>
        <div className="grid gap-3 md:grid-cols-3">
          {MODES.map((m) => (
            <label key={m.value} className={`flex cursor-pointer flex-col gap-1 rounded-2xl border p-4 ${mode === m.value ? 'border-label bg-sleeve-hi' : 'border-groove bg-sleeve hover:bg-sleeve-hi'}`}>
              <span className="flex items-center gap-2 font-semibold"><input type="radio" name="mode" checked={mode === m.value} onChange={() => setMode(m.value)} className="accent-[var(--color-label)]" />{m.title}</span>
              <span className="text-sm text-dust">{m.text}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {(siteUrl || unlistedUrl) && settings && (
        <section aria-labelledby="links-h" className="mb-10 rounded-2xl bg-sleeve p-5">
          <h2 id="links-h" className="text-xl font-medium">Links</h2>
          {[siteUrl && { key: 'site', label: 'Public website', url: siteUrl }, unlistedUrl && { key: 'unlisted', label: 'Unlisted link', url: unlistedUrl }].filter((x): x is { key: string; label: string; url: string } => Boolean(x)).map((l) => (
            <div key={l.key} className="mt-3">
              <p className="text-sm text-dust">{l.label}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input readOnly aria-label={l.label} value={l.url} onFocus={(e) => e.currentTarget.select()} className={`${inputClass} min-w-64 flex-1 font-mono text-sm`} />
                <button onClick={() => void copy(l.url, l.key)} className="inline-flex items-center gap-2 rounded-lg bg-sleeve-hi px-4 py-2 font-medium hover:bg-groove">{copied === l.key ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}{copied === l.key ? 'Copied' : 'Copy'}</button>
                <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-sleeve-hi px-4 py-2 font-medium hover:bg-groove">Open <ExternalLink aria-hidden className="size-4" /></a>
              </div>
            </div>
          ))}
          <p className="mt-3 text-sm text-dust">Unlisted links aren’t password protected and can be forwarded. Visitors can only read; the database rules reject every write except from your account.</p>
          <button disabled={busy} onClick={() => setConfirm('rotate')} className="mt-2 text-sm text-dust underline underline-offset-4 hover:text-paper">Create a new link</button>
        </section>
      )}

      <section aria-labelledby="sections-h" className="mb-10">
        <h2 id="sections-h" className="text-xl font-medium">What to show</h2>
        <p className="mb-3 text-sm text-dust">Switch whole sections on or off, then pick individual items below. Turning a section off also deletes its published copies.</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {PUBLIC_SECTIONS.map((k) => {
            const blocked = (k === 'journal' || k === 'stats') && !sections.collection
            return (
              <li key={k}>
                <label className={`flex items-start gap-3 rounded-xl bg-sleeve p-3 ${blocked ? 'opacity-50' : 'cursor-pointer'}`}>
                  <input type="checkbox" checked={sections[k] && !blocked} disabled={blocked} onChange={(e) => setSection(k, e.target.checked)} className="mt-1 size-4 accent-[var(--color-label)]" />
                  <span><span className="font-medium">{SECTION_INFO[k].label}</span><span className="block text-sm text-dust">{SECTION_INFO[k].text}</span></span>
                </label>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="profile-h" className="mb-10 grid max-w-2xl gap-4">
        <h2 id="profile-h" className="text-xl font-medium">Site name</h2>
        <Field label="Display name"><input className={inputClass} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Short bio" hint="Optional."><textarea className={inputClass} rows={2} maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} /></Field>
        <p className="text-sm text-dust">Your email and account ID are never published.</p>
      </section>

      <section aria-labelledby="fields-h" className="mb-10">
        <h2 id="fields-h" className="text-xl font-medium">Details to include</h2>
        <p className="mb-3 text-sm text-dust">Title, artist, year and genres always appear for public albums. Sellers, private notes and addresses are never published.</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {FIELD_LABELS.map(({ key, label, hint }) => (
            <li key={key}>
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 ${key === 'money' ? 'border border-warn/40 bg-warn/10' : 'bg-sleeve'}`}>
                <input type="checkbox" checked={fields[key]} onChange={(e) => setFields({ ...fields, [key]: e.target.checked })} className="mt-1 size-4 accent-[var(--color-label)]" />
                <span><span className="font-medium">{label}</span><span className="block text-sm text-dust">{hint}</span></span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="items-h" className="mb-10 flex flex-col gap-8">
        <h2 id="items-h" className="text-xl font-medium">Pick items</h2>
        {mode === 'off' && <p className="text-sm text-dust">Your choices are saved, but nothing is published while the site is Private.</p>}
        {sections.collection && <ItemPicker title="Albums" items={items.albums} selected={picks.albums} onChange={(s) => setPicks({ ...picks, albums: s })} emptyText="Add albums to your collection first." />}
        {sections.wantlist && <ItemPicker title="Wantlist" items={items.wantlist} selected={picks.wantlist} onChange={(s) => setPicks({ ...picks, wantlist: s })} emptyText="Your wantlist is empty." />}
        {sections.gear && <ItemPicker title="Gear" items={items.gear} selected={picks.gear} onChange={(s) => setPicks({ ...picks, gear: s })} emptyText="You haven’t added any gear." />}
        {sections.places && (
          <div>
            <ItemPicker title="Map places" items={items.places} selected={picks.places} onChange={(s) => setPicks({ ...picks, places: s })} emptyText="Place a store on the map first." />
            {items.unplaced > 0 && <p className="mt-2 text-sm text-dust">{items.unplaced} {items.unplaced === 1 ? 'location has' : 'locations have'} no position and can’t be shown.</p>}
          </div>
        )}
        {!sections.collection && !sections.wantlist && !sections.gear && !sections.places && <p className="text-dust">Switch on a section above to pick items.</p>}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={busy} onClick={() => (mode === 'public' && settings?.mode !== 'public' ? setConfirm('public') : void apply())} className="rounded-lg bg-label px-6 py-3 font-semibold text-label-ink disabled:opacity-50">
          {busy ? 'Working…' : mode === 'off' ? 'Save as private' : 'Save and publish'}
        </button>
        {settings && <button disabled={busy} onClick={() => setConfirm('wipe')} className="rounded-lg px-4 py-3 font-medium text-bad hover:bg-sleeve-hi">Delete all published copies</button>}
      </div>
      {needsAlbums && <p className="mt-2 text-sm text-warn">The collection section is on, but no albums are public yet.</p>}

      <ConfirmDialog open={confirm === 'public'} title="Make the website public?" confirmLabel="Publish" busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => void apply()}>
        Anyone on the internet will be able to open your site’s front page and see what you’ve chosen to share. Editing still needs your login. You can switch back to Private at any time.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'rotate'} title="Create a new link?" confirmLabel="Create new link" destructive busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => void rotate()}>
        The current links stop working immediately. Anyone you shared them with will need the new ones.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'wipe'} title="Delete all published copies?" confirmLabel="Delete and go private" destructive busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => void wipe()}>
        This removes every public copy and turns sharing off. Your own data isn’t touched. You can publish again later.
      </ConfirmDialog>
    </>
  )
}
