import { useEffect, useState } from 'react'
import { useMembership } from '@/hooks/use-membership'
import { useRealtimeChanges } from '@/hooks/use-realtime'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import type { TicketPriority, TicketStatus } from '@/lib/ticket-labels'

export const PAGE_SIZE = 10

export type TicketSort = 'number' | 'title' | 'status' | 'priority' | 'due_at'

export type TicketQuery = {
  q: string
  status: TicketStatus | null
  priority: TicketPriority | null
  /** nur Tickets, die mir zugewiesen sind */
  mine: boolean
  /** nur offene Tickets, deren Fälligkeit vorbei ist */
  overdue: boolean
  /** nur Tickets ohne Zuständigen */
  unassigned: boolean
  sort: TicketSort
  dir: 'asc' | 'desc'
  /** 1-basiert */
  page: number
}

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

type Result = {
  organizationId: string
  key: string
  tickets: TicketListItem[]
  total: number
  error: string | null
}

/**
 * Sonderzeichen, die in der PostgREST-Filtersyntax (or=(a.ilike.*x*,b.eq.1)) etwas bedeuten,
 * dürfen nicht im Suchtext landen – sonst könnte man den Filter "umbauen".
 */
function sanitizeSearch(text: string) {
  return text.replace(/[,()*%\\"]/g, ' ').trim()
}

/**
 * Lädt eine Seite Tickets der gewählten Firma – Filtern, Sortieren und Blättern macht die
 * Datenbank, nicht der Browser. Innerhalb der Firma filtern wir NICHT nach Rolle: Die
 * RLS-Policies liefern jedem nur, was er sehen darf (Requester: eigene, Agent/Admin: alle).
 */
export function useTickets(query: TicketQuery) {
  const { organizationId } = useMembership()
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [result, setResult] = useState<Result | null>(null)
  // Wird bei jeder Änderung in der Datenbank erhöht -> die Liste lädt still neu
  const [version, setVersion] = useState(0)

  useRealtimeChanges(
    {
      table: 'tickets',
      filter: organizationId ? `organization_id=eq.${organizationId}` : undefined,
      enabled: organizationId !== null,
    },
    () => setVersion((v) => v + 1),
  )

  // Ändert sich irgendein Parameter, ist das eine neue Anfrage
  // (die "version" gehört bewusst NICHT dazu: Beim Neuladen bleiben die alten Zeilen stehen)
  const key = JSON.stringify([organizationId, userId, query])

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false

    let request = supabase
      .from('tickets')
      .select(
        'id, number, title, status, priority, due_at, category:categories(name), assignee:profiles!assignee_id(full_name)',
        { count: 'exact' },
      )
      .eq('organization_id', organizationId)

    if (query.status) request = request.eq('status', query.status)
    if (query.priority) request = request.eq('priority', query.priority)
    if (query.mine && userId) request = request.eq('assignee_id', userId)
    if (query.unassigned) request = request.is('assignee_id', null)
    if (query.overdue) {
      request = request
        .lt('due_at', new Date().toISOString())
        .not('status', 'in', '(geloest,geschlossen)')
    }

    const term = sanitizeSearch(query.q)
    if (term) {
      const conditions = [`title.ilike.*${term}*`, `description.ilike.*${term}*`]
      // "#12" oder "12" findet auch die Ticketnummer
      const numberMatch = /^#?(\d{1,9})$/.exec(term)
      if (numberMatch) conditions.push(`number.eq.${numberMatch[1]}`)
      request = request.or(conditions.join(','))
    }

    // Status/Priorität sortieren nach der Reihenfolge im Enum (z. B. niedrig < mittel < hoch)
    request = request.order(query.sort, { ascending: query.dir === 'asc', nullsFirst: false })
    if (query.sort !== 'number') request = request.order('number', { ascending: false })

    const fetchPage = (from: number) => request.range(from, from + PAGE_SIZE - 1)

    fetchPage((query.page - 1) * PAGE_SIZE)
      .then(async (response) => {
        // PGRST103: Die Seite liegt hinter dem Ende (z. B. alte URL). Wir laden dann Seite 1,
        // um die Gesamtzahl zu kennen – die Seite springt anschließend auf die letzte Seite.
        if (response.error?.code === 'PGRST103') return fetchPage(0)
        return response
      })
      .then(({ data, count, error }) => {
        if (cancelled) return
        setResult({
          organizationId,
          key,
          tickets: data ?? [],
          total: count ?? 0,
          error: error ? 'Die Tickets konnten nicht geladen werden.' : null,
        })
      })

    // Kommt vorher eine neuere Anfrage (z. B. weitergetippt), ignorieren wir diese Antwort.
    return () => {
      cancelled = true
    }
  }, [organizationId, userId, key, query, version])

  // Antworten einer anderen Firma gelten nicht
  const data = result?.organizationId === organizationId ? result : null

  return {
    tickets: data?.tickets ?? [],
    total: data?.total ?? 0,
    error: data?.error ?? null,
    /** noch gar keine Daten (erste Ladung oder Firmenwechsel) */
    loading: organizationId !== null && data === null,
    /** es sind Daten da, aber die neue Anfrage läuft noch (alte Zeilen bleiben so lange sichtbar) */
    fetching: data !== null && data.key !== key,
  }
}
