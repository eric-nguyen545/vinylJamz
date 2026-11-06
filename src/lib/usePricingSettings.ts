import { useCallback, useEffect, useState } from 'react'
import { getFirebase } from '../firebase/config'
import { loadPricingSettings } from './pricingRepo'
import type { PricingSettings } from './schemas'

export function usePricingSettings(uid: string) {
  const [settings, setSettings] = useState<PricingSettings | null>(null)
  const reload = useCallback(async () => {
    try { setSettings(await loadPricingSettings(getFirebase().db, uid)) } catch { setSettings({}) }
  }, [uid])
  useEffect(() => { void Promise.resolve().then(reload) }, [reload])
  return { settings, reload }
}
