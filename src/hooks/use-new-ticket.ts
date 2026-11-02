import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import type { TicketPriority } from '@/lib/ticket-labels'

export type CategoryOption = { id: string; name: string }

export type NewTicketInput = {
  title: string
  description: string
  categoryId: string | null
  priority: TicketPriority
}

/**
 * Daten für das Formular "Neues Ticket": in welcher Firma legt der Nutzer an,
 * und welche Kategorien gibt es dort?
 *
 * Hinweis: Wir nehmen die erste Mitgliedschaft des Nutzers. Wer in mehreren Firmen
 * Mitglied ist, bräuchte später eine Firmenauswahl.
 */
export function useNewTicket() {
  const { user } = useAuth()
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      const { data: membership } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (cancelled) return

      if (membership) {
        const { data: cats } = await supabase
          .from('categories')
          .select('id, name')
          .eq('organization_id', membership.organization_id)
          .order('name')
        if (cancelled) return
        setOrganizationId(membership.organization_id)
        setCategories(cats ?? [])
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

  /**
   * Legt das Ticket an. Gesendet werden nur die Felder des Formulars:
   * - number: vergibt der Datenbank-Trigger
   * - requester_id: Standardwert in der DB ist der angemeldete Nutzer
   * - status: Standardwert "neu"
   * Die RLS-Policy erlaubt Requestern ohnehin nur Tickets für sich selbst.
   */
  async function createTicket(input: NewTicketInput) {
    if (!organizationId) return { id: null, error: 'Keine Firma gefunden.' }

    const { data, error } = await supabase
      .from('tickets')
      .insert({
        organization_id: organizationId,
        title: input.title,
        description: input.description,
        category_id: input.categoryId,
        priority: input.priority,
      })
      .select('id')
      .single()

    if (error) return { id: null, error: 'Das Ticket konnte nicht erstellt werden.' }
    return { id: data.id, error: null }
  }

  return { categories, loading, hasOrganization: organizationId !== null, createTicket }
}
