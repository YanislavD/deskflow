# DeskFlow

DeskFlow ist ein mandantenfähiges (multi-tenant) IT-Helpdesk- und Ticketsystem für Firmen.
Jede Firma (Organisation) hat ihre eigenen Nutzer, Kategorien und Tickets – und sieht nie die Daten einer anderen Firma.

> **Status:** Schritt 1 – Projekt-Setup und Datenbank. Die Oberfläche (Screens) folgt in den nächsten Schritten.

## Rollen

| Rolle       | Darf                                                                                  |
| ----------- | ------------------------------------------------------------------------------------- |
| `requester` | eigene Tickets anlegen und ansehen, öffentlich kommentieren                           |
| `agent`     | alle Tickets der Firma ansehen und bearbeiten, interne Notizen schreiben              |
| `admin`     | wie `agent` + Kategorien und Mitglieder verwalten, Tickets löschen, Firma umbenennen  |

Eine Person kann Mitglied in mehreren Firmen sein (mit je eigener Rolle). Die aktive Firma wählt man oben im
Kopfbereich; Tickets, „Neues Ticket“ und „Verwaltung“ arbeiten immer nur mit der gewählten Firma.

## Tech-Stack

- [React](https://react.dev) + [Vite](https://vite.dev) + TypeScript
- [Tailwind CSS](https://tailwindcss.com) v4 + [shadcn/ui](https://ui.shadcn.com) + [lucide-react](https://lucide.dev)
- [Supabase](https://supabase.com) (Postgres, Auth, Row Level Security)
- Schriften: Inter (Text) und JetBrains Mono (Ticketnummern)

## Datenmodell

`organizations` · `profiles` · `memberships` · `categories` · `tickets` · `ticket_comments` · `ticket_events`
(+ `ticket_counters` für die fortlaufende Ticketnummer pro Firma)

Wichtige Regeln, die direkt in der Datenbank erzwungen werden:

- **Row Level Security** auf allen Tabellen (siehe `supabase/migrations/*_rls.sql`).
- Die **Ticketnummer** (1, 2, 3 …) zählt pro Firma getrennt und kann nicht von Hand gesetzt oder geändert werden.
- Änderungen an **Status, Priorität und Zuständigem** werden automatisch in `ticket_events` protokolliert.
- Requester, Zuständige und Kategorien eines Tickets müssen zur **selben Firma** gehören (zusammengesetzte Fremdschlüssel).

## Voraussetzungen

- [Node.js](https://nodejs.org) 20 oder neuer
- Ein [Supabase](https://supabase.com)-Projekt (kostenlos) – oder [Docker Desktop](https://www.docker.com/products/docker-desktop/) für eine lokale Supabase

## Starten

```bash
npm install
cp .env.example .env     # dann URL und Anon-Key aus dem Supabase-Dashboard eintragen
npm run dev
```

Die Werte findest du im Supabase-Dashboard unter **Project Settings → API**.
Im Frontend wird nur der öffentliche `anon`/`publishable` Key verwendet – **nie** den `service_role` Key.

## Datenbank

### In dein Supabase-Projekt übertragen

```bash
npx supabase login
npx supabase link --project-ref <DEINE_PROJECT_REF>
npx supabase db push
```

Die Project-Ref steht in der Dashboard-URL (`https://supabase.com/dashboard/project/<project-ref>`).

### Lokal entwickeln (braucht Docker Desktop)

```bash
npx supabase start       # startet Postgres, Auth usw. lokal
npx supabase db reset    # spielt Migrationen und supabase/seed.sql ein
npx supabase test db     # führt die RLS-Tests aus
```

Die Demo-Daten (`supabase/seed.sql`) enthalten die Firma „Müller & Partner GmbH“ mit einem Admin,
einem Agent und zwei Requestern sowie 8 Tickets. Die Logins und das Test-Passwort stehen oben in der Seed-Datei.
**Der Seed ist nur für die lokale Entwicklung gedacht** – nicht gegen ein echtes Projekt ausführen.

## Skripte

| Befehl            | Beschreibung                  |
| ----------------- | ----------------------------- |
| `npm run dev`     | Entwicklungsserver starten    |
| `npm run build`   | Typprüfung und Produktions-Build |
| `npm run lint`    | Code mit oxlint prüfen        |
| `npm run preview` | Produktions-Build ansehen     |

## Projektstruktur

```
src/
  components/ui/   shadcn/ui-Komponenten
  lib/supabase.ts  Supabase-Client
supabase/
  migrations/      Tabellen, Trigger, RLS
  seed.sql         Demo-Daten (lokal)
  tests/database/  RLS- und Trigger-Tests (pgTAP)
```
