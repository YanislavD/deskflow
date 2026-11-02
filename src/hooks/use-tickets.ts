import { useEffect, useState } from 'react'
import { useMembership } from '@/hooks/use-membership'
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

type Result = { organizationId: string; tickets: TicketListItem[]; error: string | null }

/**
 * Lädt die Tickets der gewählten Firma. Innerhalb der Firma filtern wir NICHT nach Rolle:
 * Die RLS-Policies in der Datenbank liefern jedem nur das, was er sehen darf
 * (Requester: eigene Tickets, Agent/Admin: alle der Firma).
 */
export function useTickets() {
  const { organizationId } = useMembership()
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false

    supabase
      .from('tickets')
      .select(
        'id, number, title, status, priority, due_at, category:categories(name), assignee:profiles!assignee_id(full_name)',
      )
      .eq('organization_id', organizationId)
      .order('number', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        setResult({
          organizationId,
          tickets: data ?? [],
          error: error ? 'Die Tickets konnten nicht geladen werden.' : null,
        })
      })

    // Wechselt die Firma, bevor die Antwort kommt, ignorieren wir sie.
    return () => {
      cancelled = true
    }
  }, [organizationId])

  // Ergebnis einer anderen Firma gilt nicht -> "lädt", bis die neue da ist
  const current = result?.organizationId === organizationId ? result : null

  return {
    tickets: current?.tickets ?? [],
    loading: organizationId !== null && current === null,
    error: current?.error ?? null,
  }
}
