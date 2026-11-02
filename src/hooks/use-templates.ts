import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type ReplyTemplate = { id: string; title: string; body: string }

type Result = { organizationId: string; templates: ReplyTemplate[] }

function translateError(error: { code?: string }) {
  if (error.code === '23505') return 'Eine Vorlage mit diesem Titel gibt es schon.'
  if (error.code === '42501') return 'Dafür fehlt dir die Berechtigung.'
  return 'Die Aktion ist fehlgeschlagen. Bitte versuche es erneut.'
}

/**
 * Antwortvorlagen der Firma. Agents/Admins dürfen lesen, nur Admins dürfen ändern –
 * das erzwingt die RLS (siehe Migration), nicht dieser Code.
 * Mit organizationId = null passiert nichts (z. B. für Requester, die keine Vorlagen sehen).
 */
export function useReplyTemplates(organizationId: string | null) {
  const [result, setResult] = useState<Result | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false

    supabase
      .from('reply_templates')
      .select('id, title, body')
      .eq('organization_id', organizationId)
      .order('title')
      .then(({ data }) => {
        if (!cancelled) setResult({ organizationId, templates: data ?? [] })
      })

    return () => {
      cancelled = true
    }
  }, [organizationId, version])

  /** Führt eine Änderung aus und lädt danach neu. Gibt eine Fehlermeldung oder null zurück. */
  async function run(
    action: PromiseLike<{ error: { code?: string } | null; data?: unknown }>,
  ) {
    const { error, data } = await action
    if (error) return translateError(error)
    // RLS meldet fehlende Rechte nicht als Fehler, sondern ändert 0 Zeilen
    if (Array.isArray(data) && data.length === 0) return translateError({ code: '42501' })
    setVersion((v) => v + 1)
    return null
  }

  const current = result?.organizationId === organizationId ? result : null

  return {
    templates: current?.templates ?? [],
    add: (title: string, body: string) =>
      run(
        supabase
          .from('reply_templates')
          .insert({ organization_id: organizationId!, title, body })
          .select('id'),
      ),
    update: (id: string, title: string, body: string) =>
      run(supabase.from('reply_templates').update({ title, body }).eq('id', id).select('id')),
    remove: (id: string) =>
      run(supabase.from('reply_templates').delete().eq('id', id).select('id')),
  }
}
