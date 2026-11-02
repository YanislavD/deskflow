import { useState, type FormEvent } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import { ConfirmDialog } from '@/components/confirm-dialog'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { MemberItem } from '@/hooks/use-admin-data'
import { useAuth } from '@/lib/auth-context'
import { formatDate } from '@/lib/format'
import { roleLabels, type MemberRole } from '@/lib/role-labels'

type Props = {
  members: MemberItem[]
  onAdd: (email: string, role: MemberRole) => Promise<string | null>
  onChangeRole: (membershipId: string, role: MemberRole) => Promise<string | null>
  onRemove: (membershipId: string) => Promise<string | null>
}

function RoleSelect({
  value,
  onChange,
  id,
  label,
}: {
  value: MemberRole
  onChange: (role: MemberRole) => void
  id?: string
  label: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as MemberRole)}>
      <SelectTrigger id={id} className="w-40" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(roleLabels).map(([role, text]) => (
          <SelectItem key={role} value={role}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function MembersSection({ members, onAdd, onChangeRole, onRemove }: Props) {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('requester')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Rollenwechsel wird erst nach Rückfrage ausgeführt (eine falsche Rolle hat weitreichende Folgen)
  const [pendingRole, setPendingRole] = useState<{ member: MemberItem; role: MemberRole } | null>(null)

  async function perform(action: () => Promise<string | null>) {
    setBusy(true)
    setError(null)
    const err = await action()
    setBusy(false)
    if (err) setError(err)
    return err
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const err = await perform(() => onAdd(email.trim(), role))
    if (!err) setEmail('')
  }

  function handleRemove(member: MemberItem) {
    const name = member.profile?.full_name ?? 'diese Person'
    if (!window.confirm(`${name} wirklich aus der Firma entfernen?`)) return
    perform(() => onRemove(member.id))
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Mitglieder</h2>

      <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-Mail eines registrierten Nutzers"
          aria-label="E-Mail-Adresse"
          className="min-w-60 flex-1"
        />
        <RoleSelect value={role} onChange={setRole} label="Rolle für das neue Mitglied" />
        <Button type="submit" disabled={busy || email.trim() === ''}>
          <UserPlus /> Hinzufügen
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead>Mitglied seit</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">
                  {m.profile?.full_name ?? 'Unbekannt'}
                  {m.user_id === user?.id && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">(Du)</span>
                  )}
                </TableCell>
                <TableCell>
                  <RoleSelect
                    value={m.role}
                    label={`Rolle von ${m.profile?.full_name ?? 'Mitglied'}`}
                    onChange={(r) => setPendingRole({ member: m, role: r })}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(m.created_at)}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    onClick={() => handleRemove(m)}
                    aria-label={`${m.profile?.full_name ?? 'Mitglied'} entfernen`}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        request={
          pendingRole && {
            title: 'Rolle ändern?',
            description: `Rolle von ${pendingRole.member.profile?.full_name ?? 'diesem Mitglied'} von „${roleLabels[pendingRole.member.role]}“ auf „${roleLabels[pendingRole.role]}“ ändern?`,
          }
        }
        onCancel={() => setPendingRole(null)}
        onConfirm={() => {
          if (pendingRole) perform(() => onChangeRole(pendingRole.member.id, pendingRole.role))
          setPendingRole(null)
        }}
      />
    </section>
  )
}
