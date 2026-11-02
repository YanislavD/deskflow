import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
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
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useMembership } from '@/hooks/use-membership'
import {
  PAGE_SIZE,
  useTickets,
  type TicketListItem,
  type TicketQuery,
  type TicketSort,
} from '@/hooks/use-tickets'
import { formatDate } from '@/lib/format'
import { priorityLabels, statusLabels } from '@/lib/ticket-labels'
import { cn } from '@/lib/utils'

const SORTS: TicketSort[] = ['number', 'title', 'status', 'priority', 'due_at']

// Richtung, mit der eine Spalte beim ersten Klick sortiert: Nummer neu -> alt,
// Priorität kritisch -> niedrig, alles andere aufsteigend (Fälligkeit: zuerst fällige)
const DEFAULT_DIR: Record<TicketSort, 'asc' | 'desc'> = {
  number: 'desc',
  title: 'asc',
  status: 'asc',
  priority: 'desc',
  due_at: 'asc',
}

function isOverdue(ticket: TicketListItem) {
  return (
    ticket.due_at !== null &&
    new Date(ticket.due_at) < new Date() &&
    ticket.status !== 'geloest' &&
    ticket.status !== 'geschlossen'
  )
}

function SortHeader({
  label,
  column,
  query,
  onSort,
  className,
}: {
  label: string
  column: TicketSort
  query: TicketQuery
  onSort: (column: TicketSort) => void
  className?: string
}) {
  const active = query.sort === column
  const Icon = !active ? ArrowUpDown : query.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead
      className={className}
      aria-sort={active ? (query.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-foreground',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
        <Icon className="size-3.5" aria-hidden />
      </button>
    </TableHead>
  )
}

export function TicketsPage() {
  const { role } = useMembership()
  const showMine = role === 'admin' || role === 'agent'

  // Alle Einstellungen stehen in der URL (?q=vpn&status=neu&sort=priority&page=2):
  // Der Link lässt sich teilen und beim Zurückkehren von einem Ticket ist alles noch da.
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status') ?? ''
  const priorityParam = params.get('priority') ?? ''
  const sortParam = params.get('sort') ?? ''
  const sort = (SORTS as string[]).includes(sortParam) ? (sortParam as TicketSort) : 'number'
  const dirParam = params.get('dir')
  const dir: 'asc' | 'desc' =
    dirParam === 'asc' || dirParam === 'desc' ? dirParam : DEFAULT_DIR[sort]
  const pageParam = Number.parseInt(params.get('page') ?? '1', 10)

  const filters: TicketFilterValues = {
    q: params.get('q') ?? '',
    status: Object.hasOwn(statusLabels, statusParam)
      ? (statusParam as TicketFilterValues['status'])
      : ALL,
    priority: Object.hasOwn(priorityLabels, priorityParam)
      ? (priorityParam as TicketFilterValues['priority'])
      : ALL,
    mine: showMine && params.get('mine') === '1',
  }
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1
  const isFiltering =
    filters.q !== '' || filters.status !== ALL || filters.priority !== ALL || filters.mine

  function writeParams(next: { filters: TicketFilterValues; sort: TicketSort; dir: string; page: number }) {
    const p = new URLSearchParams()
    if (next.filters.q) p.set('q', next.filters.q)
    if (next.filters.status !== ALL) p.set('status', next.filters.status)
    if (next.filters.priority !== ALL) p.set('priority', next.filters.priority)
    if (next.filters.mine) p.set('mine', '1')
    if (next.sort !== 'number' || next.dir !== DEFAULT_DIR.number) {
      p.set('sort', next.sort)
      p.set('dir', next.dir)
    }
    if (next.page > 1) p.set('page', String(next.page))
    // replace: Jeder Tastendruck soll keinen neuen Verlaufseintrag erzeugen
    setParams(p, { replace: true })
  }

  // Ein neuer Filter springt immer zurück auf Seite 1
  const updateFilters = (patch: Partial<TicketFilterValues>) =>
    writeParams({ filters: { ...filters, ...patch }, sort, dir, page: 1 })

  function updateSort(column: TicketSort) {
    const nextDir = column === sort ? (dir === 'asc' ? 'desc' : 'asc') : DEFAULT_DIR[column]
    writeParams({ filters, sort: column, dir: nextDir, page: 1 })
  }

  const goToPage = (next: number) => writeParams({ filters, sort, dir, page: next })

  // Während des Tippens warten wir kurz, damit nicht jeder Buchstabe eine Anfrage auslöst
  const debouncedQ = useDebouncedValue(filters.q, 300)
  // useMemo: Das Objekt bleibt gleich, solange sich kein Wert ändert. Sonst würde useTickets
  // bei jedem Rendern eine neue Anfrage starten.
  const query = useMemo<TicketQuery>(
    () => ({
      q: debouncedQ,
      status: filters.status === ALL ? null : filters.status,
      priority: filters.priority === ALL ? null : filters.priority,
      mine: filters.mine,
      sort,
      dir,
      page,
    }),
    [debouncedQ, filters.status, filters.priority, filters.mine, sort, dir, page],
  )

  const { tickets, total, loading, fetching, error } = useTickets(query)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const ready = !loading && !error

  // Seite gibt es nicht mehr (z. B. alte URL, Tickets gelöscht) -> auf die letzte springen
  useEffect(() => {
    if (ready && !fetching && page > totalPages) {
      writeParams({ filters, sort, dir, page: totalPages })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fetching, page, totalPages])

  const firstShown = (page - 1) * PAGE_SIZE + 1
  const lastShown = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold">Tickets</h1>
          {ready && (
            <span className="text-sm text-muted-foreground">
              {total} {total === 1 ? 'Ticket' : 'Tickets'}
              {isFiltering && ' gefunden'}
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
        showMine={showMine}
      />

      {loading && <p className="text-muted-foreground">Tickets werden geladen …</p>}

      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}

      {ready && total === 0 && !fetching && (
        <p className="text-muted-foreground">
          {isFiltering ? 'Keine Tickets für diese Filter gefunden.' : 'Keine Tickets vorhanden.'}
        </p>
      )}

      {ready && tickets.length > 0 && (
        <div className={cn('rounded-lg border bg-card transition-opacity', fetching && 'opacity-60')}>
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label="Nr." column="number" query={query} onSort={updateSort} className="w-20" />
                <SortHeader label="Titel" column="title" query={query} onSort={updateSort} />
                <SortHeader label="Status" column="status" query={query} onSort={updateSort} />
                <SortHeader label="Priorität" column="priority" query={query} onSort={updateSort} />
                <TableHead>Zuständig</TableHead>
                <SortHeader label="Fällig" column="due_at" query={query} onSort={updateSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => (
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

      {ready && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {firstShown}–{lastShown} von {total}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
              <ChevronLeft /> Zurück
            </Button>
            <span>
              Seite {page} von {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
            >
              Weiter <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
