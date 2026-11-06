import { useMemo, useState, type ChangeEvent } from 'react'
import { useAuth } from '../app/AuthContext'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PageHeader } from '../components/PageHeader'
import { ErrorState } from '../components/States'
import { getFirebase } from '../firebase/config'
import { BACKUP_COLLECTIONS, COLLECTION_LABEL, buildBackup, parseBackup, planImport, type Backup, type ExistingData } from '../lib/backup'
import { downloadText } from '../lib/download'
import { loadAll, runImport, toExisting } from '../lib/dataRepo'
import { albumsCsv, buildCsvSource, copiesCsv, gearCsv, listeningCsv, pricesCsv, wantlistCsv } from '../lib/exportCsv'
import { todayLocal } from '../lib/format'

export function DataPage() {
  const { state } = useAuth()
  if (state.status !== 'owner') return null
  return <DataBody uid={state.user.uid} />
}

const CSVS = [
  { key: 'albums', label: 'Albums', build: albumsCsv },
  { key: 'copies', label: 'Copies and purchases', build: copiesCsv },
  { key: 'wantlist', label: 'Wantlist', build: wantlistCsv },
  { key: 'listening', label: 'Listening log', build: listeningCsv },
  { key: 'gear', label: 'Gear', build: gearCsv },
  { key: 'prices', label: 'Prices', build: pricesCsv },
] as const

