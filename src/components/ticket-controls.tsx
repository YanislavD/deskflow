import { useState } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { StaffMember, TicketDetail, TicketPatch } from '@/hooks/use-ticket-detail'
import {
  priorityLabels,
  statusLabels,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/ticket-labels'

// Radix-Select erlaubt keinen leeren String als Wert -> eigener Platzhalter für "niemand"
const NOBODY = 'none'

type Props = {
  ticket: TicketDetail
  staff: StaffMember[]
  onUpdate: (patch: TicketPatch) => Promise<string | null>
}

/** Bearbeitung von Status, Priorität und Zuständigem – nur für Agents/Admins. */
export function TicketControls({ ticket, staff, onUpdate }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function change(patch: TicketPatch) {
    setSaving(true)
    setError(null)
    const err = await onUpdate(patch)
    setSaving(false)
    if (err) setError(err)
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={ticket.status}
            onValueChange={(v) => change({ status: v as TicketStatus })}
            disabled={saving}
          >
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Priorität</Label>
          <Select
            value={ticket.priority}
            onValueChange={(v) => change({ priority: v as TicketPriority })}
            disabled={saving}
          >
            <SelectTrigger id="priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(priorityLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="assignee">Zuständig</Label>
          <Select
            value={ticket.assignee_id ?? NOBODY}
            onValueChange={(v) => change({ assignee_id: v === NOBODY ? null : v })}
            disabled={saving}
          >
            <SelectTrigger id="assignee" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NOBODY}>Niemand</SelectItem>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
