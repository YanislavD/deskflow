-- DeskFlow – Demo-Daten (nur für die LOKALE Entwicklung: `supabase db reset`)
--
-- Demo-Firma „Müller & Partner GmbH“ mit 4 Nutzern. Alle haben dasselbe Test-Passwort:
--   Demo1234!
-- Die Nutzer werden direkt in auth.users angelegt; der Trigger on_auth_user_created
-- erzeugt dazu automatisch die Zeilen in profiles.
-- ACHTUNG: Nie gegen ein echtes/produktives Projekt ausführen.

-- Feste UUIDs, damit sich die Daten untereinander referenzieren lassen -------

-- Firma:      a0000000-0000-4000-8000-000000000001
-- Anna Müller (admin):      b0000000-0000-4000-8000-000000000001
-- Jonas Weber (agent):      b0000000-0000-4000-8000-000000000002
-- Lena Fischer (requester): b0000000-0000-4000-8000-000000000003
-- Tim Schäfer (requester):  b0000000-0000-4000-8000-000000000004

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
  u.email, extensions.crypt('Demo1234!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object('full_name', u.full_name),
  now(), now(), '', '', '', ''
from (values
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'anna.mueller@mueller-partner.example', 'Anna Müller'),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'jonas.weber@mueller-partner.example',  'Jonas Weber'),
  ('b0000000-0000-4000-8000-000000000003'::uuid, 'lena.fischer@mueller-partner.example', 'Lena Fischer'),
  ('b0000000-0000-4000-8000-000000000004'::uuid, 'tim.schaefer@mueller-partner.example', 'Tim Schäfer')
) as u (id, email, full_name);

-- Ohne Eintrag in auth.identities funktioniert der E-Mail-Login nicht
insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.id in (
  'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000004'
);

-- Organisation + Memberships ----------------------------------------------------

insert into public.organizations (id, name, slug)
values ('a0000000-0000-4000-8000-000000000001', 'Müller & Partner GmbH', 'mueller-partner');

insert into public.memberships (organization_id, user_id, role) values
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'admin'),
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'agent'),
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'requester'),
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'requester');

-- Kategorien ---------------------------------------------------------------------

insert into public.categories (id, organization_id, name) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Hardware'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Software'),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Netzwerk & VPN'),
  ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Zugänge & Konten'),
  ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'Sonstiges');

-- Tickets ------------------------------------------------------------------------
-- Alle starten als „neu“ ohne Assignee (so legt ein Requester sie an). `number` wird
-- vom Trigger vergeben (1, 2, 3, …). Die Updates weiter unten lösen den Verlauf
-- (ticket_events) aus.

insert into public.tickets
  (id, organization_id, title, description, priority, category_id, requester_id, due_at, created_at)
values
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Drucker im 2. OG druckt nicht',
   'Seit heute Morgen kommt nur noch die Meldung „Papierstau“, obwohl kein Papier klemmt.',
   'mittel', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003',
   null, now() - interval '6 days'),
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'VPN-Verbindung bricht ständig ab',
   'Im Homeoffice reißt die VPN-Verbindung etwa alle 10 Minuten ab. Teams-Calls sind kaum möglich.',
   'hoch', 'c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000004',
   now() + interval '2 days', now() - interval '5 days'),
  ('d0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'Neuer Mitarbeiter: Konto und Laptop einrichten',
   'Am 1. des nächsten Monats startet ein neuer Kollege im Vertrieb. Bitte Konto, Laptop und Zugänge vorbereiten.',
   'mittel', 'c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000003',
   now() + interval '9 days', now() - interval '4 days'),
  ('d0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'Outlook startet nicht mehr',
   'Nach dem Windows-Update öffnet sich Outlook nicht mehr. Ich komme nicht an meine Termine und Mails.',
   'kritisch', 'c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000004',
   now() + interval '1 day', now() - interval '3 days'),
  ('d0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001',
   'WLAN im Besprechungsraum sehr langsam',
   'Bei Präsentationen mit mehreren Personen ist das WLAN im großen Besprechungsraum kaum nutzbar.',
   'niedrig', 'c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003',
   null, now() - interval '3 days'),
  ('d0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001',
   'Passwort zurücksetzen (Buchhaltungssoftware)',
   'Ich habe mein Passwort für die Buchhaltungssoftware vergessen und bin gesperrt.',
   'mittel', 'c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000004',
   null, now() - interval '2 days'),
  ('d0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001',
   'Monitor flackert',
   'Der Zweitmonitor an meinem Platz flackert in unregelmäßigen Abständen.',
   'niedrig', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003',
   null, now() - interval '2 days'),
  ('d0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001',
   'Lizenz für PDF-Editor beantragen',
   'Für Verträge brauche ich eine Lizenz für einen PDF-Editor mit Signaturfunktion.',
   'mittel', 'c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003',
   null, now() - interval '1 day');

-- Bearbeitung durch den Agent (Updates -> erzeugen Einträge in ticket_events)
update public.tickets
   set status = 'in_bearbeitung', assignee_id = 'b0000000-0000-4000-8000-000000000002'
 where id in ('d0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000004');

update public.tickets
   set status = 'wartet', assignee_id = 'b0000000-0000-4000-8000-000000000002'
 where id = 'd0000000-0000-4000-8000-000000000003';

update public.tickets
   set status = 'in_bearbeitung', priority = 'hoch'
 where id = 'd0000000-0000-4000-8000-000000000001';

update public.tickets
   set status = 'geloest', assignee_id = 'b0000000-0000-4000-8000-000000000002'
 where id = 'd0000000-0000-4000-8000-000000000006';

update public.tickets
   set status = 'geschlossen', assignee_id = 'b0000000-0000-4000-8000-000000000002'
 where id = 'd0000000-0000-4000-8000-000000000007';

-- Kommentare (teils intern) ------------------------------------------------------

insert into public.ticket_comments (ticket_id, organization_id, author_id, body, is_internal, created_at) values
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000002',
   'Danke für die Meldung! Ich schaue mir die VPN-Logs an. Hilft es, vorübergehend das WLAN gegen LAN zu tauschen?',
   false, now() - interval '4 days'),
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000004',
   'Mit LAN ist es besser, aber nicht ganz weg.',
   false, now() - interval '4 days' + interval '2 hours'),
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000002',
   'Intern: Auffällig viele Reconnects auf Gateway 2 – vermutlich MTU-Problem. Mit Anna über Firmware-Update sprechen.',
   true, now() - interval '3 days'),
  ('d0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000002',
   'Intern: Office-Reparatur über die Systemsteuerung probieren, sonst Profil neu anlegen.',
   true, now() - interval '2 days'),
  ('d0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000002',
   'Ich komme heute Nachmittag an deinen Platz und repariere die Office-Installation.',
   false, now() - interval '2 days' + interval '1 hour'),
  ('d0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000002',
   'Passwort wurde zurückgesetzt, das temporäre Passwort habe ich dir per Telefon durchgegeben.',
   false, now() - interval '1 day');
