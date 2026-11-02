import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AuthContext, type AuthContextValue } from '@/lib/auth-context'

function translateAuthError(message: string) {
  if (message === 'Invalid login credentials') return 'E-Mail oder Passwort ist falsch.'
  if (message === 'Email not confirmed') return 'Bitte bestätige zuerst deine E-Mail-Adresse.'
  if (message === 'User already registered') return 'Mit dieser E-Mail-Adresse gibt es schon ein Konto.'
  if (message.startsWith('Password should be')) return 'Das Passwort ist zu kurz oder zu schwach.'
  if (message.includes('should be different')) return 'Das neue Passwort muss sich vom alten unterscheiden.'
  if (message.includes('rate limit') || message.includes('security purposes'))
    return 'Zu viele Versuche. Bitte warte einen Moment und versuche es erneut.'
  return 'Das hat nicht geklappt. Bitte versuche es erneut.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1) Gibt es schon eine gespeicherte Sitzung (z. B. nach F5)?
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // 2) Auf Login/Logout/Token-Erneuerung reagieren
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error ? translateAuthError(error.message) : null }
      },
      signUp: async (fullName, email, password) => {
        // full_name landet in raw_user_meta_data; der DB-Trigger macht daraus das Profil
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
        return {
          error: error ? translateAuthError(error.message) : null,
          // Ohne Sitzung ist E-Mail-Bestätigung eingeschaltet (in der Cloud der Standard)
          needsConfirmation: !error && !data.session,
        }
      },
      sendPasswordReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        return { error: error ? translateAuthError(error.message) : null }
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password })
        return { error: error ? translateAuthError(error.message) : null }
      },
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
