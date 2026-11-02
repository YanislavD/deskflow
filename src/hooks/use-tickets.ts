import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { TicketPriority, TicketStatus } from '@/lib/ticket-labels'

export type TicketListItem = {
  id: string
  number: number
  title: string
  status: TicketStatus
  priority: TicketPriority
  due_at: string | null
  category: { name: string } | null
  assignee: { full_name: string | null } | null
}

/**
 * Lädt die Tickets. Wir filtern hier NICHT nach Rolle: Die RLS-Policies in der
 * Datenbank liefern jedem nur das, was er sehen darf (Requester: eigene Tickets,
 * Agent/Admin: alle der Firma).
 */
export function useTickets() {
  const [tickets, setTickets] = useState<TicketListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error } = await supabase
        .from('tickets')
        .select(
          'id, number, title, status, priority, due_at, category:categories(name), assignee:profiles!assignee_id(full_name)',
        )
        .order('number', { ascending: false })

      if (cancelled) return
      if (error) setError('Die Tickets konnten nicht geladen werden.')
      else setTickets(data)
      setLoading(false)
    }

    load()
    // Falls die Komponente verschwindet, bevor die Antwort kommt, ignorieren wir sie.
    return () => {
      cancelled = true
    }
  }, [])

  return { tickets, loading, error }
}
