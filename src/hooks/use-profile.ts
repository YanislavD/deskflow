import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

// Wenn auf der Profilseite der Name geändert wird, soll auch der Kopfbereich ihn sofort
// anzeigen. Dafür melden sich alle Nutzer dieses Hooks hier an.
const listeners = new Set<() => void>()

/** Nach dem Speichern des Profils aufrufen: alle useProfileName() laden den Namen neu. */
export function notifyProfileChanged() {
  listeners.forEach((listener) => listener())
}

/** Der Anzeigename des angemeldeten Nutzers (aus der Tabelle profiles). */
export function useProfileName() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [name, setName] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const listener = () => setVersion((v) => v + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (!cancelled) setName(data?.full_name ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [userId, version])

  return name
}
