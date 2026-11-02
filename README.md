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

Die Startseite zeigt eine **Übersicht** (offene, überfällige und zugewiesene Tickets, Verteilung nach Status und
Priorität). Übersicht, Ticketliste und Ticketdetails aktualisieren sich per **Realtime** automatisch, wenn jemand
anderes etwas ändert – ohne die Seite neu zu laden. Welche Änderungen man bekommt, bestimmt weiterhin die RLS.

**Einladungen:** Ein Admin erstellt unter „Verwaltung“ einen Einladungslink (7 Tage gültig, nur für die genannte
E-Mail-Adresse). Die Person registriert sich oder meldet sich an und nimmt die Einladung an. In der Datenbank steht
nur der Hash des Tokens, der Link wird deshalb nur einmal angezeigt.

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

E-Mails (z. B. „Passwort vergessen“) landen lokal nicht im Postfach, sondern in **Mailpit**: http://127.0.0.1:54324

Die Demo-Daten (`supabase/seed.sql`) enthalten die Firma „Müller & Partner GmbH“ mit einem Admin,
einem Agent und zwei Requestern sowie 8 Tickets. Die Logins und das Test-Passwort stehen oben in der Seed-Datei.
**Der Seed ist nur für die lokale Entwicklung gedacht** – nicht gegen ein echtes Projekt ausführen.

## Continuous Integration

`.github/workflows/ci.yml` läuft bei jedem Push und Pull Request auf GitHub:

- **Lint und Build** des Frontends
- **Datenbank-Tests (pgTAP)** gegen eine lokale Supabase im Container (`supabase test db`)

## E-Mail-Benachrichtigungen

Zusätzlich zur Glocke in der App können Nutzer E-Mails bekommen (Profil → „Per E-Mail benachrichtigen“, standardmäßig an).
Die E-Mail enthält Ticketnummer, Titel, wer etwas getan hat und einen Link – **nicht** den Text von Kommentaren.

So läuft es:

1. Ein Datenbank-Trigger legt für jede Benachrichtigung eine E-Mail in der Warteschlange `email_outbox` ab.
2. Ein zweiter Trigger weckt per `pg_net` die Edge Function `send-emails`.
3. Die Funktion holt die offenen E-Mails ab (`claim_outbox_emails`, damit nichts doppelt verschickt wird), sendet sie per
   SMTP und markiert sie. Schlägt etwas fehl, bleibt die E-Mail in der Warteschlange (bis zu 5 Versuche).

**Lokal** (Mailpit fängt die E-Mails ab, Ansicht auf http://127.0.0.1:54324):

```bash
cp supabase/functions/.env.example supabase/functions/.env
npx supabase stop && npx supabase start     # liest die .env der Funktion ein
```

`supabase/seed.sql` trägt die Adresse der Funktion in `private.app_settings` ein (`npx supabase db reset`).
Änderungen an `supabase/functions/.env` werden erst nach einem Neustart von Supabase wirksam.

**In der Cloud** (später): Funktion mit `npx supabase functions deploy send-emails` veröffentlichen, SMTP-Zugangsdaten
mit `npx supabase secrets set --env-file supabase/functions/.env` hinterlegen (mit echtem SMTP-Anbieter, `SMTP_TLS`
und `SMTP_USER`/`SMTP_PASS`), und die drei Einträge in `private.app_settings` per SQL setzen
(`app_url`, `email_sender_url`, `email_sender_secret`).

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
