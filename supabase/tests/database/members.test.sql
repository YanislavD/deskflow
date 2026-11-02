-- DeskFlow – Tests für Mitgliederverwaltung (pgTAP)
-- Ausführen: npx supabase test db
-- Eigene Testdaten, am Ende wird alles zurückgerollt.

begin;

create extension if not exists pgtap with schema extensions;

select * from no_plan();

-- Testdaten ----------------------------------------------------------------------
--  Firma A: adminA, adminA2, agentA     Firma B: adminB     registriert, ohne Firma: newbie

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
       name || '@members.example', jsonb_build_object('full_name', name)
from (values
  ('f0000000-0000-4000-8000-0000000000a1'::uuid, 'adminA'),
  ('f0000000-0000-4000-8000-0000000000a2'::uuid, 'adminA2'),
  ('f0000000-0000-4000-8000-0000000000a3'::uuid, 'agentA'),
  ('f0000000-0000-4000-8000-0000000000b1'::uuid, 'adminB'),
  ('f0000000-0000-4000-8000-0000000000c1'::uuid, 'newbie')
) as t (id, name);

insert into public.organizations (id, name, slug) values
  ('f1000000-0000-4000-8000-00000000000a', 'Mitglieder A', 'mitglieder-a'),
  ('f1000000-0000-4000-8000-00000000000b', 'Mitglieder B', 'mitglieder-b');

insert into public.memberships (id, organization_id, user_id, role) values
  ('f2000000-0000-4000-8000-0000000000a1', 'f1000000-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-0000000000a1', 'admin'),
  ('f2000000-0000-4000-8000-0000000000a2', 'f1000000-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-0000000000a2', 'admin'),
  ('f2000000-0000-4000-8000-0000000000a3', 'f1000000-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-0000000000a3', 'agent'),
  ('f2000000-0000-4000-8000-0000000000b1', 'f1000000-0000-4000-8000-00000000000b', 'f0000000-0000-4000-8000-0000000000b1', 'admin');

-- Als Agent: darf nichts ----------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);

select throws_ok($$ select public.add_member_by_email('f1000000-0000-4000-8000-00000000000a', 'newbie@members.example', 'requester') $$,
  '42501', null, 'agentA darf keine Mitglieder per E-Mail hinzufügen');

-- Als Admin der anderen Firma ---------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);

select throws_ok($$ select public.add_member_by_email('f1000000-0000-4000-8000-00000000000a', 'newbie@members.example', 'requester') $$,
  '42501', null, 'adminB darf nicht in Firma A hinzufügen');

-- Als Admin A ---------------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

select throws_ok($$ select public.add_member_by_email('f1000000-0000-4000-8000-00000000000a', 'gibt-es-nicht@members.example', 'requester') $$,
  'P0002', 'user_not_found', 'unbekannte E-Mail -> user_not_found');
select throws_ok($$ select public.add_member_by_email('f1000000-0000-4000-8000-00000000000a', 'agentA@members.example', 'requester') $$,
  '23505', 'already_member', 'bereits Mitglied -> already_member');
select lives_ok($$ select public.add_member_by_email('f1000000-0000-4000-8000-00000000000a', '  NEWBIE@Members.Example ', 'requester') $$,
  'adminA fügt newbie hinzu (Groß-/Kleinschreibung und Leerzeichen egal)');
select is((select role::text from public.memberships
           where organization_id = 'f1000000-0000-4000-8000-00000000000a'
             and user_id = 'f0000000-0000-4000-8000-0000000000c1'),
          'requester', 'newbie ist jetzt requester in Firma A');

-- Rolle ändern und entfernen --------------------------------------------------------------

select lives_ok($$ update public.memberships set role = 'agent' where id = 'f2000000-0000-4000-8000-0000000000a2' $$,
  'adminA darf adminA2 zum Agent machen (es bleibt ein Admin)');
select throws_ok($$ update public.memberships set role = 'agent' where id = 'f2000000-0000-4000-8000-0000000000a1' $$,
  'P0001', 'last_admin', 'der letzte Admin kann nicht degradiert werden');
select throws_ok($$ delete from public.memberships where id = 'f2000000-0000-4000-8000-0000000000a1' $$,
  'P0001', 'last_admin', 'der letzte Admin kann nicht entfernt werden');
select lives_ok($$ delete from public.memberships where id = 'f2000000-0000-4000-8000-0000000000a3' $$,
  'ein Agent darf entfernt werden');

-- Firma löschen muss trotz "letztem Admin" funktionieren ---------------------------------------

reset role;
select lives_ok($$ delete from public.organizations where id = 'f1000000-0000-4000-8000-00000000000b' $$,
  'Eine ganze Firma samt letztem Admin lässt sich löschen');
select is((select count(*)::int from public.memberships where organization_id = 'f1000000-0000-4000-8000-00000000000b'),
          0, 'und ihre Mitgliedschaften sind weg');

select * from finish();

rollback;
