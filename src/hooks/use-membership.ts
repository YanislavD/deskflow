import { useOrganization } from '@/lib/organization-context'

/**
 * In welcher Firma arbeitet der Nutzer gerade und mit welcher Rolle?
 * (Die Firma wählt man oben im Kopfbereich; die Daten kommen aus dem OrganizationProvider.)
 */
export function useMembership() {
  const { current, loading } = useOrganization()
  return {
    organizationId: current?.id ?? null,
    role: current?.role ?? null,
    isAdmin: current?.role === 'admin',
    loading,
  }
}
