import { useState } from 'react'
import { ConfirmDialog } from '@/components/confirm-dialog'
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

  // Jede Änderung wird erst nach einer Rückfrage ausgeführt (Schutz vor Fehlklicks)
  const [pending, setPending] = useState<{
    patch: TicketPatch
    title: string
    description: string
  } | null>(null)

  const ask = (patch: TicketPatch, title: string, description: string) =>
    setPending({ patch, title, description })

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
            onValueChange={(v) =>
              ask(
                { status: v as TicketStatus },
                'Status ändern?',
                `Status von „${statusLabels[ticket.status]}“ auf „${statusLabels[v as TicketStatus]}“ ändern?`,
              )
            }
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
            onValueChange={(v) =>
              ask(
                { priority: v as TicketPriority },
                'Priorität ändern?',
                `Priorität von „${priorityLabels[ticket.priority]}“ auf „${priorityLabels[v as TicketPriority]}“ ändern?`,
              )
            }
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
            onValueChange={(v) => {
              const newName = v === NOBODY ? 'niemand' : (staff.find((s) => s.id === v)?.name ?? 'Unbekannt')
              ask(
                { assignee_id: v === NOBODY ? null : v },
                'Zuständigkeit ändern?',
                `Zuständigkeit von „${ticket.assignee?.full_name ?? 'niemand'}“ auf „${newName}“ ändern?`,
              )
            }}
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

      <ConfirmDialog
        request={pending}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) change(pending.patch)
          setPending(null)
        }}
      />
    </div>
  )
}
