import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { notifyProfileChanged } from '@/hooks/use-profile'
import { useAuth } from '@/lib/auth-context'
import { useOrganization } from '@/lib/organization-context'
import { roleLabels } from '@/lib/role-labels'
import { supabase } from '@/lib/supabase'

function NameForm() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        setName(data?.full_name ?? '')
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setMessage(null)
    // Die RLS-Policy profiles_update erlaubt nur die eigene Zeile
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim() })
      .eq('id', user.id)
      .select('id')
    setSaving(false)

    if (error || !data || data.length === 0) {
      setMessage({ ok: false, text: 'Der Name konnte nicht gespeichert werden.' })
    } else {
      setMessage({ ok: true, text: 'Gespeichert.' })
      notifyProfileChanged()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="profile-name">Name</Label>
        <Input
          id="profile-name"
          required
          maxLength={80}
          disabled={!loaded}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {message && (
        <p
          role={message.ok ? 'status' : 'alert'}
          className={message.ok ? 'text-sm text-chart-3' : 'text-sm text-destructive'}
        >
          {message.text}
        </p>
      )}
      <Button type="submit" disabled={saving || !loaded || name.trim() === ''}>
        {saving ? 'Wird gespeichert …' : 'Speichern'}
      </Button>
    </form>
  )
}

function PasswordForm() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setMessage({ ok: false, text: 'Die Passwörter stimmen nicht überein.' })
      return
    }
    setSaving(true)
    setMessage(null)
    const result = await updatePassword(password)
    setSaving(false)

    if (result.error) {
      setMessage({ ok: false, text: result.error })
    } else {
      setMessage({ ok: true, text: 'Dein Passwort wurde geändert.' })
      setPassword('')
      setConfirm('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-password">Neues Passwort</Label>
        <Input
          id="new-password"
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
        <Label htmlFor="confirm-password">Passwort wiederholen</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {message && (
        <p
          role={message.ok ? 'status' : 'alert'}
          className={message.ok ? 'text-sm text-chart-3' : 'text-sm text-destructive'}
        >
          {message.text}
        </p>
      )}
      <Button type="submit" disabled={saving}>
        {saving ? 'Wird gespeichert …' : 'Passwort ändern'}
      </Button>
    </form>
  )
}

export function ProfilePage() {
  const { user } = useAuth()
  const { current } = useOrganization()

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold">Mein Profil</h1>

      <Card>
        <CardHeader>
          <CardTitle>Angaben</CardTitle>
          <CardDescription>
            {user?.email}
            {current && ` · ${roleLabels[current.role]} bei ${current.name}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NameForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Passwort ändern</CardTitle>
          <CardDescription>Wähle ein neues Passwort für dein Konto.</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
