import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { MemberRole } from '@/lib/role-labels'

export type MemberItem = {
  id: string
  user_id: string
  role: MemberRole
  created_at: string
  profile: { full_name: string | null } | null
}

export type CategoryItem = { id: string; name: string }

/** Die Datenbank wirft kurze Codes (siehe Migration) – hier werden sie zu deutschem Text. */
function translateError(error: { message: string; code?: string }) {
  switch (error.message) {
    case 'last_admin':
      return 'Mindestens ein Admin muss in der Firma bleiben.'
    case 'user_not_found':
      return 'Es gibt keinen registrierten Nutzer mit dieser E-Mail-Adresse.'
    case 'already_member':
      return 'Diese Person ist bereits Mitglied der Firma.'
    case 'forbidden':
      return 'Dafür fehlt dir die Berechtigung.'
  }
  if (error.code === '23505') return 'Diesen Namen gibt es schon.'
  return 'Die Aktion ist fehlgeschlagen. Bitte versuche es erneut.'
}

type AdminData = { members: MemberItem[]; categories: CategoryItem[] }

async function fetchAdminData(organizationId: string): Promise<AdminData | null> {
  const [membersRes, categoriesRes] = await Promise.all([
    supabase
      .from('memberships')
      .select('id, user_id, role, created_at, profile:profiles!user_id(full_name)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true }),
    supabase
      .from('categories')
      .select('id, name')
      .eq('organization_id', organizationId)
      .order('name'),
  ])
  if (membersRes.error || categoriesRes.error) return null
  return { members: membersRes.data, categories: categoriesRes.data }
}

/** Mitglieder und Kategorien einer Firma samt Änderungs-Aktionen (nur für Admins gedacht). */
export function useAdminData(organizationId: string | null) {
  const [data, setData] = useState<AdminData>({ members: [], categories: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apply = useCallback((result: AdminData | null) => {
    if (result) {
      setData(result)
      setError(null)
    } else {
      setError('Die Daten konnten nicht geladen werden.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false
    fetchAdminData(organizationId).then((result) => {
      if (!cancelled) apply(result)
    })
    return () => {
      cancelled = true
    }
  }, [organizationId, apply])

  /** Führt eine Änderung aus und lädt danach neu. Gibt eine Fehlermeldung oder null zurück. */
  async function run(
    action: PromiseLike<{ error: { message: string; code?: string } | null; data?: unknown }>,
  ) {
    const { error, data: result } = await action
    if (error) return translateError(error)
    // RLS meldet fehlende Rechte nicht als Fehler, sondern ändert 0 Zeilen
    if (Array.isArray(result) && result.length === 0) return translateError({ message: 'forbidden' })
    if (organizationId) apply(await fetchAdminData(organizationId))
    return null
  }

  return {
    members: data.members,
    categories: data.categories,
    loading,
    error,

    addMember: (email: string, role: MemberRole) =>
      run(
        supabase.rpc('add_member_by_email', {
          org: organizationId!,
          member_email: email,
          member_role: role,
        }),
      ),
    changeRole: (membershipId: string, role: MemberRole) =>
      run(supabase.from('memberships').update({ role }).eq('id', membershipId).select('id')),
    removeMember: (membershipId: string) =>
      run(supabase.from('memberships').delete().eq('id', membershipId).select('id')),

    addCategory: (name: string) =>
      run(supabase.from('categories').insert({ organization_id: organizationId!, name }).select('id')),
    renameCategory: (id: string, name: string) =>
      run(supabase.from('categories').update({ name }).eq('id', id).select('id')),
    deleteCategory: (id: string) =>
      run(supabase.from('categories').delete().eq('id', id).select('id')),
  }
}
