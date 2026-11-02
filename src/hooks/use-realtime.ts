import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type Options = {
  table: 'tickets' | 'ticket_comments' | 'ticket_events' | 'notifications' | 'ticket_attachments'
  /** Nur Änderungen, die dazu passen, z. B. "organization_id=eq.<uuid>" */
  filter?: string
  enabled?: boolean
}

let channelCounter = 0

/**
 * Ruft `onChange`, sobald sich in der Datenbank etwas an der Tabelle ändert (Realtime).
 *
 * Wir übernehmen die Daten aus dem Ereignis NICHT selbst, sondern laden die Seite neu.
 * Das ist einfacher und sicher: Welche Zeilen der Nutzer sehen darf, entscheidet weiter
 * die Datenbank (RLS) – sowohl beim Senden des Ereignisses als auch beim Neuladen.
 */
export function useRealtimeChanges({ table, filter, enabled = true }: Options, onChange: () => void) {
  // Immer die neueste Funktion aufrufen, ohne bei jedem Rendern neu zu abonnieren
  const latest = useRef(onChange)
  useEffect(() => {
    latest.current = onChange
  })

  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout> | undefined

    // Eindeutiger Name pro Abo (React ruft Effekte in der Entwicklung doppelt auf)
    const channel = supabase
      .channel(`realtime-${table}-${++channelCounter}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => {
        // Mehrere Änderungen kurz hintereinander (z. B. Status + Zuständiger) -> ein Neuladen
        clearTimeout(timer)
        timer = setTimeout(() => latest.current(), 250)
      })
      .subscribe()

    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [table, filter, enabled])
}
