-- DeskFlow – RLS- und Trigger-Tests (pgTAP)
-- Ausführen:  npx supabase test db     (braucht die lokale Supabase, also `npx supabase start`)
--
-- Der Test legt seine eigenen Daten an und rollt am Ende alles zurück (kein Seed nötig).
-- Mit `set local role authenticated` + JWT-Claims verhalten wir uns wie ein eingeloggter
-- Nutzer: genau so sieht Postgres die Anfragen, die vom Frontend kommen.

begin;

create extension if not exists pgtap with schema extensions;

select * from no_plan();

-- Hilfsfunktion: führt ein UPDATE/DELETE aus und liefert die Zahl der betroffenen Zeilen.
-- (RLS verbietet fremde Zeilen nicht mit einem Fehler, sondern "sieht" sie einfach nicht -> 0 Zeilen.)
create function public.test_affected(q text) returns int
language plpgsql as $$
declare n int;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Testdaten (als postgres, RLS wird umgangen) ---------------------------------
--  Firma A: adminA, agentA, req1, req2      Firma B: adminB      ohne Firma: newbie

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
       name || '@test.example', jsonb_build_object('full_name', name)
from (values
  ('00000000-0000-4000-8000-0000000000a1'::uuid, 'adminA'),
  ('00000000-0000-4000-8000-0000000000a2'::uuid, 'agentA'),
  ('00000000-0000-4000-8000-0000000000a3'::uuid, 'req1'),
  ('00000000-0000-4000-8000-0000000000a4'::uuid, 'req2'),
  ('00000000-0000-4000-8000-0000000000b1'::uuid, 'adminB'),
  ('00000000-0000-4000-8000-0000000000c1'::uuid, 'newbie')
) as t (id, name);

insert into public.organizations (id, name, slug) values
  ('a0000000-0000-4000-8000-00000000000a', 'Firma A', 'firma-a'),
  ('a0000000-0000-4000-8000-00000000000b', 'Firma B', 'firma-b');

insert into public.memberships (organization_id, user_id, role) values
  ('a0000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a1', 'admin'),
  ('a0000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a2', 'agent'),
  ('a0000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a3', 'requester'),
  ('a0000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a4', 'requester'),
  ('a0000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000b1', 'admin');

insert into public.tickets (id, organization_id, title, requester_id) values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'A1 von req1', '00000000-0000-4000-8000-0000000000a3'),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000000a', 'A2 von req1', '00000000-0000-4000-8000-0000000000a3'),
  ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-00000000000a', 'A3 von req2', '00000000-0000-4000-8000-0000000000a4'),
  ('e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-00000000000b', 'B1 von adminB', '00000000-0000-4000-8000-0000000000b1');

insert into public.ticket_comments (ticket_id, organization_id, author_id, body, is_internal) values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a2', 'öffentlich', false),
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000a2', 'intern', true);

-- Trigger (als postgres geprüft) ---------------------------------------------

select is((select count(*)::int from public.profiles
           where id in (select id from auth.users where email like '%@test.example')),
          6, 'Trigger: für jeden neuen auth-User entsteht ein Profil');

select is((select array_agg(number order by number) from public.tickets
           where organization_id = 'a0000000-0000-4000-8000-00000000000a'),
          array[1, 2, 3], 'Ticketnummern in Firma A: 1, 2, 3');

select is((select number from public.tickets where id = 'e0000000-0000-4000-8000-000000000004'),
          1, 'Ticketnummern zählen pro Firma: erstes Ticket in Firma B hat die Nummer 1');

-- anon ------------------------------------------------------------------------

set local role anon;
select throws_ok($$ select * from public.tickets $$, '42501', null,
  'anon: kein Zugriff auf tickets');

-- Requester (req1) ------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);

select is((select count(*)::int from public.tickets), 2, 'req1 sieht nur seine 2 eigenen Tickets');
select is((select count(*)::int from public.tickets where requester_id = '00000000-0000-4000-8000-0000000000a4'),
          0, 'req1 sieht keine Tickets von req2');
select is((select count(*)::int from public.organizations), 1, 'req1 sieht nur die eigene Firma');
select is((select count(*)::int from public.ticket_comments where ticket_id = 'e0000000-0000-4000-8000-000000000001'),
          1, 'req1 sieht nur den öffentlichen Kommentar, nicht den internen');
select is((select count(*)::int from public.profiles where id = '00000000-0000-4000-8000-0000000000a4'),
          0, 'req1 sieht das Profil von req2 (anderer Requester) nicht');
