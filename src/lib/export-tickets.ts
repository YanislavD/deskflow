import { applyTicketFilters, applyTicketSort, type TicketQuery } from '@/hooks/use-tickets'
import { downloadCsv, toCsv } from '@/lib/csv'
import { formatDate, formatDateTime } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { priorityLabels, statusLabels } from '@/lib/ticket-labels'

const COLUMNS =
  'number, title, status, priority, due_at, created_at, category:categories(name), requester:profiles!requester_id(full_name), assignee:profiles!assignee_id(full_name)'

const CHUNK = 500
// Obergrenze, damit niemand versehentlich den Browser mit Hunderttausenden Zeilen überlastet
const MAX_ROWS = 5000

/**
 * Lädt ALLE Tickets, die zu den aktuellen Filtern passen (nicht nur die sichtbare Seite),
 * und startet den Download als CSV. Die Datenbank liefert wieder nur, was der Nutzer sehen
 * darf (RLS) – ein Requester exportiert also nur seine eigenen Tickets.
 */
export async function exportTickets(
  query: TicketQuery,
  organizationId: string,
  userId: string | null,
): Promise<{ count: number; error: string | null; truncated: boolean }> {
  const rows: string[][] = [
    ['Nr.', 'Titel', 'Status', 'Priorität', 'Kategorie', 'Angefragt von', 'Zuständig', 'Fällig', 'Erstellt'],
  ]

  for (let from = 0; from < MAX_ROWS; from += CHUNK) {
    let request = supabase.from('tickets').select(COLUMNS).eq('organization_id', organizationId)
    request = applyTicketFilters(request, query, userId)
    request = applyTicketSort(request, query)
    const { data, error } = await request.range(from, from + CHUNK - 1)

    if (error) return { count: 0, error: 'Der Export ist fehlgeschlagen.', truncated: false }

    for (const t of data) {
      rows.push([
        String(t.number),
        t.title,
        statusLabels[t.status],
        priorityLabels[t.priority],
        t.category?.name ?? '',
        t.requester?.full_name ?? '',
        t.assignee?.full_name ?? '',
        t.due_at ? formatDate(t.due_at) : '',
        formatDateTime(t.created_at),
      ])
    }
    if (data.length < CHUNK) break
  }

  const count = rows.length - 1
  const day = new Date().toISOString().slice(0, 10)
  downloadCsv(`tickets-${day}.csv`, toCsv(rows))
  return { count, error: null, truncated: count >= MAX_ROWS }
}
