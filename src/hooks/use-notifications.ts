import { useEffect, useState } from 'react'
import { useMembership } from '@/hooks/use-membership'
import { useRealtimeChanges } from '@/hooks/use-realtime'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

export type NotificationItem = {
  id: string
  type: string
  detail: string | null
  created_at: string
  read_at: string | null
  ticket_id: string
  actor: { full_name: string | null } | null
  ticket: { number: number; title: string } | null
}

type Result = { organizationId: string; items: NotificationItem[]; unread: number }

/**
 * Benachrichtigungen des Nutzers in der gewählten Firma. Angelegt werden sie nur von
 * Datenbank-Triggern; hier lesen wir sie, markieren sie als gelesen und aktualisieren
 * die Liste per Realtime, sobald eine neue eintrifft.
 */
export function useNotifications() {
  const { organizationId } = useMembership()
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [result, setResult] = useState<Result | null>(null)
  const [version, setVersion] = useState(0)

  useRealtimeChanges(
    {
      table: 'notifications',
      filter: userId ? `user_id=eq.${userId}` : undefined,
      enabled: userId !== null,
    },
    () => setVersion((v) => v + 1),
  )

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false

    Promise.all([
      supabase
        .from('notifications')
        .select(
          'id, type, detail, created_at, read_at, ticket_id, actor:profiles!actor_id(full_name), ticket:tickets(number, title)',
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(20),
      // Die Zahl am Glocken-Symbol zählt ALLE ungelesenen, nicht nur die 20 sichtbaren
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .is('read_at', null),
    ]).then(([listRes, countRes]) => {
      if (cancelled || listRes.error) return
      setResult({ organizationId, items: listRes.data, unread: countRes.count ?? 0 })
    })

    return () => {
      cancelled = true
    }
  }, [organizationId, version])

  const current = result?.organizationId === organizationId ? result : null

  return {
    items: current?.items ?? [],
    unread: current?.unread ?? 0,
    async markRead(id: string) {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .is('read_at', null)
      setVersion((v) => v + 1)
    },
    async markAllRead() {
      if (!organizationId) return
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('organization_id', organizationId)
        .is('read_at', null)
      setVersion((v) => v + 1)
    },
  }
}
