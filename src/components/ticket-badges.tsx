import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  priorityLabels,
  priorityStyles,
  statusLabels,
  statusStyles,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/ticket-labels'

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <Badge variant="secondary" className={cn('border-transparent', statusStyles[status])}>
      {statusLabels[status]}
    </Badge>
  )
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <Badge variant="secondary" className={cn('border-transparent', priorityStyles[priority])}>
      {priorityLabels[priority]}
    </Badge>
  )
}
