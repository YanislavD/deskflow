import type { Database } from '@/types/database'

export type TicketStatus = Database['public']['Enums']['ticket_status']
export type TicketPriority = Database['public']['Enums']['ticket_priority']

// Die Datenbank speichert technische Werte (z. B. "in_bearbeitung"),
// der Nutzer sieht die deutschen Beschriftungen.
export const statusLabels: Record<TicketStatus, string> = {
  neu: 'Neu',
  in_bearbeitung: 'In Bearbeitung',
  wartet: 'Wartet',
  geloest: 'Gelöst',
  geschlossen: 'Geschlossen',
}

export const priorityLabels: Record<TicketPriority, string> = {
  niedrig: 'Niedrig',
  mittel: 'Mittel',
  hoch: 'Hoch',
  kritisch: 'Kritisch',
}

// Farben aus der Theme-Palette (chart-1 … chart-5 in index.css)
export const statusStyles: Record<TicketStatus, string> = {
  neu: 'bg-chart-1/15 text-chart-1',
  in_bearbeitung: 'bg-chart-2/15 text-chart-2',
  wartet: 'bg-chart-4/15 text-chart-4',
  geloest: 'bg-chart-3/15 text-chart-3',
  geschlossen: 'bg-muted text-muted-foreground',
}

export const priorityStyles: Record<TicketPriority, string> = {
  niedrig: 'bg-muted text-muted-foreground',
  mittel: 'bg-chart-2/15 text-chart-2',
  hoch: 'bg-chart-4/15 text-chart-4',
  kritisch: 'bg-chart-5/15 text-chart-5',
}
