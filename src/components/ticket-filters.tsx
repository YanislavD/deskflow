import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  priorityLabels,
  statusLabels,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/ticket-labels'

// Radix-Select erlaubt keinen leeren String als Wert -> "all" steht für "kein Filter"
export const ALL = 'all'

export type TicketFilterValues = {
  q: string
  status: TicketStatus | typeof ALL
  priority: TicketPriority | typeof ALL
}

type Props = {
  values: TicketFilterValues
  onChange: (patch: Partial<TicketFilterValues>) => void
  onReset: () => void
  isActive: boolean
}

export function TicketFilters({ values, onChange, onReset, isActive }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-52 flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={values.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Suchen nach Titel, Nummer, Kategorie …"
          aria-label="Tickets durchsuchen"
          className="pl-8"
        />
      </div>

      <Select
        value={values.status}
        onValueChange={(v) => onChange({ status: v as TicketFilterValues['status'] })}
      >
        <SelectTrigger className="w-44" aria-label="Nach Status filtern">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Alle Status</SelectItem>
          {Object.entries(statusLabels).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={values.priority}
        onValueChange={(v) => onChange({ priority: v as TicketFilterValues['priority'] })}
      >
        <SelectTrigger className="w-44" aria-label="Nach Priorität filtern">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Alle Prioritäten</SelectItem>
          {Object.entries(priorityLabels).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isActive && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X /> Zurücksetzen
        </Button>
      )}
    </div>
  )
}
