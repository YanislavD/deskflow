import { createContext, useContext } from 'react'
import type { MemberRole } from '@/lib/role-labels'

/** Eine Firma, in der der angemeldete Nutzer Mitglied ist – mit seiner Rolle dort. */
export type OrganizationItem = {
  id: string
  name: string
  slug: string
  role: MemberRole
}

export type OrganizationContextValue = {
  /** Alle Firmen des Nutzers (älteste zuerst) */
  organizations: OrganizationItem[]
  /** Die gerade ausgewählte Firma; null, wenn der Nutzer noch in keiner ist */
  current: OrganizationItem | null
  /** true, solange die Mitgliedschaften noch geladen werden */
  loading: boolean
  select: (organizationId: string) => void
  /** Lädt die Mitgliedschaften neu (z. B. nach dem Gründen einer Firma) und wählt optional eine aus */
  reload: (preferredId?: string) => Promise<void>
}

export const OrganizationContext = createContext<OrganizationContextValue | null>(null)

export function useOrganization() {
  const ctx = useContext(OrganizationContext)
  if (!ctx) throw new Error('useOrganization muss innerhalb von <OrganizationProvider> verwendet werden')
  return ctx
}

/** Zeigt den Namen; bei gleichnamigen Firmen zusätzlich den Slug, damit man sie unterscheiden kann. */
export function organizationLabel(org: OrganizationItem, all: OrganizationItem[]) {
  const duplicate = all.some((o) => o.id !== org.id && o.name === org.name)
  return duplicate ? `${org.name} (${org.slug})` : org.name
}
