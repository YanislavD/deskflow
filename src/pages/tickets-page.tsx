import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Plus } from 'lucide-react'
import { PriorityBadge, StatusBadge } from '@/components/ticket-badges'
import { ALL, TicketFilters, type TicketFilterValues } from '@/components/ticket-filters'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useTickets, type TicketListItem } from '@/hooks/use-tickets'
import { formatDate } from '@/lib/format'
import { priorityLabels, statusLabels } from '@/lib/ticket-labels'

function isOverdue(ticket: TicketListItem) {
  return (
    ticket.due_at !== null &&
    new Date(ticket.due_at) < new Date() &&
    ticket.status !== 'geloest' &&
    ticket.status !== 'geschlossen'
  )
}

/** Trifft der Suchtext auf Titel, Nummer, Kategorie oder Zuständigen? */
function matchesSearch(ticket: TicketListItem, query: string) {
  const haystack = [
    ticket.title,
    String(ticket.number),
    ticket.category?.name,
    ticket.assignee?.full_name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  // "#12" und "12" sollen beide die Nummer finden
  return haystack.includes(query.replace(/^#/, '').toLowerCase())
}

export function TicketsPage() {
  const { tickets, loading, error } = useTickets()

  // Die Filter stehen in der URL (?q=vpn&status=neu): Der Link lässt sich teilen,
  // und beim Zurückkehren von einem Ticket ist der Filter noch da.
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status') ?? ''
  const priorityParam = params.get('priority') ?? ''
  const filters: TicketFilterValues = {
    q: params.get('q') ?? '',
    status: Object.hasOwn(statusLabels, statusParam) ? (statusParam as TicketFilterValues['status']) : ALL,
    priority:
      Object.hasOwn(priorityLabels, priorityParam) ? (priorityParam as TicketFilterValues['priority']) : ALL,
  }
  const isFiltering = filters.q !== '' || filters.status !== ALL || filters.priority !== ALL

  function updateFilters(patch: Partial<TicketFilterValues>) {
    const next = { ...filters, ...patch }
    const nextParams = new URLSearchParams()
    if (next.q) nextParams.set('q', next.q)
    if (next.status !== ALL) nextParams.set('status', next.status)
    if (next.priority !== ALL) nextParams.set('priority', next.priority)
    // replace: Jeder Tastendruck soll keinen neuen Verlaufseintrag erzeugen
    setParams(nextParams, { replace: true })
  }

  const visible = useMemo(() => {
    const query = filters.q.trim()
    return tickets.filter(
      (t) =>
        (filters.status === ALL || t.status === filters.status) &&
        (filters.priority === ALL || t.priority === filters.priority) &&
        (query === '' || matchesSearch(t, query)),
    )
  }, [tickets, filters.q, filters.status, filters.priority])

  const ready = !loading && !error

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold">Tickets</h1>
          {ready && (
            <span className="text-sm text-muted-foreground">
              {isFiltering
                ? `${visible.length} von ${tickets.length} Tickets`
                : `${tickets.length} ${tickets.length === 1 ? 'Ticket' : 'Tickets'}`}
            </span>
          )}
        </div>
        <Button asChild size="sm">
          <Link to="/tickets/new">
            <Plus /> Neues Ticket
          </Link>
        </Button>
      </div>

      <TicketFilters
        values={filters}
        onChange={updateFilters}
        onReset={() => setParams({}, { replace: true })}
        isActive={isFiltering}
      />

      {loading && <p className="text-muted-foreground">Tickets werden geladen …</p>}

      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}

      {ready && tickets.length === 0 && (
        <p className="text-muted-foreground">Keine Tickets vorhanden.</p>
      )}

      {ready && tickets.length > 0 && visible.length === 0 && (
        <p className="text-muted-foreground">Keine Tickets für diese Filter gefunden.</p>
      )}

      {ready && visible.length > 0 && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Nr.</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priorität</TableHead>
                <TableHead>Zuständig</TableHead>
                <TableHead>Fällig</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-muted-foreground">#{t.number}</TableCell>
                  <TableCell>
                    <Link to={`/tickets/${t.id}`} className="font-medium hover:text-primary">
                      {t.title}
                    </Link>
                    {t.category && (
                      <div className="text-xs text-muted-foreground">{t.category.name}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={t.priority} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.assignee?.full_name ?? '–'}
                  </TableCell>
                  <TableCell className={isOverdue(t) ? 'text-destructive' : 'text-muted-foreground'}>
                    {t.due_at ? formatDate(t.due_at) : '–'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
