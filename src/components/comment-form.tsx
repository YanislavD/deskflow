import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ReplyTemplate } from '@/hooks/use-templates'

const BLANK_LINE = String.fromCharCode(10, 10)

type Props = {
  /** Nur Agents/Admins dürfen interne Notizen schreiben. */
  canWriteInternal: boolean
  onSubmit: (body: string, isInternal: boolean) => Promise<string | null>
  /** Antwortvorlagen der Firma (nur für Agents/Admins; sonst leer) */
  templates?: ReplyTemplate[]
}

export function CommentForm({ canWriteInternal, onSubmit, templates = [] }: Props) {
  const [body, setBody] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text) return

    setSubmitting(true)
    setError(null)
    const err = await onSubmit(text, canWriteInternal && isInternal)
    setSubmitting(false)

    if (err) {
      setError(err)
    } else {
      setBody('')
      setIsInternal(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {templates.length > 0 && (
        // value="" zeigt immer wieder den Platzhalter: Die Auswahl ist eine Aktion ("einfügen"),
        // kein dauerhafter Wert.
        <Select
          value=""
          onValueChange={(id) => {
            const template = templates.find((t) => t.id === id)
            if (!template) return
            // Steht schon Text da, hängen wir die Vorlage mit einer Leerzeile an
            setBody((prev) => (prev.trim() ? prev + BLANK_LINE + template.body : template.body))
          }}
        >
          <SelectTrigger size="sm" className="w-full sm:w-72" aria-label="Antwortvorlage einfügen">
            <SelectValue placeholder="Antwortvorlage einfügen …" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Kommentar schreiben …"
        rows={3}
        aria-label="Kommentar"
      />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        {canWriteInternal ? (
          <div className="flex items-center gap-2">
            <Checkbox
              id="internal"
              checked={isInternal}
              onCheckedChange={(checked) => setIsInternal(checked === true)}
            />
            <Label htmlFor="internal" className="text-sm font-normal">
              Interne Notiz (für den Anfragenden nicht sichtbar)
            </Label>
          </div>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={submitting || body.trim() === ''}>
          {submitting ? 'Senden …' : 'Kommentieren'}
        </Button>
      </div>
    </form>
  )
}
