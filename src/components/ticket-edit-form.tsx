import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { TicketDetail, TicketPatch } from '@/hooks/use-ticket-detail'
import { fromDateInputValue, toDateInputValue } from '@/lib/format'

// Radix-Select erlaubt keinen leeren String als Wert
const NO_CATEGORY = 'none'

type Props = {
  ticket: TicketDetail
  categories: { id: string; name: string }[]
  onSave: (patch: TicketPatch) => Promise<string | null>
  onCancel: () => void
}

/** Titel, Beschreibung, Kategorie und Fälligkeit bearbeiten (Agents/Admins). */
export function TicketEditForm({ ticket, categories, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(ticket.title)
  const [description, setDescription] = useState(ticket.description)
  const [categoryId, setCategoryId] = useState(ticket.category_id ?? NO_CATEGORY)
  const [dueDate, setDueDate] = useState(toDateInputValue(ticket.due_at))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const err = await onSave({
      title: title.trim(),
      description: description.trim(),
      category_id: categoryId === NO_CATEGORY ? null : categoryId,
      due_at: fromDateInputValue(dueDate),
    })
    setSaving(false)
    if (err) setError(err)
    // Bei Erfolg schließt die Seite das Formular (siehe onSave in der Detailseite)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit-title">Titel</Label>
        <Input
          id="edit-title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-description">Beschreibung</Label>
        <Textarea
          id="edit-description"
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="edit-category">Kategorie</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="edit-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>Keine Kategorie</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-due">Fällig am</Label>
          <Input
            id="edit-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={saving || title.trim() === ''}>
          {saving ? 'Speichern …' : 'Speichern'}
        </Button>
      </div>
    </form>
  )
}
