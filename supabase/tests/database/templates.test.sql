-- DeskFlow – Tests für Antwortvorlagen (pgTAP)
-- Ausführen: npx supabase test db
-- Eigene Testdaten, am Ende wird alles zurückgerollt.

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

-- Testdaten ----------------------------------------------------------------------
--  Firma V: adminV, agentV, reqV      Firma W: adminW

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
       name || '@vorlagen.example', jsonb_build_object('full_name', name)
from (values
  ('a1000000-0000-4000-8000-0000000000a1'::uuid, 'adminV'),
  ('a1000000-0000-4000-8000-0000000000a2'::uuid, 'agentV'),
  ('a1000000-0000-4000-8000-0000000000a3'::uuid, 'reqV'),
  ('a1000000-0000-4000-8000-0000000000b1'::uuid, 'adminW')
) as t (id, name);

insert into public.organizations (id, name, slug) values
  ('a2000000-0000-4000-8000-00000000000a', 'Vorlagen V', 'vorlagen-v'),
  ('a2000000-0000-4000-8000-00000000000b', 'Vorlagen W', 'vorlagen-w');

insert into public.memberships (organization_id, user_id, role) values
  ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000000a1', 'admin'),
  ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000000a2', 'agent'),
  ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-0000000000a3', 'requester'),
  ('a2000000-0000-4000-8000-00000000000b', 'a1000000-0000-4000-8000-0000000000b1', 'admin');

insert into public.reply_templates (organization_id, title, body) values
  ('a2000000-0000-4000-8000-00000000000a', 'Begrüßung', 'Hallo, danke für deine Nachricht!'),
  ('a2000000-0000-4000-8000-00000000000b', 'Fremd', 'gehört zu Firma W');

-- Requester sieht keine Vorlagen -------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);

select is((select count(*)::int from public.reply_templates), 0, 'Requester sieht keine Vorlagen');
select throws_ok($$ insert into public.reply_templates (organization_id, title, body)
                    values ('a2000000-0000-4000-8000-00000000000a', 'X', 'Y') $$,
  '42501', null, 'Requester darf keine Vorlage anlegen');

-- Agent: lesen ja, verwalten nein ---------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);

select is((select count(*)::int from public.reply_templates), 1, 'Agent sieht nur die Vorlage der eigenen Firma');
select is((select title from public.reply_templates), 'Begrüßung', 'und zwar die richtige');
select throws_ok($$ insert into public.reply_templates (organization_id, title, body)
                    values ('a2000000-0000-4000-8000-00000000000a', 'Agent-Vorlage', 'Text') $$,
  '42501', null, 'Agent darf keine Vorlage anlegen');
select is(public.test_affected($$ update public.reply_templates set body = 'gehackt' $$), 0,
  'Agent darf keine Vorlage ändern (0 Zeilen)');
select is(public.test_affected($$ delete from public.reply_templates $$), 0,
  'Agent darf keine Vorlage löschen (0 Zeilen)');

-- Admin V: verwalten -----------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

select lives_ok($$ insert into public.reply_templates (organization_id, title, body)
                   values ('a2000000-0000-4000-8000-00000000000a', 'Neu', 'Neuer Text') $$,
  'Admin darf eine Vorlage anlegen');
select throws_ok($$ insert into public.reply_templates (organization_id, title, body)
                    values ('a2000000-0000-4000-8000-00000000000a', 'Neu', 'doppelt') $$,
  '23505', null, 'Titel muss pro Firma eindeutig sein');
select throws_ok($$ insert into public.reply_templates (organization_id, title, body)
                    values ('a2000000-0000-4000-8000-00000000000b', 'In fremder Firma', 'x') $$,
  '42501', null, 'Admin V darf nicht in Firma W anlegen');
select throws_ok($$ insert into public.reply_templates (organization_id, title, body)
                    values ('a2000000-0000-4000-8000-00000000000a', '   ', 'x') $$,
  '23514', null, 'leerer Titel wird abgelehnt');
select is(public.test_affected($$ update public.reply_templates set body = 'geändert' where title = 'Neu' $$), 1,
  'Admin darf ändern');
select is(public.test_affected($$ delete from public.reply_templates where title = 'Neu' $$), 1,
  'Admin darf löschen');
select is((select count(*)::int from public.reply_templates), 1, 'Admin V sieht die Vorlage von Firma W nicht');

select * from finish();

rollback;