select is((select count(*)::int from public.profiles where id = '00000000-0000-4000-8000-0000000000a2'),
          1, 'req1 sieht das Profil des Agents');
select is((select count(*)::int from public.memberships), 1, 'req1 sieht nur die eigene Membership');

select throws_ok($$ select * from public.ticket_counters $$, '42501', null,
  'req1: ticket_counters ist für Clients gesperrt');
select throws_ok($$ insert into public.categories (organization_id, name)
                    values ('a0000000-0000-4000-8000-00000000000a', 'Hack') $$,
  '42501', null, 'req1 darf keine Kategorie anlegen');
select is(public.test_affected($$ update public.memberships set role = 'admin' where user_id = '00000000-0000-4000-8000-0000000000a3' $$),
          0, 'req1 darf sich nicht selbst zum Admin machen (0 Zeilen geändert)');
select is(public.test_affected($$ update public.tickets set title = 'gehackt' $$),
          0, 'req1 darf keine Tickets bearbeiten');
select throws_ok($$ insert into public.tickets (organization_id, title, requester_id)
                    values ('a0000000-0000-4000-8000-00000000000a', 'Fremdes Ticket',
                            '00000000-0000-4000-8000-0000000000a4') $$,
  '42501', null, 'req1 darf kein Ticket im Namen von req2 anlegen');
select throws_ok($$ insert into public.tickets (organization_id, title, status)
                    values ('a0000000-0000-4000-8000-00000000000a', 'Direkt gelöst', 'geloest') $$,
  '42501', null, 'req1 darf ein Ticket nicht direkt mit anderem Status anlegen');
select throws_ok($$ insert into public.tickets (organization_id, title)
                    values ('a0000000-0000-4000-8000-00000000000b', 'In fremder Firma') $$,
  '42501', null, 'req1 darf kein Ticket in Firma B anlegen');
select lives_ok($$ insert into public.tickets (organization_id, title)
                   values ('a0000000-0000-4000-8000-00000000000a', 'Mein neues Ticket') $$,
  'req1 darf ein eigenes Ticket anlegen');
select is((select number from public.tickets where title = 'Mein neues Ticket'),
          4, 'das neue Ticket bekommt automatisch die Nummer 4');
select throws_ok($$ insert into public.ticket_comments (ticket_id, organization_id, body, is_internal)
                    values ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'x', true) $$,
  '42501', null, 'req1 darf keinen internen Kommentar schreiben');
select throws_ok($$ insert into public.ticket_comments (ticket_id, organization_id, body)
                    values ('e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-00000000000a', 'x') $$,
  '42501', null, 'req1 darf nicht auf ein fremdes Ticket kommentieren');
select lives_ok($$ insert into public.ticket_comments (ticket_id, organization_id, body)
                   values ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'Danke!') $$,
  'req1 darf öffentlich auf das eigene Ticket kommentieren');

-- Agent (agentA) --------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);

select is((select count(*)::int from public.tickets), 4, 'agentA sieht alle 4 Tickets von Firma A');
select is((select count(*)::int from public.tickets where organization_id = 'a0000000-0000-4000-8000-00000000000b'),
          0, 'agentA sieht nichts aus Firma B');
select is((select count(*)::int from public.ticket_comments where ticket_id = 'e0000000-0000-4000-8000-000000000001'),
          3, 'agentA sieht auch den internen Kommentar');
select is((select count(*)::int from public.profiles where id = '00000000-0000-4000-8000-0000000000a4'),
          1, 'agentA sieht Requester-Profile der eigenen Firma');
select is((select count(*)::int from public.profiles where id = '00000000-0000-4000-8000-0000000000b1'),
          0, 'agentA sieht keine Profile aus Firma B');

select lives_ok($$ update public.tickets
                   set status = 'in_bearbeitung', priority = 'hoch',
                       assignee_id = '00000000-0000-4000-8000-0000000000a2'
                   where id = 'e0000000-0000-4000-8000-000000000001' $$,
  'agentA darf Status, Priorität und Assignee ändern');
select is((select count(*)::int from public.ticket_events
           where ticket_id = 'e0000000-0000-4000-8000-000000000001'),
          3, 'Trigger: 3 Änderungen -> 3 Einträge im Verlauf');
select is((select actor_id from public.ticket_events
           where ticket_id = 'e0000000-0000-4000-8000-000000000001' and type = 'status'),
          '00000000-0000-4000-8000-0000000000a2'::uuid, 'Trigger: actor_id ist der Agent');
