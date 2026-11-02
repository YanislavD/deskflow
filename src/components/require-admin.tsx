import { Navigate, Outlet } from 'react-router'
import { useMembership } from '@/hooks/use-membership'

/**
 * Nur für Admins. Das ist wieder nur Komfort: Die echten Rechte erzwingen die
 * RLS-Policies (memberships/categories: nur Admin darf schreiben).
 */
export function RequireAdmin() {
  const { isAdmin, loading } = useMembership()

  if (loading) return <p className="text-muted-foreground">Wird geladen …</p>
  if (!isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}
