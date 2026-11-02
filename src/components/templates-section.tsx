import { useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ReplyTemplate } from '@/hooks/use-templates'

type Props = {
  templates: ReplyTemplate[]
  onAdd: (title: string, body: string) => Promise<string | null>
  onUpdate: (id: string, title: string, body: string) => Promise<string | null>
  onRemove: (id: string) => Promise<string | null>
}

/** Verwaltung der Antwortvorlagen (nur für Admins sichtbar). */
export function TemplatesSection({ templates, onAdd, onUpdate, onRemove }: Props) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [pendingDelete, setPendingDelete] = useState<ReplyTemplate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
    const err = await perform(() => onAdd(title.trim(), body.trim()))
    if (!err) {
      setTitle('')
      setBody('')
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!editingId) return
    const err = await perform(() => onUpdate(editingId, editTitle.trim(), editBody.trim()))
    if (!err) setEditingId(null)
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold">Antwortvorlagen</h2>
        <p className="text-sm text-muted-foreground">
          Textbausteine, die Agents in Kommentaren mit einem Klick einfügen können.
        </p>
      </div>

      <form onSubmit={handleAdd} className="space-y-2 rounded-lg border bg-card p-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titel, z. B. „Passwort zurückgesetzt“"
          aria-label="Titel der neuen Vorlage"
          maxLength={80}
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Text der Vorlage"
          aria-label="Text der neuen Vorlage"
          rows={3}
          maxLength={4000}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={busy || title.trim() === '' || body.trim() === ''}>
            <Plus /> Hinzufügen
          </Button>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {templates.length === 0 && (
        <p className="text-sm text-muted-foreground">Noch keine Vorlagen.</p>
      )}

      <ul className="divide-y rounded-lg border bg-card">
        {templates.map((t) => (
          <li key={t.id} className="px-3 py-2">
            {editingId === t.id ? (
              <form onSubmit={handleSave} className="space-y-2">
                <Input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  aria-label="Titel der Vorlage"
                  maxLength={80}
                />
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  aria-label="Text der Vorlage"
                  rows={3}
                  maxLength={4000}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="icon" onClick={() => setEditingId(null)} aria-label="Abbrechen">
                    <X />
                  </Button>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={busy || editTitle.trim() === '' || editBody.trim() === ''}
                    aria-label="Speichern"
                  >
                    <Check />
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{t.title}</div>
                  <p className="line-clamp-2 text-sm whitespace-pre-wrap text-muted-foreground">{t.body}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(t.id)
                      setEditTitle(t.title)
                      setEditBody(t.body)
                    }}
                    aria-label={`${t.title} bearbeiten`}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    onClick={() => setPendingDelete(t)}
                    aria-label={`${t.title} löschen`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        destructive
        confirmLabel="Löschen"
        request={
          pendingDelete && {
            title: 'Vorlage löschen?',
            description: `Die Vorlage „${pendingDelete.title}“ wird gelöscht. Bereits geschriebene Kommentare bleiben unverändert.`,
          }
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) perform(() => onRemove(pendingDelete.id))
          setPendingDelete(null)
        }}
      />
    </section>
  )
}
