import { formatDate, formatDateTime } from '@/lib/format'
import { priorityLabels, statusLabels, type TicketPriority, type TicketStatus } from '@/lib/ticket-labels'
import type { EventItem } from '@/hooks/use-ticket-detail'

function describe(event: EventItem, names: Record<string, string>) {
  const { type, old_value, new_value } = event

  if (type === 'status') {
    const from = statusLabels[old_value as TicketStatus] ?? old_value
    const to = statusLabels[new_value as TicketStatus] ?? new_value
    return `hat den Status von „${from}“ auf „${to}“ geändert`
  }
  if (type === 'priority') {
    const from = priorityLabels[old_value as TicketPriority] ?? old_value
    const to = priorityLabels[new_value as TicketPriority] ?? new_value
    return `hat die Priorität von „${from}“ auf „${to}“ geändert`
  }
  if (type === 'assignee') {
    const from = old_value ? (names[old_value] ?? 'Unbekannt') : 'niemand'
    const to = new_value ? (names[new_value] ?? 'Unbekannt') : 'niemand'
    return `hat die Zuständigkeit von „${from}“ auf „${to}“ geändert`
  }
  if (type === 'title') {
    return `hat den Titel von „${old_value}“ auf „${new_value}“ geändert`
  }
  if (type === 'description') {
    return 'hat die Beschreibung geändert'
  }
  if (type === 'category') {
    const from = old_value ? (names[old_value] ?? 'gelöscht') : 'keine'
    const to = new_value ? (names[new_value] ?? 'gelöscht') : 'keine'
    return `hat die Kategorie von „${from}“ auf „${to}“ geändert`
  }
  if (type === 'due_at') {
    const from = old_value ? formatDate(old_value) : 'keine'
    const to = new_value ? formatDate(new_value) : 'keine'
    return `hat die Fälligkeit von „${from}“ auf „${to}“ geändert`
  }
  return 'hat das Ticket geändert'
}

export function TicketEvents({
  events,
  names,
}: {
  events: EventItem[]
  names: Record<string, string>
}) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Änderungen.</p>
  }

  return (
    <ol className="space-y-3 border-l pl-4">
      {events.map((e) => (
        <li key={e.id} className="text-sm">
          <span className="font-medium">{e.actor?.full_name ?? 'System'}</span>{' '}
          <span className="text-muted-foreground">{describe(e, names)}</span>
          <div className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</div>
        </li>
      ))}
    </ol>
  )
}
