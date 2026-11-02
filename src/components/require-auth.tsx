import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/lib/auth-context'

/** Zeigt die verschachtelten Routen nur an, wenn jemand angemeldet ist. */
export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        Lädt …
      </div>
    )
  }

  if (!session) {
    // "from" merken, damit man nach dem Login wieder dort landet
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
