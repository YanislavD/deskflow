import { useEffect, useState } from 'react'
import { useMembership } from '@/hooks/use-membership'
import { useRealtimeChanges } from '@/hooks/use-realtime'
import { supabase } from '@/lib/supabase'
import type { TicketPriority, TicketStatus } from '@/lib/ticket-labels'

/** Antwort der Datenbankfunktion ticket_stats (siehe Migration) */
export type DashboardStats = {
  total: number
  open: number
  overdue: number
  unassigned: number
  mine: number
  by_status: Partial<Record<TicketStatus, number>>
  by_priority: Partial<Record<TicketPriority, number>>
}

export type RecentTicket = {
  id: string
  number: number
  title: string
  status: TicketStatus
  updated_at: string
}

type Result = { organizationId: string; stats: DashboardStats; recent: RecentTicket[] }

/**
 * Daten für die Startseite. Gezählt wird in der Datenbank (ticket_stats). Weil die Funktion
 * mit den Rechten des Nutzers läuft, gilt auch hier die RLS: Ein Requester sieht Zahlen über
 * seine eigenen Tickets, ein Agent über alle der Firma.
 */
export function useDashboard() {
  const { organizationId } = useMembership()
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  // Realtime: Ändert sich ein Ticket der Firma, laden wir die Zahlen neu
  useRealtimeChanges(
    {
      table: 'tickets',
      filter: organizationId ? `organization_id=eq.${organizationId}` : undefined,
      enabled: organizationId !== null,
    },
    () => setVersion((v) => v + 1),
  )

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false

    Promise.all([
      supabase.rpc('ticket_stats', { org: organizationId }),
      supabase
        .from('tickets')
        .select('id, number, title, status, updated_at')
        .eq('organization_id', organizationId)
        .order('updated_at', { ascending: false })
        .limit(5),
    ]).then(([statsRes, recentRes]) => {
      if (cancelled) return
      if (statsRes.error || recentRes.error) {
        setError('Die Übersicht konnte nicht geladen werden.')
        return
      }
      setError(null)
      setResult({
        organizationId,
        stats: statsRes.data as unknown as DashboardStats,
        recent: recentRes.data,
      })
    })

    return () => {
      cancelled = true
    }
  }, [organizationId, version])

  // Zahlen einer anderen Firma gelten nicht
  const data = result?.organizationId === organizationId ? result : null

  return {
    stats: data?.stats ?? null,
    recent: data?.recent ?? [],
    loading: organizationId !== null && data === null && error === null,
    error,
  }
}
