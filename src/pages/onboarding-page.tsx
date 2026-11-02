import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { LifeBuoy, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMembership } from '@/hooks/use-membership'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

function translateError(message: string) {
  if (message === 'invalid_name') return 'Der Firmenname muss zwischen 2 und 80 Zeichen lang sein.'
  if (message === 'already_in_organization') return 'Du gehörst bereits zu einer Firma.'
  return 'Die Firma konnte nicht erstellt werden. Bitte versuche es erneut.'
}

/** Für angemeldete Nutzer ohne Firma: eine neue Firma gründen (man wird deren Admin). */
export function OnboardingPage() {
  const { signOut } = useAuth()
  const { organizationId, loading } = useMembership()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return null
  // Wer schon eine Firma hat, braucht diese Seite nicht
  if (organizationId) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.rpc('create_organization', { org_name: name })
    setSubmitting(false)

    if (error) setError(translateError(error.message))
    else navigate('/', { replace: true })
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2 text-xl font-semibold">
          <LifeBuoy className="size-6 text-primary" aria-hidden />
          DeskFlow
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Firma gründen</CardTitle>
            <CardDescription>
              Du wirst Administrator der neuen Firma und kannst danach Kolleginnen und Kollegen
              hinzufügen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Name der Firma</Label>
                <Input
                  id="org-name"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="z. B. Müller & Partner GmbH"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={submitting || name.trim() === ''}>
                {submitting ? 'Wird erstellt …' : 'Firma erstellen'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3 text-center text-sm text-muted-foreground">
          <p>
            Wurdest du eingeladen? Bitte einen Administrator deiner Firma, dich mit deiner
            E-Mail-Adresse hinzuzufügen. Danach kannst du dich hier neu anmelden.
          </p>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut /> Abmelden
          </Button>
        </div>
      </div>
    </main>
  )
}
