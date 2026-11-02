import { useEffect, useState } from 'react'
import { useRealtimeChanges } from '@/hooks/use-realtime'
import { ALLOWED_TYPES, validateFile } from '@/lib/attachments'
import { supabase } from '@/lib/supabase'

const BUCKET = 'ticket-attachments'

export type AttachmentItem = {
  id: string
  file_name: string
  mime_type: string
  size_bytes: number
  storage_path: string
  created_at: string
  uploaded_by: string | null
  uploader: { full_name: string | null } | null
}

/**
 * Dateianhänge eines Tickets. Wer sie sehen/hochladen/löschen darf, entscheidet die
 * Datenbank (RLS auf ticket_attachments und auf dem Storage) – nicht dieser Code.
 */
export function useAttachments(ticketId: string, organizationId: string) {
  const [items, setItems] = useState<AttachmentItem[]>([])
  const [version, setVersion] = useState(0)

  useRealtimeChanges({ table: 'ticket_attachments', filter: `ticket_id=eq.${ticketId}` }, () =>
    setVersion((v) => v + 1),
  )

  useEffect(() => {
    let cancelled = false
    supabase
      .from('ticket_attachments')
      .select(
        'id, file_name, mime_type, size_bytes, storage_path, created_at, uploaded_by, uploader:profiles!uploaded_by(full_name)',
      )
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!cancelled && data) setItems(data)
      })
    return () => {
      cancelled = true
    }
  }, [ticketId, version])

  const reload = () => setVersion((v) => v + 1)

  /**
   * Hochladen in zwei Schritten: erst der Metadaten-Eintrag, dann die Datei. Scheitert der
   * Upload, räumen wir den Eintrag wieder weg. (Umgekehrt würde bei einem Fehler eine Datei
   * ohne Eintrag zurückbleiben, die niemand mehr löschen könnte.)
   */
  async function upload(file: File): Promise<string | null> {
    const invalid = validateFile(file)
    if (invalid) return invalid

    // Pfad: <firma>/<ticket>/<zufalls-id>.<endung aus dem Typ>
    const path = `${organizationId}/${ticketId}/${crypto.randomUUID()}.${ALLOWED_TYPES[file.type]}`

    const { data: row, error: rowError } = await supabase
      .from('ticket_attachments')
      .insert({
        organization_id: organizationId,
        ticket_id: ticketId,
        file_name: file.name.slice(0, 200),
        mime_type: file.type,
        size_bytes: file.size,
        storage_path: path,
      })
      .select('id')
      .single()
    if (rowError) return 'Der Anhang konnte nicht gespeichert werden.'

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) {
      await supabase.from('ticket_attachments').delete().eq('id', row.id)
      reload()
      return 'Die Datei konnte nicht hochgeladen werden.'
    }

    reload()
    return null
  }

  /** Löschen: ERST die Datei, DANN der Eintrag (siehe Migration: sonst bleibt die Datei übrig). */
  async function remove(item: AttachmentItem): Promise<string | null> {
    const { data, error } = await supabase.storage.from(BUCKET).remove([item.storage_path])
    // Storage meldet fehlende Rechte nicht als Fehler, sondern entfernt 0 Dateien
    if (error || data.length === 0) return 'Der Anhang konnte nicht gelöscht werden.'

    const { error: rowError } = await supabase.from('ticket_attachments').delete().eq('id', item.id)
    if (rowError) return 'Der Anhang konnte nicht gelöscht werden.'

    reload()
    return null
  }

  /** Lädt die Datei über einen kurzlebigen, signierten Link herunter (der Bucket ist privat). */
  async function download(item: AttachmentItem): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(item.storage_path, 60, { download: item.file_name })
    if (error) return 'Die Datei ist nicht verfügbar.'

    const link = document.createElement('a')
    link.href = data.signedUrl
    link.click()
    return null
  }

  return { items, upload, remove, download }
}
