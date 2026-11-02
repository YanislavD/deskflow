import { Link, NavLink, useNavigate } from 'react-router'
import { Building2, LifeBuoy, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMembership } from '@/hooks/use-membership'
import { useProfileName } from '@/hooks/use-profile'
import { useAuth } from '@/lib/auth-context'
import { organizationLabel, useOrganization } from '@/lib/organization-context'
import { cn } from '@/lib/utils'

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn('text-sm hover:text-foreground', isActive ? 'text-foreground' : 'text-muted-foreground')

export function AppHeader() {
  const { user, signOut } = useAuth()
  const { isAdmin } = useMembership()
  const { organizations, current, select } = useOrganization()
  const navigate = useNavigate()
  const name = useProfileName()

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <LifeBuoy className="size-5 text-primary" aria-hidden />
            DeskFlow
          </Link>
          <nav className="flex items-center gap-4">
            <NavLink to="/" end className={navClass}>
              Übersicht
            </NavLink>
            <NavLink to="/tickets" className={navClass}>
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
          {organizations.length > 1 && current ? (
            <Select
              value={current.id}
              onValueChange={(id) => {
                select(id)
                navigate('/') // die aktuelle Seite gehört zur alten Firma
              }}
            >
              <SelectTrigger size="sm" className="w-48" aria-label="Firma wechseln">
                <Building2 className="size-4" aria-hidden />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {organizationLabel(o, organizations)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            current && (
              <span className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
                <Building2 className="size-4" aria-hidden />
                {current.name}
              </span>
            )
          )}
          <NavLink to="/profile" className={cn(navClass, 'hidden md:inline')}>
            {name ?? user?.email}
          </NavLink>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut /> Abmelden
          </Button>
        </div>
      </div>
    </header>
  )
}
