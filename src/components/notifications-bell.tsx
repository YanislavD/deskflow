import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useNotifications, type NotificationItem } from '@/hooks/use-notifications'
import { formatDateTime } from '@/lib/format'
import { statusLabels, type TicketStatus } from '@/lib/ticket-labels'
import { cn } from '@/lib/utils'

function describe(n: NotificationItem) {
  const who = n.actor?.full_name ?? 'Jemand'
  const ticket = n.ticket ? `#${n.ticket.number}` : 'einem Ticket'

  if (n.type === 'comment') return `${who} hat ${ticket} kommentiert`
  if (n.type === 'assigned') return `${who} hat dir ${ticket} zugewiesen`
  if (n.type === 'status') {
    const status = statusLabels[n.detail as TicketStatus] ?? n.detail
    return `Status von ${ticket} ist jetzt „${status}“`
  }
  return `Neuigkeiten zu ${ticket}`
}

export function NotificationsBell() {
  const { items, unread, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  function openNotification(n: NotificationItem) {
    markRead(n.id)
    setOpen(false)
    navigate(`/tickets/${n.ticket_id}`)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `Benachrichtigungen (${unread} ungelesen)` : 'Benachrichtigungen'}
        >
          <Bell />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Benachrichtigungen</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-primary hover:underline"
            >
              Alle als gelesen markieren
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Keine Benachrichtigungen.
          </p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openNotification(n)}
                  className={cn(
                    'flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted',
                    !n.read_at && 'bg-primary/5',
                  )}
                >
                  <span className={cn('text-sm', !n.read_at && 'font-medium')}>{describe(n)}</span>
                  {n.ticket && (
                    <span className="truncate text-xs text-muted-foreground">{n.ticket.title}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{formatDateTime(n.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
