import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { MemberRole } from '@/lib/role-labels'

export type InvitationItem = {
  id: string
  email: string
  role: MemberRole
  created_at: string
  expires_at: string
}

function translateError(message: string) {
  switch (message) {
    case 'invalid_email':
      return 'Bitte gib eine gültige E-Mail-Adresse ein.'
    case 'already_member':
      return 'Diese Person ist bereits Mitglied der Firma.'
    case 'forbidden':
      return 'Dafür fehlt dir die Berechtigung.'
    default:
      return 'Die Aktion ist fehlgeschlagen. Bitte versuche es erneut.'
  }
}

/** Offene Einladungen einer Firma (nur Admins sehen sie – das erzwingt die RLS). */
export function useInvitations(organizationId: string | null) {
  const [result, setResult] = useState<{ organizationId: string; items: InvitationItem[] } | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false

    supabase
      .from('invitations')
      .select('id, email, role, created_at, expires_at')
      .eq('organization_id', organizationId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setResult({ organizationId, items: data ?? [] })
      })

    return () => {
      cancelled = true
    }
  }, [organizationId, version])

  const current = result?.organizationId === organizationId ? result : null

  return {
    invitations: current?.items ?? [],

    /**
     * Erstellt eine Einladung. Gibt den Token zurück – er wird nur jetzt einmal sichtbar,
     * in der Datenbank steht später nur sein Hash.
     */
    async invite(email: string, role: MemberRole): Promise<{ token: string | null; error: string | null }> {
      const { data, error } = await supabase.rpc('create_invitation', {
        org: organizationId!,
        invite_email: email,
        invite_role: role,
      })
      if (error) return { token: null, error: translateError(error.message) }
      setVersion((v) => v + 1)
      return { token: data, error: null }
    },

    async revoke(id: string): Promise<string | null> {
      const { error } = await supabase.from('invitations').delete().eq('id', id)
      if (error) return translateError(error.message)
      setVersion((v) => v + 1)
      return null
    },
  }
}