select is((select old_value || ' -> ' || new_value from public.ticket_events
           where ticket_id = 'e0000000-0000-4000-8000-000000000001' and type = 'status'),
          'neu -> in_bearbeitung', 'Trigger: alter und neuer Status werden gespeichert');
select lives_ok($$ update public.tickets set title = 'A1 umbenannt'
                   where id = 'e0000000-0000-4000-8000-000000000001' $$,
  'Titel ändern ist erlaubt');
select is((select count(*)::int from public.ticket_events
           where ticket_id = 'e0000000-0000-4000-8000-000000000001'),
          3, 'Trigger: Titeländerung erzeugt keinen Verlaufseintrag');
select throws_ok($$ update public.tickets set number = 99
                    where id = 'e0000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'Ticketnummer ist unveränderlich');
select throws_ok($$ update public.tickets set assignee_id = '00000000-0000-4000-8000-0000000000b1'
                    where id = 'e0000000-0000-4000-8000-000000000002' $$,
  '23503', null, 'Ticket kann keinem Nutzer aus einer fremden Firma zugewiesen werden');
select throws_ok($$ insert into public.categories (organization_id, name)
                    values ('a0000000-0000-4000-8000-00000000000a', 'Agent-Kategorie') $$,
  '42501', null, 'agentA darf keine Kategorie anlegen');
select throws_ok($$ insert into public.memberships (organization_id, user_id, role)
                    values ('a0000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000c1', 'agent') $$,
  '42501', null, 'agentA darf keine Memberships anlegen');
select is(public.test_affected($$ delete from public.tickets where id = 'e0000000-0000-4000-8000-000000000003' $$),
          0, 'agentA darf keine Tickets löschen');
select lives_ok($$ insert into public.ticket_comments (ticket_id, organization_id, body, is_internal)
                   values ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'Notiz', true) $$,
  'agentA darf interne Kommentare schreiben');
select throws_ok($$ insert into public.ticket_events (ticket_id, organization_id, type, new_value)
                    values ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', 'status', 'x') $$,
  '42501', null, 'Verlauf kann nicht von Hand geschrieben werden');

-- Requester nochmal: Verlauf ----------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);

select is((select array_agg(type order by type) from public.ticket_events
           where ticket_id = 'e0000000-0000-4000-8000-000000000001'),
          array['status'], 'req1 sieht im Verlauf nur die Status-Änderung, nicht Priorität/Zuweisung');

-- Admin (adminA) --------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

select lives_ok($$ insert into public.categories (organization_id, name)
                   values ('a0000000-0000-4000-8000-00000000000a', 'Admin-Kategorie') $$,
  'adminA darf Kategorien anlegen');
select lives_ok($$ insert into public.memberships (organization_id, user_id, role)
                   values ('a0000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000c1', 'agent') $$,
  'adminA darf Memberships anlegen');
select throws_ok($$ insert into public.memberships (organization_id, user_id, role)
                    values ('a0000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000c1', 'agent') $$,
  '42501', null, 'adminA darf keine Memberships in Firma B anlegen');
select is(public.test_affected($$ delete from public.tickets where id = 'e0000000-0000-4000-8000-000000000003' $$),
          1, 'adminA darf Tickets löschen');

-- Admin der anderen Firma (adminB) -----------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);

select is((select count(*)::int from public.tickets), 1, 'adminB sieht nur das eigene Ticket');
select is((select count(*)::int from public.ticket_events), 0, 'adminB sieht keinen Verlauf aus Firma A');
select is((select count(*)::int from public.ticket_comments), 0, 'adminB sieht keine Kommentare aus Firma A');
select is(public.test_affected($$ update public.tickets set title = 'gehackt' where organization_id = 'a0000000-0000-4000-8000-00000000000a' $$),
          0, 'adminB kann Tickets aus Firma A nicht ändern');
select is(public.test_affected($$ update public.organizations set name = 'gehackt' where id = 'a0000000-0000-4000-8000-00000000000a' $$),
          0, 'adminB kann Firma A nicht umbenennen');
select lives_ok($$ insert into public.tickets (organization_id, title)
                   values ('a0000000-0000-4000-8000-00000000000b', 'B2') $$,
  'adminB darf Tickets in Firma B anlegen');
select is((select number from public.tickets where title = 'B2'),
          2, 'Firma B zählt unabhängig weiter: Nummer 2');

select * from finish();

rollback;
