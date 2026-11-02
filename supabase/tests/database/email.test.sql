-- DeskFlow – Tests für E-Mail-Benachrichtigungen (pgTAP)
-- Ausführen: npx supabase test db
-- Eigene Testdaten, am Ende wird alles zurückgerollt.

begin;

create extension if not exists pgtap with schema extensions;

select * from no_plan();

-- Testdaten ----------------------------------------------------------------------
--  Firma M: agentM (agent), reqM (requester)

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
       name || '@mail.example', jsonb_build_object('full_name', name)
from (values
  ('d1000000-0000-4000-8000-0000000000a1'::uuid, 'agentM'),
  ('d1000000-0000-4000-8000-0000000000a2'::uuid, 'reqM')
) as t (id, name);

insert into public.organizations (id, name, slug)
values ('d2000000-0000-4000-8000-00000000000a', 'Mail M', 'mail-m');

insert into public.memberships (organization_id, user_id, role) values
  ('d2000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-0000000000a1', 'agent'),
  ('d2000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-0000000000a2', 'requester');

insert into public.tickets (id, organization_id, title, requester_id, assignee_id) values
  ('d3000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-00000000000a', 'Drucker kaputt',
   'd1000000-0000-4000-8000-0000000000a2', 'd1000000-0000-4000-8000-0000000000a1');

-- Der Test soll nicht von lokalen Einstellungen (Seed) abhängen: erst leeren, dann setzen.
-- (Alles wird am Ende zurückgerollt; auch die Anfragen von pg_net gehen erst beim Commit raus.)
delete from private.app_settings;
insert into private.app_settings values ('app_url', 'https://app.example');

-- Standard: E-Mails sind eingeschaltet
select is((select email_notifications from public.profiles where id = 'd1000000-0000-4000-8000-0000000000a2'),
          true, 'E-Mail-Benachrichtigungen sind standardmäßig eingeschaltet');

-- Agent antwortet öffentlich -> reqM bekommt eine E-Mail in der Warteschlange ---------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
insert into public.ticket_comments (ticket_id, organization_id, body)
values ('d3000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-00000000000a', 'GEHEIMER KOMMENTARTEXT');

reset role;
select is((select count(*)::int from public.email_outbox), 1, 'ein öffentlicher Kommentar erzeugt genau eine E-Mail');
select is((select to_email from public.email_outbox), 'reqM@mail.example', 'sie geht an den Anfragenden');
select is((select subject from public.email_outbox), 'Neuer Kommentar zu Ticket #1', 'Betreff mit Ticketnummer');
select ok((select body from public.email_outbox) like '%Drucker kaputt%', 'Text nennt den Ticket-Titel');
select ok((select body from public.email_outbox) like '%agentM hat das Ticket kommentiert.%', 'und wer kommentiert hat');
select ok((select body from public.email_outbox) like '%https://app.example/tickets/d3000000-0000-4000-8000-000000000001%',
  'und enthält einen Link zum Ticket');
select ok((select body from public.email_outbox) not like '%GEHEIMER KOMMENTARTEXT%',
  'der Text des Kommentars steht NICHT in der E-Mail (Datenschutz)');
select is((select sent_at from public.email_outbox), null, 'sie ist noch nicht verschickt');

-- Ausgeschaltet -> keine E-Mail --------------------------------------------------------------------------

update public.profiles set email_notifications = false where id = 'd1000000-0000-4000-8000-0000000000a2';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
insert into public.ticket_comments (ticket_id, organization_id, body)
values ('d3000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-00000000000a', 'noch ein Kommentar');

reset role;
select is((select count(*)::int from public.email_outbox), 1,
  'wer E-Mails ausgeschaltet hat, bekommt keine (weiterhin nur 1 in der Warteschlange)');
select is((select count(*)::int from public.notifications where user_id = 'd1000000-0000-4000-8000-0000000000a2'), 2,
  'die Benachrichtigung in der App entsteht trotzdem');

-- Zuweisung -> E-Mail an den neuen Zuständigen (ein dritter Nutzer, E-Mails an) --------------------------

update public.profiles set email_notifications = true where id = 'd1000000-0000-4000-8000-0000000000a2';
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', 'd1000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated',
        'agent2M@mail.example', '{"full_name":"agent2M"}');
insert into public.memberships (organization_id, user_id, role)
values ('d2000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-0000000000a3', 'agent');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
update public.tickets set assignee_id = 'd1000000-0000-4000-8000-0000000000a3' where id = 'd3000000-0000-4000-8000-000000000001';

reset role;
select is((select subject from public.email_outbox where to_email = 'agent2M@mail.example'),
          'Dir wurde Ticket #1 zugewiesen', 'Zuweisung -> E-Mail an den neuen Zuständigen');

-- Die Warteschlange ist für Clients gesperrt -----------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$ select * from public.email_outbox $$, '42501', null, 'Clients dürfen die Warteschlange nicht lesen');
select throws_ok($$ insert into public.email_outbox (to_email, subject, body) values ('x@y.example', 'Spam', 'Spam') $$,
  '42501', null, 'und keine E-Mails einreihen');
select throws_ok($$ select * from private.app_settings $$, '42501', null, 'die Einstellungen sind für Clients gesperrt');

-- Das Aufwecken der Funktion --------------------------------------------------------------------------------------------

reset role;
-- ohne Einstellungen: kein Fehler (siehe oben, die Trigger liefen schon)
-- mit Einstellungen: pg_net reiht die Anfrage ein, die Transaktion läuft ohne Fehler durch
insert into private.app_settings values
  ('email_sender_url', 'http://localhost:1/nicht-erreichbar'), ('email_sender_secret', 'geheim');
select lives_ok($$ insert into public.email_outbox (to_email, subject, body) values ('t@mail.example', 'Test', 'Test') $$,
  'mit konfigurierter Funktion wird sie geweckt, ohne dass das Einreihen scheitert');

-- Abholen der E-Mails (Edge Function) ----------------------------------------------------------------------------------------

reset role;
select is((select count(*)::int from public.claim_outbox_emails(10)), 3,
  'claim holt alle 3 offenen E-Mails ab (Kommentar, Zuweisung, Test)');
select is((select count(*)::int from public.claim_outbox_emails(10)), 0,
  'ein zweiter Aufruf direkt danach bekommt NICHTS (kein doppeltes Versenden)');
select is((select min(attempts) from public.email_outbox), 1, 'jede Abholung zählt als Versuch');

-- nach 5 Minuten ohne Erfolg wird erneut versucht
update public.email_outbox set claimed_at = now() - interval '6 minutes';
select is((select count(*)::int from public.claim_outbox_emails(10)), 3, 'nach 5 Minuten werden unversendete E-Mails erneut abgeholt');

-- verschickte werden nicht mehr abgeholt, ebenso nach 5 Fehlversuchen
update public.email_outbox set claimed_at = now() - interval '6 minutes';
update public.email_outbox set sent_at = now() where to_email = 'reqM@mail.example';
update public.email_outbox set attempts = 5 where to_email = 'agent2M@mail.example';
select is((select count(*)::int from public.claim_outbox_emails(10)), 1, 'verschickte und endgültig fehlgeschlagene E-Mails bleiben liegen');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
select throws_ok($$ select * from public.claim_outbox_emails(10) $$, '42501', null, 'Clients dürfen nichts abholen');
reset role;

select * from finish();

rollback;
