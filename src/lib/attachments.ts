// Dieselben Grenzen gelten serverseitig (Bucket "ticket-attachments", siehe Migration).
// Hier prüfen wir sie vorab, damit der Nutzer sofort eine verständliche Meldung bekommt.

export const MAX_BYTES = 5 * 1024 * 1024

/**
 * Erlaubte Dateitypen und die Dateiendung, die wir im Speicherpfad verwenden.
 * Die Endung kommt aus dem TYP, nie aus dem Dateinamen des Nutzers – so lässt sich über
 * den Namen nichts in den Pfad schmuggeln. Bewusst KEIN SVG/HTML (können Skripte enthalten).
 */
export const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
}

/** Für <input type="file" accept="..."> */
export const ACCEPT = Object.keys(ALLOWED_TYPES).join(',')

/** null = in Ordnung, sonst die Fehlermeldung für den Nutzer */
export function validateFile(file: File): string | null {
  if (file.size === 0) return 'Die Datei ist leer.'
  if (file.size > MAX_BYTES) return 'Die Datei ist zu groß (höchstens 5 MB).'
  if (!(file.type in ALLOWED_TYPES)) {
    return 'Dieser Dateityp ist nicht erlaubt. Erlaubt sind Bilder (PNG, JPG, GIF, WebP), PDF und Text.'
  }
  return null
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
