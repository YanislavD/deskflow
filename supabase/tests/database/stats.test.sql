-- DeskFlow – Tests für ticket_stats (pgTAP)
-- Ausführen: npx supabase test db
-- Eigene Testdaten, am Ende wird alles zurückgerollt.

begin;

create extension if not exists pgtap with schema extensions;

select * from no_plan();

-- Testdaten ----------------------------------------------------------------------
--  Firma S: agentS, reqS1, reqS2      Firma T: agentT

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
       name || '@stats.example', jsonb_build_object('full_name', name)
from (values
  ('c1000000-0000-4000-8000-0000000000a1'::uuid, 'agentS'),
  ('c1000000-0000-4000-8000-0000000000a2'::uuid, 'reqS1'),
  ('c1000000-0000-4000-8000-0000000000a3'::uuid, 'reqS2'),
  ('c1000000-0000-4000-8000-0000000000b1'::uuid, 'agentT')
) as t (id, name);

insert into public.organizations (id, name, slug) values
  ('c2000000-0000-4000-8000-00000000000a', 'Statistik S', 'statistik-s'),
  ('c2000000-0000-4000-8000-00000000000b', 'Statistik T', 'statistik-t');

insert into public.memberships (organization_id, user_id, role) values
  ('c2000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-0000000000a1', 'agent'),
  ('c2000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-0000000000a2', 'requester'),
  ('c2000000-0000-4000-8000-00000000000a', 'c1000000-0000-4000-8000-0000000000a3', 'requester'),
  ('c2000000-0000-4000-8000-00000000000b', 'c1000000-0000-4000-8000-0000000000b1', 'agent');

-- T1: offen, überfällig, nicht zugewiesen        (reqS1, neu, hoch)
-- T2: offen, mir (agentS) zugewiesen, in Zukunft (reqS1, in_bearbeitung, kritisch)
-- T3: erledigt, Fälligkeit vorbei -> NICHT überfällig (reqS2, geloest, mittel, agentS)
-- T4: offen, nicht zugewiesen, ohne Fälligkeit   (reqS2, neu, niedrig)
insert into public.tickets (organization_id, title, requester_id, status, priority, assignee_id, due_at) values
  ('c2000000-0000-4000-8000-00000000000a', 'T1', 'c1000000-0000-4000-8000-0000000000a2', 'neu', 'hoch', null, now() - interval '1 day'),
  ('c2000000-0000-4000-8000-00000000000a', 'T2', 'c1000000-0000-4000-8000-0000000000a2', 'in_bearbeitung', 'kritisch', 'c1000000-0000-4000-8000-0000000000a1', now() + interval '2 days'),
  ('c2000000-0000-4000-8000-00000000000a', 'T3', 'c1000000-0000-4000-8000-0000000000a3', 'geloest', 'mittel', 'c1000000-0000-4000-8000-0000000000a1', now() - interval '3 days'),
  ('c2000000-0000-4000-8000-00000000000a', 'T4', 'c1000000-0000-4000-8000-0000000000a3', 'neu', 'niedrig', null, null);

-- anon ----------------------------------------------------------------------------------

set local role anon;
select throws_ok($$ select public.ticket_stats('c2000000-0000-4000-8000-00000000000a') $$, '42501', null,
  'anon darf die Statistik nicht abrufen');

-- Agent: sieht alles in Firma S ---------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

select is((public.ticket_stats('c2000000-0000-4000-8000-00000000000a') ->> 'total')::int, 4, 'Agent: 4 Tickets insgesamt');
select is((public.ticket_stats('c2000000-0000-4000-8000-00000000000a') ->> 'open')::int, 3, 'Agent: 3 offen (erledigte zählen nicht)');
select is((public.ticket_stats('c2000000-0000-4000-8000-00000000000a') ->> 'overdue')::int, 1, 'Agent: 1 überfällig (das erledigte zählt nicht)');
select is((public.ticket_stats('c2000000-0000-4000-8000-00000000000a') ->> 'unassigned')::int, 2, 'Agent: 2 offen ohne Zuständigen');
select is((public.ticket_stats('c2000000-0000-4000-8000-00000000000a') ->> 'mine')::int, 1, 'Agent: 1 offen, mir zugewiesen');
select is(public.ticket_stats('c2000000-0000-4000-8000-00000000000a') -> 'by_status',
          '{"neu": 2, "in_bearbeitung": 1, "geloest": 1}'::jsonb, 'Agent: Verteilung nach Status');
select is(public.ticket_stats('c2000000-0000-4000-8000-00000000000a') -> 'by_priority',
          '{"hoch": 1, "kritisch": 1, "niedrig": 1}'::jsonb, 'Agent: Verteilung nach Priorität (nur offene)');

-- Fremde Firma: RLS blendet alles aus ----------------------------------------------------

select is((public.ticket_stats('c2000000-0000-4000-8000-00000000000b') ->> 'total')::int, 0,
  'Agent S sieht in der Statistik von Firma T nichts');
select is(public.ticket_stats('c2000000-0000-4000-8000-00000000000b') -> 'by_status', '{}'::jsonb,
  'und die Verteilung ist leer');

-- Requester sieht nur seine eigenen Tickets ------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);

select is((public.ticket_stats('c2000000-0000-4000-8000-00000000000a') ->> 'total')::int, 2, 'Requester: nur die eigenen 2 Tickets');
select is((public.ticket_stats('c2000000-0000-4000-8000-00000000000a') ->> 'overdue')::int, 1, 'Requester: 1 eigenes überfällig');
select is((public.ticket_stats('c2000000-0000-4000-8000-00000000000a') ->> 'mine')::int, 0, 'Requester: nichts ist ihm zugewiesen');
select is(public.ticket_stats('c2000000-0000-4000-8000-00000000000a') -> 'by_status',
          '{"neu": 1, "in_bearbeitung": 1}'::jsonb, 'Requester: Verteilung nur über eigene Tickets');

select * from finish();

rollback;
