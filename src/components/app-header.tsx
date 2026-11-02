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

// NavLink ruft diese Funktion auf und übergibt, ob der Link gerade aktiv ist.
// "extra" hängt weitere Klassen an (z. B. um den Link nur auf kleinen Bildschirmen zu zeigen).
const navClass =
  (extra?: string) =>
  ({ isActive }: { isActive: boolean }) =>
    cn(
      'text-sm hover:text-foreground',
      isActive ? 'text-foreground' : 'text-muted-foreground',
      extra,
    )

function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  return (
    <>
      <NavLink to="/" end className={navClass()}>
        Übersicht
      </NavLink>
      <NavLink to="/tickets" className={navClass()}>
        Tickets
      </NavLink>
      {isAdmin && (
        <NavLink to="/admin" className={navClass()}>
          Verwaltung
        </NavLink>
      )}
      {/* Der Name oben rechts erscheint erst ab "md"; darunter gibt es diesen Link */}
      <NavLink to="/profile" className={navClass('md:hidden')}>
        Profil
      </NavLink>
    </>
  )
}

export function AppHeader() {
  const { user, signOut } = useAuth()
  const { isAdmin } = useMembership()
  const { organizations, current, select } = useOrganization()
  const navigate = useNavigate()
  const name = useProfileName()

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 sm:h-14 sm:flex-nowrap sm:py-0">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <LifeBuoy className="size-5 text-primary" aria-hidden />
            DeskFlow
          </Link>
          <nav className="hidden items-center gap-4 sm:flex">
            <NavLinks isAdmin={isAdmin} />
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
          <NavLink to="/profile" className={navClass('hidden md:inline')}>
            {name ?? user?.email}
          </NavLink>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut /> Abmelden
          </Button>
        </div>

        {/* Telefon: Navigation als eigene Zeile unter Logo und Abmelden */}
        <nav className="flex w-full items-center gap-4 overflow-x-auto pb-1 sm:hidden">
          <NavLinks isAdmin={isAdmin} />
        </nav>
      </div>
    </header>
  )
}
