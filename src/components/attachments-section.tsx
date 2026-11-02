import { useRef, useState } from 'react'
import { FileText, Image, Paperclip, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { useAttachments, type AttachmentItem } from '@/hooks/use-attachments'
import { useAuth } from '@/lib/auth-context'
import { ACCEPT, formatBytes } from '@/lib/attachments'
import { formatDateTime } from '@/lib/format'

type Props = {
  ticketId: string
  organizationId: string
  /** Admins dürfen alle Anhänge der Firma löschen, alle anderen nur eigene */
  isAdmin: boolean
}

export function AttachmentsSection({ ticketId, organizationId, isAdmin }: Props) {
  const { user } = useAuth()
  const { items, upload, remove, download } = useAttachments(ticketId, organizationId)
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AttachmentItem | null>(null)

  async function perform(action: () => Promise<string | null>) {
    setBusy(true)
    setError(null)
    const err = await action()
    setBusy(false)
    if (err) setError(err)
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return
    for (const file of Array.from(files)) {
      await perform(() => upload(file))
    }
    // Zurücksetzen, damit dieselbe Datei später nochmal gewählt werden kann
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">
          Anhänge{items.length > 0 && <span className="ml-1 text-muted-foreground">({items.length})</span>}
        </h2>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => fileInput.current?.click()}>
          <Paperclip /> {busy ? 'Wird hochgeladen …' : 'Datei hinzufügen'}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          aria-label="Datei auswählen"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Keine Anhänge. Erlaubt: Bilder, PDF und Text bis 5 MB.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((a) => {
            const canDelete = isAdmin || a.uploaded_by === user?.id
            const Icon = a.mime_type.startsWith('image/') ? Image : FileText
            return (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => perform(() => download(a))}
                    className="block max-w-full truncate text-left text-sm font-medium hover:text-primary"
                  >
                    {a.file_name}
                  </button>
                  <div className="text-xs text-muted-foreground">
                    {formatBytes(a.size_bytes)} · {a.uploader?.full_name ?? 'Unbekannt'} ·{' '}
                    {formatDateTime(a.created_at)}
                  </div>
                </div>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    onClick={() => setPendingDelete(a)}
                    aria-label={`${a.file_name} löschen`}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        destructive
        confirmLabel="Löschen"
        request={
          pendingDelete && {
            title: 'Anhang löschen?',
            description: `„${pendingDelete.file_name}“ wird endgültig gelöscht.`,
          }
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) perform(() => remove(pendingDelete))
          setPendingDelete(null)
        }}
      />
    </section>
  )
}
