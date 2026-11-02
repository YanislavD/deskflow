import { useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CategoryItem } from '@/hooks/use-admin-data'

type Props = {
  categories: CategoryItem[]
  onAdd: (name: string) => Promise<string | null>
  onRename: (id: string, name: string) => Promise<string | null>
  onDelete: (id: string) => Promise<string | null>
}

export function CategoriesSection({ categories, onAdd, onRename, onDelete }: Props) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CategoryItem | null>(null)

  async function perform(action: () => Promise<string | null>) {
    setBusy(true)
    setError(null)
    const err = await action()
    setBusy(false)
    if (err) setError(err)
    return err
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const err = await perform(() => onAdd(newName.trim()))
    if (!err) setNewName('')
  }

  async function handleRename(e: FormEvent) {
    e.preventDefault()
    if (!editingId) return
    const err = await perform(() => onRename(editingId, editName.trim()))
    if (!err) setEditingId(null)
  }


  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Kategorien</h2>

      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Neue Kategorie"
          aria-label="Name der neuen Kategorie"
          maxLength={60}
        />
        <Button type="submit" disabled={busy || newName.trim() === ''}>
          <Plus /> Hinzufügen
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {categories.length === 0 && (
        <p className="text-sm text-muted-foreground">Noch keine Kategorien.</p>
      )}

      <ul className="divide-y rounded-lg border bg-card">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
            {editingId === c.id ? (
              <form onSubmit={handleRename} className="flex flex-1 items-center gap-2">
                <Input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  aria-label="Neuer Name der Kategorie"
                  maxLength={60}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={busy || editName.trim() === ''}
                  aria-label="Speichern"
                >
                  <Check />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingId(null)}
                  aria-label="Abbrechen"
                >
                  <X />
                </Button>
              </form>
            ) : (
              <>
                <span className="text-sm">{c.name}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(c.id)
                      setEditName(c.name)
                    }}
                    aria-label={`${c.name} umbenennen`}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    onClick={() => setPendingDelete(c)}
                    aria-label={`${c.name} löschen`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        destructive
        confirmLabel="Löschen"
        request={
          pendingDelete && {
            title: 'Kategorie löschen?',
            description: `Kategorie „${pendingDelete.name}“ löschen? Bestehende Tickets behalten ihren Inhalt, verlieren aber die Kategorie.`,
          }
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) perform(() => onDelete(pendingDelete.id))
          setPendingDelete(null)
        }}
      />
    </section>
  )
}
