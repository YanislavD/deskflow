import { useEffect, useState } from 'react'
import { useMembership } from '@/hooks/use-membership'
import { supabase } from '@/lib/supabase'
import type { TicketPriority } from '@/lib/ticket-labels'

export type CategoryOption = { id: string; name: string }

export type NewTicketInput = {
  title: string
  description: string
  categoryId: string | null
  priority: TicketPriority
}

/** Daten für das Formular "Neues Ticket": die Kategorien der gewählten Firma. */
export function useNewTicket() {
  const { organizationId } = useMembership()
  const [loaded, setLoaded] = useState<{
    organizationId: string
    categories: CategoryOption[]
  } | null>(null)

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false

    supabase
      .from('categories')
      .select('id, name')
      .eq('organization_id', organizationId)
      .order('name')
      .then(({ data }) => {
        if (!cancelled) setLoaded({ organizationId, categories: data ?? [] })
      })

    return () => {
      cancelled = true
    }
  }, [organizationId])

  const current = loaded?.organizationId === organizationId ? loaded : null

  /**
   * Legt das Ticket in der gewählten Firma an. Gesendet werden nur die Felder des Formulars:
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

  return {
    categories: current?.categories ?? [],
    loading: organizationId !== null && current === null,
    hasOrganization: organizationId !== null,
    createTicket,
  }
}
