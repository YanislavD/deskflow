import { useState, type FormEvent } from 'react'
import { Check, Copy, Send, X } from 'lucide-react'
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
import type { InvitationItem } from '@/hooks/use-invitations'
import { formatDate } from '@/lib/format'
import { roleLabels, type MemberRole } from '@/lib/role-labels'

type Props = {
  invitations: InvitationItem[]
  onInvite: (email: string, role: MemberRole) => Promise<{ token: string | null; error: string | null }>
  onRevoke: (id: string) => Promise<string | null>
}

const isExpired = (i: InvitationItem) => new Date(i.expires_at) < new Date()

/** Einladungen für Personen, die noch kein Konto haben (oder noch nicht in der Firma sind). */
export function InvitationsSection({ invitations, onInvite, onRevoke }: Props) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('requester')
  const [link, setLink] = useState<{ email: string; url: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [pendingRevoke, setPendingRevoke] = useState<InvitationItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setCopied(false)
    const result = await onInvite(email.trim(), role)
    setBusy(false)

    if (result.error || !result.token) {
      setError(result.error ?? 'Die Einladung konnte nicht erstellt werden.')
      return
    }
    setLink({ email: email.trim().toLowerCase(), url: `${window.location.origin}/invite/${result.token}` })
    setEmail('')
  }

  async function copyLink() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      setCopied(true)
    } catch {
      setError('Der Link konnte nicht kopiert werden. Bitte markiere ihn und kopiere ihn von Hand.')
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold">Einladungen</h2>
        <p className="text-sm text-muted-foreground">
          Lade Personen per E-Mail-Adresse ein. Du bekommst einen Link, den du ihnen schickst. Er
          gilt 7 Tage und nur für diese Adresse.
        </p>
      </div>

      <form onSubmit={handleInvite} className="flex flex-wrap items-center gap-2">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-Mail-Adresse der Person"
          aria-label="E-Mail-Adresse für die Einladung"
          className="min-w-60 flex-1"
        />
        <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
          <SelectTrigger className="w-40" aria-label="Rolle der eingeladenen Person">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(roleLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={busy || email.trim() === ''}>
          <Send /> Einladen
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {link && (
        <div role="status" className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="text-sm">
            Einladung für <span className="font-medium">{link.email}</span> erstellt. Schicke ihr
            diesen Link – <strong>er wird nur jetzt angezeigt</strong>:
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly value={link.url} aria-label="Einladungslink" onFocus={(e) => e.target.select()} />
            <Button type="button" variant="outline" onClick={copyLink}>
              {copied ? <Check /> : <Copy />} {copied ? 'Kopiert' : 'Kopieren'}
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => setLink(null)} aria-label="Schließen">
              <X />
            </Button>
          </div>
        </div>
      )}

      {invitations.length > 0 && (
        <ul className="divide-y rounded-lg border bg-card">
          {invitations.map((i) => {
            const expired = isExpired(i)
            return (
              <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{i.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {roleLabels[i.role]} ·{' '}
                    {expired ? 'abgelaufen' : `gültig bis ${formatDate(i.expires_at)}`}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPendingRevoke(i)}>
                  Zurückziehen
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        destructive
        confirmLabel="Zurückziehen"
        request={
          pendingRevoke && {
            title: 'Einladung zurückziehen?',
            description: `Der Link für ${pendingRevoke.email} funktioniert danach nicht mehr.`,
          }
        }
        onCancel={() => setPendingRevoke(null)}
        onConfirm={async () => {
          if (pendingRevoke) {
            const err = await onRevoke(pendingRevoke.id)
            if (err) setError(err)
          }
          setPendingRevoke(null)
        }}
      />
    </section>
  )
}
