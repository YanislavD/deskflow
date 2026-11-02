import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { useNewTicket } from '@/hooks/use-new-ticket'
import { priorityLabels, type TicketPriority } from '@/lib/ticket-labels'

// Radix-Select erlaubt keinen leeren String als Wert
const NO_CATEGORY = 'none'

export function NewTicketPage() {
  const navigate = useNavigate()
  const { categories, loading, hasOrganization, createTicket } = useNewTicket()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState(NO_CATEGORY)
  const [priority, setPriority] = useState<TicketPriority>('mittel')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await createTicket({
      title: title.trim(),
      description: description.trim(),
      categoryId: categoryId === NO_CATEGORY ? null : categoryId,
      priority,
    })
    setSubmitting(false)

    if (result.error) setError(result.error)
    else navigate(`/tickets/${result.id}`)
  }

  return (
    <div className="space-y-6">
      <Link
        to="/tickets"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Zurück zu den Tickets
      </Link>

      <h1 className="text-xl font-semibold">Neues Ticket</h1>

      {loading && <p className="text-muted-foreground">Wird geladen …</p>}

      {!loading && !hasOrganization && (
        <p role="alert" className="text-destructive">
          Dein Konto gehört zu keiner Firma. Bitte wende dich an einen Administrator.
        </p>
      )}

      {!loading && hasOrganization && (
        <Card>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titel</Label>
                <Input
                  id="title"
                  required
                  maxLength={200}
                  placeholder="Worum geht es in einem Satz?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  rows={6}
                  placeholder="Was ist passiert? Seit wann? Gibt es eine Fehlermeldung?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Kategorie</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger id="category" className="w-full">
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
                  <Label htmlFor="priority">Priorität</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
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
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => navigate('/tickets')}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={submitting || title.trim() === ''}>
                  {submitting ? 'Wird erstellt …' : 'Ticket erstellen'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
