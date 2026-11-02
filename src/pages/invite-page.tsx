import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { LifeBuoy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import { useOrganization } from '@/lib/organization-context'
import { supabase } from '@/lib/supabase'

function translateError(message: string) {
  if (message === 'invalid_invitation')
    return 'Diese Einladung ist ungültig, abgelaufen oder wurde schon benutzt.'
  if (message === 'wrong_email')
    return 'Diese Einladung gilt für eine andere E-Mail-Adresse. Melde dich mit der eingeladenen Adresse an.'
  return 'Die Einladung konnte nicht angenommen werden. Bitte versuche es erneut.'
}

/**
 * Ziel des Einladungslinks (/invite/<token>). Die Route liegt hinter der Anmeldung:
 * Wer noch nicht angemeldet ist, landet zuerst bei Login/Registrierung und kommt danach hierher zurück.
 */
export function InvitePage() {
  const { token } = useParams()
  const { user, signOut } = useAuth()
  const { reload } = useOrganization()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function accept() {
    if (!token) return
    setSubmitting(true)
    setError(null)
    const { data: organizationId, error } = await supabase.rpc('accept_invitation', {
      invite_token: token,
    })

    if (error) {
      setSubmitting(false)
      setError(translateError(error.message))
      return
    }

    // Mitgliedschaften neu laden und die neue Firma auswählen
    await reload(organizationId)
    setSubmitting(false)
    navigate('/', { replace: true })
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
            <CardTitle>Einladung</CardTitle>
            <CardDescription>
              Du wurdest zu einer Firma in DeskFlow eingeladen. Angemeldet als {user?.email}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button className="w-full" onClick={accept} disabled={submitting}>
              {submitting ? 'Wird angenommen …' : 'Einladung annehmen'}
            </Button>
            <Button variant="ghost" className="w-full" onClick={signOut}>
              Mit einem anderen Konto anmelden
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
