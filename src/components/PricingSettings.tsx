import { useState } from 'react'
import { getFirebase } from '../firebase/config'
import { savePricingSettings } from '../lib/pricingRepo'
import { usePricingSettings } from '../lib/usePricingSettings'
import { Field, inputClass } from './Field'

export function PricingSettings({ uid }: { uid: string }) {
  const { settings, reload } = usePricingSettings(uid)
  const [kind, setKind] = useState<'app' | 'token'>('app')
  const [token, setToken] = useState('')
  const [key, setKey] = useState('')
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const saved = settings?.discogsKey ? 'application key and secret' : settings?.discogsToken ? 'personal token' : null
  const ready = kind === 'app' ? key.trim().length >= 8 && secret.trim().length >= 8 : token.trim().length >= 10

  async function save(next: Parameters<typeof savePricingSettings>[2]) {
    setBusy(true); setMsg(null)
    try {
      await savePricingSettings(getFirebase().db, uid, next)
      setToken(''); setKey(''); setSecret(''); await reload()
      setMsg({ ok: true, text: Object.keys(next).length ? 'Credentials saved.' : 'Credentials removed.' })
    } catch { setMsg({ ok: false, text: 'Those don’t look like valid credentials, or saving failed.' }) } finally { setBusy(false) }
  }

  return (
    <section className="mt-12 max-w-md border-t border-groove pt-6" aria-labelledby="pricing-h">
      <h2 id="pricing-h" className="text-xl font-medium">Discogs</h2>
      <p className="mt-1 text-sm text-dust">Discogs is the main source for searching and adding records, and powers community info and asking-price checks. Without credentials the app falls back to MusicBrainz and Cover Art Archive. Credentials are stored in your private settings, readable only by your account, and sent only to Discogs, from your browser.</p>
      {saved
        ? <div className="mt-4 flex flex-wrap items-center gap-4"><span className="text-sm">A Discogs {saved} is saved.</span><button disabled={busy} onClick={() => void save({})} className="rounded-lg bg-sleeve-hi px-4 py-2 font-medium hover:bg-groove disabled:opacity-50">Remove</button></div>
        : (
          <form onSubmit={(e) => { e.preventDefault(); void save(kind === 'app' ? { discogsKey: key.trim(), discogsSecret: secret.trim() } : { discogsToken: token.trim() }) }} className="mt-4 flex flex-col gap-3">
            <fieldset className="flex gap-4 text-sm">
              <legend className="sr-only">Credential type</legend>
              <label className="flex items-center gap-2"><input type="radio" name="dk" checked={kind === 'app'} onChange={() => setKind('app')} />Application key and secret</label>
              <label className="flex items-center gap-2"><input type="radio" name="dk" checked={kind === 'token'} onChange={() => setKind('token')} />Personal token</label>
            </fieldset>
            {kind === 'app'
              ? <>
                  <Field label="Consumer key"><input className={inputClass} autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} /></Field>
                  <Field label="Consumer secret"><input className={inputClass} type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} /></Field>
                </>
              : <Field label="Personal access token"><input className={inputClass} type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} /></Field>}
            <div><button type="submit" disabled={busy || !ready} className="rounded-lg bg-label px-4 py-2 font-semibold text-label-ink disabled:opacity-50">Save</button></div>
          </form>
        )}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-3 text-sm ${msg.ok ? 'text-ok' : 'text-bad'}`}>{msg.text}</p>}
    </section>
  )
}
