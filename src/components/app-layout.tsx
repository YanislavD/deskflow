import { Outlet } from 'react-router'
import { AppHeader } from '@/components/app-header'

/** Rahmen für alle angemeldeten Seiten: Kopfzeile oben, Inhalt darunter. */
export function AppLayout() {
  return (
    <div className="min-h-svh">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
