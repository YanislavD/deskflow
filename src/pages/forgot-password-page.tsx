import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { LifeBuoy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth-context'

export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await sendPasswordReset(email.trim())
    setSubmitting(false)
    if (result.error) setError(result.error)
    else setSent(true)
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-2 text-xl font-semibold">
          <LifeBuoy className="size-6 text-primary" aria-hidden />
          DeskFlow
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Passwort vergessen</CardTitle>
            <CardDescription>
              Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link zum Zurücksetzen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              // Bewusst dieselbe Antwort, egal ob es das Konto gibt: So kann niemand
              // durch Ausprobieren herausfinden, wer ein Konto hat.
              <p role="status" className="text-sm">
                Falls es zu dieser Adresse ein Konto gibt, haben wir dir eine E-Mail mit einem Link
                geschickt.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Wird gesendet …' : 'Link senden'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline">
            Zurück zur Anmeldung
          </Link>
        </p>
      </div>
    </main>
  )
}
