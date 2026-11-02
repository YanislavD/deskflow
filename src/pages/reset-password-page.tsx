import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { LifeBuoy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth-context'

/**
 * Zielseite des Links aus der E-Mail. Der Supabase-Client liest die Sitzung aus der URL
 * (Recovery-Sitzung) – ohne gültigen Link gibt es hier keine Sitzung und damit nichts zu tun.
 */
export function ResetPasswordPage() {
  const { session, loading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Die Passwörter stimmen nicht überein.')
      return
    }
    setError(null)
    setSubmitting(true)
    const result = await updatePassword(password)
    setSubmitting(false)
    if (result.error) setError(result.error)
    else setDone(true)
  }

  let content
  if (loading) {
    content = <p className="text-sm text-muted-foreground">Link wird geprüft …</p>
  } else if (!session) {
    content = (
      <div className="space-y-3 text-sm">
        <p role="alert" className="text-destructive">
          Dieser Link ist ungültig oder abgelaufen.
        </p>
        <Link to="/forgot-password" className="text-primary hover:underline">
          Neuen Link anfordern
        </Link>
      </div>
    )
  } else if (done) {
    content = (
      <div className="space-y-3 text-sm">
        <p role="status">Dein Passwort wurde geändert.</p>
        <Button className="w-full" onClick={() => navigate('/', { replace: true })}>
          Weiter zu DeskFlow
        </Button>
      </div>
    )
  } else {
    content = (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Neues Passwort</Label>
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
        <div className="space-y-2">
          <Label htmlFor="confirm">Passwort wiederholen</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Wird gespeichert …' : 'Passwort speichern'}
        </Button>
      </form>
    )
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
            <CardTitle>Neues Passwort festlegen</CardTitle>
            <CardDescription>Wähle ein neues Passwort für dein Konto.</CardDescription>
          </CardHeader>
          <CardContent>{content}</CardContent>
        </Card>
      </div>
    </main>
  )
}
