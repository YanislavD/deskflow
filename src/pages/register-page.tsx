import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { LifeBuoy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth-context'

export function RegisterPage() {
  const { session, loading, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Kam man von einem Einladungslink? Dann nach der Registrierung dorthin zurück.
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  // Schon angemeldet? Dann gibt es hier nichts zu tun.
  if (!loading && session) return <Navigate to={from} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await signUp(fullName.trim(), email.trim(), password)
    setSubmitting(false)

    if (result.error) setError(result.error)
    else if (result.needsConfirmation) setConfirmationSent(true)
    else navigate(from, { replace: true }) // ohne Firma und ohne Einladung geht es zum Onboarding
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
            <CardTitle>Konto erstellen</CardTitle>
            <CardDescription>
              Registriere dich, um eine Firma zu gründen oder einer beizutreten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {confirmationSent ? (
              <p role="status" className="text-sm">
                Wir haben dir eine E-Mail geschickt. Bitte klicke auf den Link darin, um dein Konto
                zu bestätigen. Danach kannst du dich anmelden.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full-name">Name</Label>
                  <Input
                    id="full-name"
                    autoComplete="name"
                    required
                    maxLength={80}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
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
                <div className="space-y-2">
                  <Label htmlFor="password">Passwort</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Mindestens 8 Zeichen.</p>
                </div>

                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Konto wird erstellt …' : 'Registrieren'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Schon ein Konto?{' '}
          <Link to="/login" state={location.state} className="text-primary hover:underline">
            Anmelden
          </Link>
        </p>
      </div>
    </main>
  )
}
