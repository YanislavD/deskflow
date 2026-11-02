import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

type State = { hasError: boolean }

/**
 * Fängt Fehler beim Darstellen ab. Ohne sie würde ein einziger Fehler in irgendeinem
 * Bauteil die ganze Seite weiß machen. Hinweis: Fehler in Event-Handlern und in
 * asynchronem Code fängt React hier NICHT ab – die behandeln wir dort, wo sie entstehen.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Hier würde man den Fehler an einen Dienst wie Sentry schicken
    console.error('Unerwarteter Fehler in der Oberfläche:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main
        role="alert"
        className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center"
      >
        <TriangleAlert className="size-10 text-destructive" aria-hidden />
        <h1 className="text-2xl font-semibold">Etwas ist schiefgelaufen</h1>
        <p className="max-w-sm text-muted-foreground">
          Es ist ein unerwarteter Fehler aufgetreten. Deine Daten sind sicher. Bitte lade die Seite
          neu.
        </p>
        <Button onClick={() => window.location.assign('/')}>Seite neu laden</Button>
      </main>
    )
  }
}
