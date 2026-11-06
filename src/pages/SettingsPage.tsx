import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { getDoc, setDoc } from 'firebase/firestore'
import { useAuth } from '../app/AuthContext'
import { PageHeader } from '../components/PageHeader'
import { PricingSettings } from '../components/PricingSettings'
import { ErrorState, LoadingState } from '../components/States'
import { getFirebase } from '../firebase/config'
import { prefsDoc } from '../firebase/paths'
import { defaultPreferences, preferencesSchema, type Preferences } from '../lib/schemas'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'VND']

export function SettingsPage() {
  const { state, signOut } = useAuth()
  const uid = state.status === 'owner' ? state.user.uid : null
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const { register, handleSubmit, reset, formState } = useForm<Preferences>({
    resolver: zodResolver(preferencesSchema) as never,
    defaultValues: defaultPreferences,
  })

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    getDoc(prefsDoc(getFirebase().db, uid))
      .then((snap) => {
        if (cancelled) return
        const parsed = preferencesSchema.safeParse(snap.data() ?? {})
        reset(parsed.success ? parsed.data : defaultPreferences)
        setLoaded(true)
      })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load settings.') })
    return () => { cancelled = true }
  }, [uid, reset])

  if (!uid) return null

  async function onSave(values: Preferences) {
    setError(null); setSaved(false)
    try {
      await setDoc(prefsDoc(getFirebase().db, uid!), preferencesSchema.parse(values))
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save settings.')
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Preferences are stored privately with your account." />
      {error && <ErrorState message={error} />}
      {!loaded && !error && <LoadingState label="Loading settings" />}
      {loaded && (
        <form onSubmit={(e) => void handleSubmit(onSave)(e)} className="flex max-w-md flex-col gap-5">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Rating scale
            <select {...register('ratingMax', { valueAsNumber: true })} className="rounded-lg border border-groove bg-sleeve px-3 py-2 text-base font-normal">
              <option value={10}>0–10 in tenths</option>
              <option value={5}>0–5 in tenths</option>
              <option value={100}>0–100</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Default currency
            <select {...register('defaultCurrency')} className="rounded-lg border border-groove bg-sleeve px-3 py-2 text-base font-normal">
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-4">
            <button type="submit" disabled={formState.isSubmitting} className="rounded-lg bg-label px-4 py-2 font-semibold text-label-ink disabled:opacity-50">Save settings</button>
            {saved && <p role="status" className="text-sm text-ok">Settings saved.</p>}
          </div>
        </form>
      )}
      <PricingSettings uid={uid} />
      <section className="mt-12 max-w-md border-t border-groove pt-6">
        <h2 className="text-xl font-medium">Account</h2>
        <p className="mt-1 text-sm text-dust">Signed in as {state.status === 'owner' ? state.user.email : ''}</p>
        <button onClick={() => void signOut()} className="mt-4 rounded-lg bg-sleeve-hi px-4 py-2 font-medium hover:bg-groove">Sign out</button>
      </section>
    </>
  )
}
