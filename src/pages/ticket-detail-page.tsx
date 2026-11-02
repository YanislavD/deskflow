import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Lock, Pencil } from 'lucide-react'
import { CommentForm } from '@/components/comment-form'
import { PriorityBadge, StatusBadge } from '@/components/ticket-badges'
import { TicketControls } from '@/components/ticket-controls'
import { TicketEditForm } from '@/components/ticket-edit-form'
import { TicketEvents } from '@/components/ticket-events'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTicketDetail } from '@/hooks/use-ticket-detail'
import { useReplyTemplates } from '@/hooks/use-templates'
import { formatDate, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  )
}

export function TicketDetailPage() {
  const { id } = useParams()
  const {
    ticket,
    comments,
    events,
    names,
    staff,
    categories,
    isStaff,
    loading,
    error,
    addComment,
    updateTicket,
  } = useTicketDetail(id)
  const [editing, setEditing] = useState(false)
  // Vorlagen nur für Agents/Admins laden (Requester sehen sie ohnehin nicht)
  const { templates } = useReplyTemplates(isStaff ? (ticket?.organization_id ?? null) : null)

  const backLink = (
    <Link
      to="/tickets"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden /> Zurück zu den Tickets
    </Link>
  )

  if (loading) return <p className="text-muted-foreground">Ticket wird geladen …</p>

  if (error || !ticket) {
    return (
      <div className="space-y-4">
        {backLink}
        <p role={error ? 'alert' : undefined} className={error ? 'text-destructive' : 'text-muted-foreground'}>
          {error ?? 'Ticket nicht gefunden.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {backLink}

      <div className="space-y-3">
        <h1 className="text-xl font-semibold">
          <span className="mr-2 font-mono text-muted-foreground">#{ticket.number}</span>
          {ticket.title}
        </h1>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>
      </div>

      {isStaff && (
        <Card>
          <CardContent>
            <TicketControls ticket={ticket} staff={staff} onUpdate={updateTicket} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4">
          {editing ? (
            <TicketEditForm
              ticket={ticket}
              categories={categories}
              onCancel={() => setEditing(false)}
              onSave={async (patch) => {
                const err = await updateTicket(patch)
                if (!err) setEditing(false)
                return err
              }}
            />
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Meta label="Angefragt von">{ticket.requester?.full_name ?? '–'}</Meta>
                <Meta label="Zuständig">{ticket.assignee?.full_name ?? '–'}</Meta>
                <Meta label="Kategorie">{ticket.category?.name ?? '–'}</Meta>
                <Meta label="Fällig">{ticket.due_at ? formatDate(ticket.due_at) : '–'}</Meta>
              </dl>
              <div>
                <h2 className="mb-1 text-xs text-muted-foreground">Beschreibung</h2>
                <p className="text-sm whitespace-pre-wrap">
                  {ticket.description || 'Keine Beschreibung.'}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Erstellt am {formatDateTime(ticket.created_at)}
                </p>
                {isStaff && (
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Pencil /> Bearbeiten
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="font-semibold">Kommentare</h2>

        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground">Noch keine Kommentare.</p>
        )}

        {comments.map((c) => (
          <Card
            key={c.id}
            className={cn(c.is_internal && 'border-dashed border-chart-4/50 bg-chart-4/5')}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                {c.author?.full_name ?? 'Unbekannt'}
                {c.is_internal && (
                  <Badge variant="secondary" className="bg-chart-4/15 text-chart-4">
                    <Lock /> Intern
                  </Badge>
                )}
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {formatDateTime(c.created_at)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{c.body}</p>
            </CardContent>
          </Card>
        ))}

        <CommentForm canWriteInternal={isStaff} onSubmit={addComment} templates={templates} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Verlauf</h2>
        <TicketEvents events={events} names={names} />
      </section>
    </div>
  )
}
