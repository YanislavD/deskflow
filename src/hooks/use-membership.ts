import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import type { MemberRole } from '@/lib/role-labels'

/**
 * In welcher Firma ist der Nutzer und mit welcher Rolle?
 * (Es wird die erste Mitgliedschaft genommen – eine Firmenauswahl gibt es noch nicht.)
 */
export function useMembership() {
  const { user } = useAuth()
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [role, setRole] = useState<MemberRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    supabase
      .from('memberships')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setOrganizationId(data?.organization_id ?? null)
        setRole(data?.role ?? null)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  return { organizationId, role, isAdmin: role === 'admin', loading }
}
