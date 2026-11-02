import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router'
import { LifeBuoy, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMembership } from '@/hooks/use-membership'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn('text-sm hover:text-foreground', isActive ? 'text-foreground' : 'text-muted-foreground')

export function AppHeader() {
  const { user, signOut } = useAuth()
  const { isAdmin } = useMembership()
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setName(data?.full_name ?? null))
  }, [user])

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <LifeBuoy className="size-5 text-primary" aria-hidden />
            DeskFlow
          </Link>
          <nav className="flex items-center gap-4">
            <NavLink to="/" end className={navClass}>
              Tickets
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={navClass}>
                Verwaltung
              </NavLink>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {name ?? user?.email}
          </span>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut /> Abmelden
          </Button>
        </div>
      </div>
    </header>
  )
}
