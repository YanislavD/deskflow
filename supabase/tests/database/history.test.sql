-- DeskFlow – Tests für den vollständigen Verlauf (pgTAP)
-- Ausführen: npx supabase test db
-- Eigene Testdaten, am Ende wird alles zurückgerollt.

begin;

create extension if not exists pgtap with schema extensions;

select * from no_plan();

-- Testdaten ----------------------------------------------------------------------
--  Firma H: agentH (agent), reqH (requester)

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
       name || '@history.example', jsonb_build_object('full_name', name)
from (values
  ('d1000000-0000-4000-8000-0000000000a1'::uuid, 'agentH'),
  ('d1000000-0000-4000-8000-0000000000a2'::uuid, 'reqH')
) as t (id, name);

insert into public.organizations (id, name, slug)
values ('d2000000-0000-4000-8000-00000000000a', 'Verlauf H', 'verlauf-h');

insert into public.memberships (organization_id, user_id, role) values
  ('d2000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-0000000000a1', 'agent'),
  ('d2000000-0000-4000-8000-00000000000a', 'd1000000-0000-4000-8000-0000000000a2', 'requester');

insert into public.categories (id, organization_id, name) values
  ('d3000000-0000-4000-8000-0000000000c1', 'd2000000-0000-4000-8000-00000000000a', 'Kat 1'),
  ('d3000000-0000-4000-8000-0000000000c2', 'd2000000-0000-4000-8000-00000000000a', 'Kat 2');

insert into public.tickets (id, organization_id, title, description, requester_id, category_id) values
  ('d4000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-00000000000a', 'Alter Titel', 'Alter Text',
   'd1000000-0000-4000-8000-0000000000a2', 'd3000000-0000-4000-8000-0000000000c1');

-- Als Agent bearbeiten ----------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

select lives_ok($$ update public.tickets set title = 'Neuer Titel'
                   where id = 'd4000000-0000-4000-8000-000000000001' $$, 'Titel ändern');
select is((select old_value || ' -> ' || new_value from public.ticket_events where type = 'title'),
          'Alter Titel -> Neuer Titel', 'Verlauf: Titel mit altem und neuem Wert');

select lives_ok($$ update public.tickets set description = 'Neuer Text'
                   where id = 'd4000000-0000-4000-8000-000000000001' $$, 'Beschreibung ändern');
select is((select count(*)::int from public.ticket_events
           where type = 'description' and old_value is null and new_value is null),
          1, 'Verlauf: Beschreibung wird protokolliert, aber ohne Text zu speichern');

select lives_ok($$ update public.tickets set category_id = 'd3000000-0000-4000-8000-0000000000c2'
                   where id = 'd4000000-0000-4000-8000-000000000001' $$, 'Kategorie ändern');
select is((select old_value || ' > ' || new_value from public.ticket_events where type = 'category'),
          'd3000000-0000-4000-8000-0000000000c1 > d3000000-0000-4000-8000-0000000000c2',
          'Verlauf: Kategorie-IDs alt und neu');

select lives_ok($$ update public.tickets set due_at = '2030-05-01 21:59:00+00'
                   where id = 'd4000000-0000-4000-8000-000000000001' $$, 'Fälligkeit setzen');
select is((select old_value from public.ticket_events where type = 'due_at'),
          null, 'Verlauf: Fälligkeit war vorher leer');
select ok((select new_value from public.ticket_events where type = 'due_at') like '2030-05-01%',
          'Verlauf: neue Fälligkeit gespeichert');

-- Nichts geändert -> kein Eintrag
select lives_ok($$ update public.tickets
                   set title = 'Neuer Titel', description = 'Neuer Text',
                       category_id = 'd3000000-0000-4000-8000-0000000000c2', due_at = '2030-05-01 21:59:00+00'
                   where id = 'd4000000-0000-4000-8000-000000000001' $$, 'Speichern ohne Änderung');
select is((select count(*)::int from public.ticket_events), 4, 'Verlauf: gleiche Werte erzeugen keine neuen Einträge');

select lives_ok($$ update public.tickets set status = 'wartet'
                   where id = 'd4000000-0000-4000-8000-000000000001' $$, 'Status ändern');
select is((select count(*)::int from public.ticket_events), 5, 'Agent sieht alle 5 Ereignisse');

-- Requester sieht nur Status -------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);

select is((select array_agg(type) from public.ticket_events), array['status'],
          'Requester sieht nur das Status-Ereignis, nicht Titel/Beschreibung/Kategorie/Fälligkeit');

select * from finish();

rollback;
