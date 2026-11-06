import { useCallback, useEffect, useState } from 'react'
import { getFirebase } from '../firebase/config'
import { listLocations, type StoredLocation } from './locationsRepo'

/** Purchase locations for pickers. Failures fall back to an empty list; the Map page reports errors. */
export function usePurchaseLocations(uid: string) {
  const [locations, setLocations] = useState<StoredLocation[]>([])
  const reload = useCallback(async () => {
    try { setLocations(await listLocations(getFirebase().db, uid)) } catch { /* picker simply stays empty */ }
  }, [uid])
  useEffect(() => { void Promise.resolve().then(reload) }, [reload])
  return { locations, reload }
}
