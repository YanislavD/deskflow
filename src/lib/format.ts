const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' })
const dateTimeFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' })

/** ISO-Zeitstempel -> Wert für <input type="date"> ("2026-11-05", in lokaler Zeit). */
export function toDateInputValue(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Wert aus <input type="date"> -> Zeitstempel. Wir nehmen das Ende des Tages (23:59),
 * damit ein Ticket erst NACH dem Fälligkeitstag als überfällig gilt.
 */
export function fromDateInputValue(value: string) {
  return value ? new Date(`${value}T23:59:00`).toISOString() : null
}

export const formatDate =(iso: string) => dateFormat.format(new Date(iso))
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso))
