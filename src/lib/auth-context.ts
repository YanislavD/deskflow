import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type AuthContextValue = {
  session: Session | null
  user: User | null
  /** true, solange wir noch prüfen, ob schon eine Sitzung gespeichert ist */
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  /** needsConfirmation: true, wenn erst noch der Link in der Bestätigungs-E-Mail geklickt werden muss */
  signUp: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>
  /** Schickt eine E-Mail mit Link zum Zurücksetzen des Passworts */
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>
  /** Setzt ein neues Passwort für den gerade angemeldeten Nutzer (nach dem Klick auf den Link) */
  updatePassword: (password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth muss innerhalb von <AuthProvider> verwendet werden')
  return ctx
}
