import { Navigate, Outlet } from 'react-router'
import { useMembership } from '@/hooks/use-membership'

/** Die Ticket-Seiten gibt es nur mit Firma. Wer noch keine hat, gründet erst eine. */
export function RequireMembership() {
  const { organizationId, loading } = useMembership()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Lädt …
      </div>
    )
  }
  if (!organizationId) return <Navigate to="/onboarding" replace />
  return <Outlet />
}
