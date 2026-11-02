import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type Props = {
  /** Was gerade bestätigt werden soll; null = Dialog ist zu */
  request: { title: string; description: string } | null
  confirmLabel?: string
  /** Rot dargestellt, für Löschen/Entfernen */
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * "Bist du sicher?"-Dialog. Schützt vor versehentlichen Klicks: Die Änderung wird erst
 * ausgeführt, wenn man ausdrücklich bestätigt. Abbrechen, Escape oder ein Klick daneben
 * verwerfen sie.
 */
export function ConfirmDialog({
  request,
  confirmLabel = 'Ändern',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <AlertDialog open={request !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription>{request?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
