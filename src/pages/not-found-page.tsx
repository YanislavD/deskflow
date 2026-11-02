import { Link } from 'react-router'
import { LifeBuoy } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <LifeBuoy className="size-10 text-primary" aria-hidden />
      <h1 className="text-2xl font-semibold">Seite nicht gefunden</h1>
      <p className="max-w-sm text-muted-foreground">
        Diese Adresse gibt es nicht. Vielleicht wurde die Seite verschoben oder der Link ist
        falsch.
      </p>
      <Button asChild>
        <Link to="/">Zur Startseite</Link>
      </Button>
    </main>
  )
}
