import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/lib/auth-context'
import {
  OrganizationContext,
  type OrganizationContextValue,
  type OrganizationItem,
} from '@/lib/organization-context'
import { supabase } from '@/lib/supabase'

// Die Auswahl wird pro Nutzer im Browser gemerkt (localStorage kann fehlen/gesperrt sein).
const storageKey = (userId: string) => `deskflow.organization.${userId}`

function readStored(userId: string) {
  try {
    return localStorage.getItem(storageKey(userId))
  } catch {
    return null
  }
}

function writeStored(userId: string, organizationId: string) {
  try {
    localStorage.setItem(storageKey(userId), organizationId)
  } catch {
    // ohne Speicher gilt die Auswahl nur bis zum Neuladen
  }
}

type Loaded = { userId: string; organizations: OrganizationItem[]; selectedId: string | null }

async function loadOrganizations(userId: string, preferredId?: string | null): Promise<Loaded> {
  const { data } = await supabase
    .from('memberships')
    .select('role, organization:organizations(id, name, slug)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  const organizations: OrganizationItem[] = (data ?? []).flatMap((m) =>
    m.organization ? [{ ...m.organization, role: m.role }] : [],
  )

  // Gewünschte Firma -> gemerkte Firma -> älteste Firma
  const wanted = preferredId ?? readStored(userId)
  const selectedId = organizations.find((o) => o.id === wanted)?.id ?? organizations[0]?.id ?? null
  return { userId, organizations, selectedId }
}

/**
 * Hält alle Firmen des Nutzers und die aktuell gewählte. Alle Seiten arbeiten nur mit
 * der gewählten Firma (Ticketliste, neues Ticket, Verwaltung).
 */
export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    loadOrganizations(userId).then((result) => {
      if (!cancelled) setLoaded(result)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  // Daten eines früheren Nutzers (nach Abmelden/Anmelden) zählen nicht
  const ready = loaded !== null && loaded.userId === userId
  const loading = userId !== null && !ready

  const select = useCallback(
    (organizationId: string) => {
      if (!userId) return
      writeStored(userId, organizationId)
      setLoaded((prev) => (prev ? { ...prev, selectedId: organizationId } : prev))
    },
    [userId],
  )

  const reload = useCallback(
    async (preferredId?: string) => {
      if (!userId) return
      setLoaded(await loadOrganizations(userId, preferredId))
    },
    [userId],
  )

  const value = useMemo<OrganizationContextValue>(() => {
    const organizations = ready ? loaded.organizations : []
    const current = organizations.find((o) => o.id === loaded?.selectedId) ?? null
    return { organizations, current, loading, select, reload }
  }, [ready, loaded, loading, select, reload])

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>
}
