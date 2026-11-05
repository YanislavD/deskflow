-- DeskFlow – Tests für Benachrichtigungen (pgTAP)
-- Ausführen: npx supabase test db
-- Eigene Testdaten, am Ende wird alles zurückgerollt.

begin;

create extension if not exists pgtap with schema extensions;

select * from no_plan();

-- Hilfsfunktion: führt ein UPDATE/DELETE aus und liefert die Zahl der betroffenen Zeilen.
create function public.notif_affected(q text) returns int
language plpgsql as $$
declare n int;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Testdaten ----------------------------------------------------------------------
--  Firma N: agentN (agent), agent2N (agent), reqN (requester)

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
       name || '@notify.example', jsonb_build_object('full_name', name)
from (values
  ('b1000000-0000-4000-8000-0000000000a1'::uuid, 'agentN'),
  ('b1000000-0000-4000-8000-0000000000a2'::uuid, 'agent2N'),
  ('b1000000-0000-4000-8000-0000000000a3'::uuid, 'reqN')
) as t (id, name);

insert into public.organizations (id, name, slug)
values ('b2000000-0000-4000-8000-00000000000a', 'Benachrichtigung N', 'benachrichtigung-n');

insert into public.memberships (organization_id, user_id, role) values
  ('b2000000-0000-4000-8000-00000000000a', 'b1000000-0000-4000-8000-0000000000a1', 'agent'),
  ('b2000000-0000-4000-8000-00000000000a', 'b1000000-0000-4000-8000-0000000000a2', 'agent'),
  ('b2000000-0000-4000-8000-00000000000a', 'b1000000-0000-4000-8000-0000000000a3', 'requester');

-- Ticket gehört reqN und ist agentN zugewiesen
insert into public.tickets (id, organization_id, title, requester_id, assignee_id) values
  ('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-00000000000a', 'Ticket N',
   'b1000000-0000-4000-8000-0000000000a3', 'b1000000-0000-4000-8000-0000000000a1');

-- Der Anfang ist leer (Anlegen und Zuweisen per SQL erzeugt keine Benachrichtigung)
select is((select count(*)::int from public.notifications where organization_id = 'b2000000-0000-4000-8000-00000000000a'), 0,
          'am Anfang gibt es in dieser Firma keine Benachrichtigungen');

-- Kommentar des Anfragenden -> Zuständiger wird benachrichtigt ----------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
insert into public.ticket_comments (ticket_id, organization_id, body)
values ('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-00000000000a', 'Frage vom Anfragenden');

reset role;
select is((select count(*)::int from public.notifications where user_id = 'b1000000-0000-4000-8000-0000000000a1' and type = 'comment'),
          1, 'Kommentar des Anfragenden -> der Zuständige wird benachrichtigt');
select is((select count(*)::int from public.notifications where user_id = 'b1000000-0000-4000-8000-0000000000a3'),
          0, 'der Autor wird nicht über den eigenen Kommentar benachrichtigt');

-- Öffentlicher Kommentar des Agents -> Anfragender ------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
insert into public.ticket_comments (ticket_id, organization_id, body, is_internal)
values ('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-00000000000a', 'Antwort', false);

reset role;
select is((select count(*)::int from public.notifications where user_id = 'b1000000-0000-4000-8000-0000000000a3' and type = 'comment'),
          1, 'öffentlicher Kommentar des Agents -> der Anfragende wird benachrichtigt');
select is((select count(*)::int from public.notifications where user_id = 'b1000000-0000-4000-8000-0000000000a1'),
          1, 'der Agent bekommt nichts über den eigenen Kommentar (nur den ersten von oben)');

-- INTERNER Kommentar -> Anfragender bekommt NICHTS ------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
insert into public.ticket_comments (ticket_id, organization_id, body, is_internal)
values ('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-00000000000a', 'Interne Notiz', true);

reset role;
select is((select count(*)::int from public.notifications where user_id = 'b1000000-0000-4000-8000-0000000000a3'),
          1, 'interner Kommentar erzeugt für den Anfragenden KEINE Benachrichtigung (weiterhin nur 1)');
select is((select count(*)::int from public.notifications where user_id = 'b1000000-0000-4000-8000-0000000000a1'),
          2, 'aber der Zuständige wird informiert');

-- Statuswechsel durch einen Agent -> Anfragender ----------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
update public.tickets set status = 'in_bearbeitung' where id = 'b3000000-0000-4000-8000-000000000001';

reset role;
select is((select detail from public.notifications where user_id = 'b1000000-0000-4000-8000-0000000000a3' and type = 'status'),
          'in_bearbeitung', 'Statuswechsel -> der Anfragende bekommt die Meldung mit dem neuen Status');

-- Zuweisung an agent2N durch agentN -----------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
update public.tickets set assignee_id = 'b1000000-0000-4000-8000-0000000000a2' where id = 'b3000000-0000-4000-8000-000000000001';

reset role;
select is((select count(*)::int from public.notifications where user_id = 'b1000000-0000-4000-8000-0000000000a2' and type = 'assigned'),
          1, 'Zuweisung -> der neue Zuständige wird benachrichtigt');

-- Sich selbst zuweisen erzeugt nichts
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
update public.tickets set assignee_id = 'b1000000-0000-4000-8000-0000000000a1' where id = 'b3000000-0000-4000-8000-000000000001';
reset role;
select is((select count(*)::int from public.notifications where user_id = 'b1000000-0000-4000-8000-0000000000a1' and type = 'assigned'),
          0, 'wer sich selbst zuweist, bekommt keine Benachrichtigung');

-- Rechte (RLS) -----------------------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);

select is((select count(*)::int from public.notifications), 2, 'der Anfragende sieht nur seine 2 eigenen Benachrichtigungen');
select throws_ok($$ insert into public.notifications (organization_id, user_id, ticket_id, type)
                    values ('b2000000-0000-4000-8000-00000000000a', 'b1000000-0000-4000-8000-0000000000a3',
                            'b3000000-0000-4000-8000-000000000001', 'comment') $$,
  '42501', null, 'Clients dürfen keine Benachrichtigungen anlegen');
select throws_ok($$ update public.notifications set user_id = 'b1000000-0000-4000-8000-0000000000a1' $$,
  '42501', null, 'user_id darf nicht geändert werden (nur read_at)');
select lives_ok($$ update public.notifications set read_at = now() where type = 'status' $$,
  'als gelesen markieren ist erlaubt');
select is((select count(*)::int from public.notifications where read_at is not null), 1, 'genau eine ist jetzt gelesen');

-- agentN sieht nicht die Benachrichtigungen anderer
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
select is((select count(*)::int from public.notifications where user_id <> 'b1000000-0000-4000-8000-0000000000a2'),
          0, 'man sieht keine fremden Benachrichtigungen');
select is(public.notif_affected($$ delete from public.notifications $$), 1,
  'man darf die eigenen löschen (agent2N hat genau 1) und nur diese');

select * from finish();

rollback;
