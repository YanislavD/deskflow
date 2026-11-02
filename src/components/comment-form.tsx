import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  /** Nur Agents/Admins dürfen interne Notizen schreiben. */
  canWriteInternal: boolean
  onSubmit: (body: string, isInternal: boolean) => Promise<string | null>
}

export function CommentForm({ canWriteInternal, onSubmit }: Props) {
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