function DataBody({ uid }: { uid: string }) {
  const { db } = getFirebase()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [backup, setBackup] = useState<Backup | null>(null)
  const [existing, setExisting] = useState<ExistingData | null>(null)
  const [fileName, setFileName] = useState('')
  const [overwrite, setOverwrite] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const plan = useMemo(() => (backup && existing ? planImport(backup, existing, { overwrite }) : null), [backup, existing, overwrite])

  async function exportJson() {
    setBusy('json'); setError(null); setNotice(null)
    try {
      const all = await loadAll(db, uid)
      downloadText(`vinyl-archive-backup-${todayLocal()}.json`, JSON.stringify(buildBackup(all.docs, all.preferences), null, 2), 'application/json')
      const n = BACKUP_COLLECTIONS.reduce((c, k) => c + all.docs[k].length, 0)
      setNotice(`Backup downloaded: ${n} records.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the backup.') } finally { setBusy(null) }
  }

  async function exportCsv(c: (typeof CSVS)[number]) {
    setBusy(c.key); setError(null); setNotice(null)
    try {
      const all = await loadAll(db, uid)
      downloadText(`vinyl-archive-${c.key}-${todayLocal()}.csv`, c.build(buildCsvSource(all.docs)), 'text/csv', true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the CSV.') } finally { setBusy(null) }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null); setNotice(null); setBackup(null); setExisting(null); setOverwrite(false)
    const parsed = parseBackup(await file.text())
    if (!parsed.ok) { setError(parsed.error); return }
    setBusy('preview')
    try {
      setExisting(toExisting(await loadAll(db, uid)))
      setBackup(parsed.backup); setFileName(file.name)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not read your library to compare.') } finally { setBusy(null) }
  }

  async function doImport() {
    if (!plan) return
    setConfirm(false); setBusy('import'); setError(null); setNotice(null)
    try {
      const n = await runImport(db, uid, plan.ops, (done, total) => setProgress({ done, total }))
      setNotice(`Imported ${n} ${n === 1 ? 'record' : 'records'}. Nothing was deleted.`)
      setBackup(null); setExisting(null)
    } catch (e) {
      setError(`${e instanceof Error ? e.message : 'The import failed.'} Some records may already have been written. Re-running the same import is safe.`)
    } finally { setBusy(null); setProgress(null) }
  }

  const changedTotal = plan ? BACKUP_COLLECTIONS.reduce((n, k) => n + plan.summary[k].changed, 0) : 0

  return (
    <>
      <PageHeader title="Backup and export" description="Your data is yours. Download it any time, and restore it here if you ever need to." />
      {error && <div className="mb-6"><ErrorState title="Something went wrong" message={error} /></div>}
      {notice && <p role="status" className="mb-6 rounded-lg bg-ok/10 p-3 text-sm text-ok">{notice}</p>}

      <section aria-labelledby="export-h" className="mb-12">
        <h2 id="export-h" className="text-2xl font-bold">Export</h2>
        <p className="mt-1 max-w-2xl text-sm text-dust">Files are created in your browser and saved to your device. Nothing is uploaded. They include private details such as prices, notes and reviews, so keep them somewhere safe. Your Discogs token and public share link are never included.</p>
        <div className="mt-4">
          <button disabled={busy !== null} onClick={() => void exportJson()} className="rounded-lg bg-label px-5 py-3 font-semibold text-label-ink disabled:opacity-50">{busy === 'json' ? 'Preparing…' : 'Download full backup (JSON)'}</button>
          <p className="mt-2 text-sm text-dust">Everything: albums, copies, reviews, wantlist, listens, locations, gear, prices and preferences. Use this to restore.</p>
        </div>
        <div className="mt-6">
          <h3 className="mb-2 text-lg font-medium">Spreadsheets (CSV)</h3>
          <ul className="flex flex-wrap gap-2">
            {CSVS.map((c) => (
              <li key={c.key}><button disabled={busy !== null} onClick={() => void exportCsv(c)} className="rounded-lg bg-sleeve-hi px-4 py-2 font-medium hover:bg-groove disabled:opacity-50">{busy === c.key ? 'Preparing…' : c.label}</button></li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-dust">For reading in Excel or Sheets. CSV files can’t be imported back; use the JSON backup for that.</p>
        </div>
      </section>

      <section aria-labelledby="import-h">
        <h2 id="import-h" className="text-2xl font-bold">Import a backup</h2>
        <p className="mt-1 max-w-2xl text-sm text-dust">Choose a Vinyl Archive JSON backup. You’ll see exactly what would change before anything is written. Importing never deletes anything.</p>
        <label className="mt-4 inline-block">
          <span className="sr-only">Backup file</span>
          <input type="file" accept="application/json,.json" disabled={busy !== null} onChange={(e) => void onFile(e)}
            className="block text-sm file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-sleeve-hi file:px-4 file:py-2 file:font-medium file:text-paper hover:file:bg-groove" />
        </label>
        {busy === 'preview' && <p role="status" className="mt-4 text-dust">Reading your library to compare…</p>}

        {plan && backup && (
          <div className="mt-6">
            <h3 className="text-lg font-medium">Preview of {fileName}</h3>
            {backup.exportedAt && <p className="text-sm text-dust">Backup made {new Date(backup.exportedAt).toLocaleString()}.</p>}
            <div className="mt-3 overflow-x-auto rounded-xl border border-groove">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">What the import would do, by record type</caption>
                <thead className="bg-sleeve text-dust"><tr>
                  {['Type', 'In file', 'New', 'Identical', 'Different', 'Invalid', 'Skipped'].map((h) => <th key={h} scope="col" className="p-2 font-normal">{h}</th>)}
                </tr></thead>
                <tbody>
                  {BACKUP_COLLECTIONS.map((k) => { const s = plan.summary[k]; return (
                    <tr key={k} className="border-t border-groove">
                      <th scope="row" className="p-2 font-medium">{COLLECTION_LABEL[k]}</th>
                      <td className="p-2">{s.total}</td><td className="p-2">{s.new}</td><td className="p-2">{s.unchanged}</td><td className="p-2">{s.changed}</td><td className="p-2">{s.invalid}</td><td className="p-2">{s.orphan}</td>
                    </tr>) })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-dust">Different means the ID already exists with other content. Skipped means the record’s album isn’t in the file or your library.</p>
            {plan.preferences !== 'none' && <p className="mt-2 text-sm text-dust">Preferences in the file: {plan.preferences === 'new' ? 'will be added' : plan.preferences === 'unchanged' ? 'identical to yours' : plan.preferences === 'changed' ? (overwrite ? 'will replace yours' : 'differ from yours and will be left alone') : 'invalid and ignored'}.</p>}

            {(plan.invalid.length > 0 || plan.orphans.length > 0) && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-dust">{plan.invalid.length + plan.orphans.length} records will be left out. See why.</summary>
                <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-sleeve p-3">
                  {[...plan.invalid, ...plan.orphans].slice(0, 100).map((p, i) => <li key={i}><span className="text-dust">{COLLECTION_LABEL[p.collection]} {p.id}:</span> {p.reason}</li>)}
                </ul>
              </details>
            )}

            {changedTotal > 0 && (
              <label className="mt-5 flex max-w-xl items-start gap-3 rounded-xl bg-sleeve p-4">
                <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="mt-1 size-4 accent-[var(--color-label)]" />
                <span><span className="font-medium">Also replace {changedTotal} {changedTotal === 1 ? 'record' : 'records'} that differ</span><span className="block text-sm text-dust">Off by default. Your current version of those records would be overwritten by the backup’s.</span></span>
              </label>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button disabled={busy !== null || plan.ops.length === 0} onClick={() => (overwrite && changedTotal > 0 ? setConfirm(true) : void doImport())} className="rounded-lg bg-label px-6 py-3 font-semibold text-label-ink disabled:opacity-50">
                {busy === 'import' ? 'Importing…' : `Import ${plan.ops.length} ${plan.ops.length === 1 ? 'change' : 'changes'}`}
              </button>
              <button disabled={busy !== null} onClick={() => { setBackup(null); setExisting(null) }} className="rounded-lg bg-sleeve-hi px-5 py-3 font-medium hover:bg-groove">Cancel</button>
              {plan.ops.length === 0 && <span className="text-sm text-dust">Nothing to import. Everything in the file is already here{plan.skippedChanged ? ', or differs and overwrite is off' : ''}.</span>}
            </div>
            {plan.skippedChanged > 0 && !overwrite && <p className="mt-2 text-sm text-dust">{plan.skippedChanged} different {plan.skippedChanged === 1 ? 'record stays' : 'records stay'} as {plan.skippedChanged === 1 ? 'it is' : 'they are'}.</p>}
            {progress && <progress className="mt-4 block w-full max-w-md" value={progress.done} max={progress.total} aria-label="Import progress" />}
          </div>
        )}
      </section>

      <ConfirmDialog open={confirm} title="Replace records with the backup’s versions?" confirmLabel="Import and replace" destructive busy={busy === 'import'} onCancel={() => setConfirm(false)} onConfirm={() => void doImport()}>
        {changedTotal} {changedTotal === 1 ? 'record' : 'records'} will be overwritten with what’s in the file. Consider downloading a fresh backup first. Nothing will be deleted.
      </ConfirmDialog>
    </>
  )
}
