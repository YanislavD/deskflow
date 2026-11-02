import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import type { TicketPriority, TicketStatus } from '@/lib/ticket-labels'
import type { Database } from '@/types/database'

export type MemberRole = Database['public']['Enums']['member_role']

export type TicketDetail = {
  id: string
  organization_id: string
  number: number
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  assignee_id: string | null
  category_id: string | null
  due_at: string | null
  created_at: string
  category: { name: string } | null
  requester: { full_name: string | null } | null
  assignee: { full_name: string | null } | null
}

export type CommentItem = {
  id: string
  body: string
  is_internal: boolean
  created_at: string
  author: { full_name: string | null } | null
}

export type EventItem = {
  id: string
  type: string
  old_value: string | null
  new_value: string | null
  created_at: string
  actor: { full_name: string | null } | null
}

export type StaffMember = { id: string; name: string }

/** Was ein Agent/Admin am Ticket ändern darf. */
export type TicketPatch = Partial<{
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  assignee_id: string | null
  category_id: string | null
  due_at: string | null
}>

const commentSelect = 'id, body, is_internal, created_at, author:profiles!author_id(full_name)'

type Bundle = {
  ticket: TicketDetail
  comments: CommentItem[]
  events: EventItem[]
  names: Record<string, string>
  isStaff: boolean
  staff: StaffMember[]
  categories: { id: string; name: string }[]
}

type BundleResult = { bundle: Bundle | null; error: string | null }

/**
 * Holt alles, was die Detailseite braucht. Welche Kommentare/Ereignisse zurückkommen,
 * entscheidet die RLS in der Datenbank (Requester: keine internen Kommentare und nur
 * Status-Ereignisse).
 */
async function fetchBundle(ticketId: string, userId: string): Promise<BundleResult> {
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select(
      'id, organization_id, number, title, description, status, priority, assignee_id, category_id, due_at, created_at, category:categories(name), requester:profiles!requester_id(full_name), assignee:profiles!assignee_id(full_name)',
    )
    .eq('id', ticketId)
    .maybeSingle()

  if (error) return { bundle: null, error: 'Das Ticket konnte nicht geladen werden.' }
  // Nicht gefunden ODER durch RLS ausgeblendet – von außen nicht unterscheidbar (gewollt).
  if (!ticket) return { bundle: null, error: null }

  const [commentsRes, eventsRes, membershipRes] = await Promise.all([
    supabase
      .from('ticket_comments')
      .select(commentSelect)
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('ticket_events')
      .select('id, type, old_value, new_value, created_at, actor:profiles!actor_id(full_name)')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('memberships')
      .select('role')
      .eq('organization_id', ticket.organization_id)
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const role = membershipRes.data?.role
  const isStaff = role === 'admin' || role === 'agent'
  const events = eventsRes.data ?? []

  // Bei "assignee"-Ereignissen stehen UUIDs in old_value/new_value -> Namen nachladen
  const ids = new Set<string>()
  for (const e of events) {
    if (e.type !== 'assignee') continue
    if (e.old_value) ids.add(e.old_value)
    if (e.new_value) ids.add(e.new_value)
  }
  const names: Record<string, string> = {}
  if (ids.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', [...ids])
    for (const p of profiles ?? []) names[p.id] = p.full_name ?? 'Unbekannt'
  }

  // Auswahllisten für die Bearbeitung: Agents/Admins ("Zuständig") und Kategorien der Firma
  let staff: StaffMember[] = []
  let categories: { id: string; name: string }[] = []
  if (isStaff) {
    const { data: cats } = await supabase
      .from('categories')
      .select('id, name')
      .eq('organization_id', ticket.organization_id)
      .order('name')
    categories = cats ?? []

    const { data } = await supabase
      .from('memberships')
      .select('user_id, profile:profiles!user_id(full_name)')
      .eq('organization_id', ticket.organization_id)
      .in('role', ['admin', 'agent'])
    staff = (data ?? [])
      .map((m) => ({ id: m.user_id, name: m.profile?.full_name ?? 'Unbekannt' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
  }

  return {
    bundle: { ticket, comments: commentsRes.data ?? [], events, names, isStaff, staff, categories },
    error: null,
  }
}

export function useTicketDetail(ticketId: string | undefined) {
  const { user } = useAuth()
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ticketId || !user) return
    let cancelled = false

    fetchBundle(ticketId, user.id).then((result) => {
      if (cancelled) return
      setBundle(result.bundle)
      setError(result.error)
      setLoading(false)
    })

    // Falls die Seite verlassen wird, bevor die Antwort kommt, ignorieren wir sie.
    return () => {
      cancelled = true
    }
  }, [ticketId, user])

  /** Lädt still nach (ohne "Lädt …"-Anzeige), z. B. nach einer Änderung. */
  const refresh = useCallback(async () => {
    if (!ticketId || !user) return
    const result = await fetchBundle(ticketId, user.id)
    setBundle(result.bundle)
    setError(result.error)
  }, [ticketId, user])

  /** Schreibt einen Kommentar; gibt eine Fehlermeldung zurück oder null bei Erfolg. */
  async function addComment(body: string, isInternal: boolean) {
    if (!bundle) return 'Ticket nicht geladen.'
    const { error } = await supabase.from('ticket_comments').insert({
      ticket_id: bundle.ticket.id,
      organization_id: bundle.ticket.organization_id,
      body,
      is_internal: isInternal,
    })
    if (error) return 'Der Kommentar konnte nicht gespeichert werden.'
    await refresh()
    return null
  }

  /**
   * Ändert Status/Priorität/Zuständigen. Den Verlaufseintrag (ticket_events) schreibt
   * ein Trigger in der Datenbank – hier müssen wir nur neu laden.
   */
  async function updateTicket(patch: TicketPatch) {
    if (!bundle) return 'Ticket nicht geladen.'
    const { data, error } = await supabase
      .from('tickets')
      .update(patch)
      .eq('id', bundle.ticket.id)
      .select('id')
    if (error) return 'Die Änderung konnte nicht gespeichert werden.'
    // RLS meldet bei fehlender Berechtigung keinen Fehler, sondern ändert 0 Zeilen
    if (data.length === 0) return 'Keine Berechtigung, dieses Ticket zu ändern.'
    await refresh()
    return null
  }

  return {
    ticket: bundle?.ticket ?? null,
    comments: bundle?.comments ?? [],
    events: bundle?.events ?? [],
    names: bundle?.names ?? {},
    staff: bundle?.staff ?? [],
    categories: bundle?.categories ?? [],
    isStaff: bundle?.isStaff ?? false,
    loading,
    error,
    addComment,
    updateTicket,
  }
}
