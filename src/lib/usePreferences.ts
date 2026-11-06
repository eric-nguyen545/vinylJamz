import { useEffect, useState } from 'react'
import { getDoc } from 'firebase/firestore'
import { getFirebase } from '../firebase/config'
import { prefsDoc } from '../firebase/paths'
import { defaultPreferences, preferencesSchema, type Preferences } from './schemas'

export function usePreferences(uid: string): Preferences {
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences)
  useEffect(() => {
    let cancelled = false
    getDoc(prefsDoc(getFirebase().db, uid))
      .then((s) => { const p = preferencesSchema.safeParse(s.data() ?? {}); if (!cancelled && p.success) setPrefs(p.data) })
      .catch(() => { /* defaults are fine if preferences can't load */ })
    return () => { cancelled = true }
  }, [uid])
  return prefs
}
