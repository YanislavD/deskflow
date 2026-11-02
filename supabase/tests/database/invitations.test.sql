-- DeskFlow – Tests für Einladungen (pgTAP)
-- Ausführen: npx supabase test db
-- Eigene Testdaten, am Ende wird alles zurückgerollt.

begin;

create extension if not exists pgtap with schema extensions;

select * from no_plan();

-- Testdaten ----------------------------------------------------------------------
--  Firma I: adminI, agentI, memberI (Mitglied)    Firma J: adminJ
--  Eingeladen werden: gast@einladung.example (registriert, ohne Firma) und fremd@einladung.example

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
       name || '@einladung.example', jsonb_build_object('full_name', name)
from (values
  ('f1000000-0000-4000-8000-0000000000a1'::uuid, 'adminI'),
  ('f1000000-0000-4000-8000-0000000000a2'::uuid, 'agentI'),
  ('f1000000-0000-4000-8000-0000000000a3'::uuid, 'memberI'),
  ('f1000000-0000-4000-8000-0000000000b1'::uuid, 'adminJ'),
  ('f1000000-0000-4000-8000-0000000000c1'::uuid, 'gast'),
  ('f1000000-0000-4000-8000-0000000000c2'::uuid, 'fremd')
) as t (id, name);

insert into public.organizations (id, name, slug) values
  ('f2000000-0000-4000-8000-00000000000a', 'Einladung I', 'einladung-i'),
  ('f2000000-0000-4000-8000-00000000000b', 'Einladung J', 'einladung-j');

insert into public.memberships (organization_id, user_id, role) values
  ('f2000000-0000-4000-8000-00000000000a', 'f1000000-0000-4000-8000-0000000000a1', 'admin'),
  ('f2000000-0000-4000-8000-00000000000a', 'f1000000-0000-4000-8000-0000000000a2', 'agent'),
  ('f2000000-0000-4000-8000-00000000000a', 'f1000000-0000-4000-8000-0000000000a3', 'requester'),
  ('f2000000-0000-4000-8000-00000000000b', 'f1000000-0000-4000-8000-0000000000b1', 'admin');

-- Hilfsfunktion: Token zwischen Abschnitten merken (die Tests laufen als verschiedene Nutzer)
create table public.test_tokens (name text primary key, token text);
grant all on public.test_tokens to authenticated, anon;

-- Agent und Admin der anderen Firma dürfen nicht einladen ----------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
select throws_ok($$ select public.create_invitation('f2000000-0000-4000-8000-00000000000a', 'gast@einladung.example', 'requester') $$,
  '42501', null, 'Agent darf nicht einladen');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$ select public.create_invitation('f2000000-0000-4000-8000-00000000000a', 'gast@einladung.example', 'requester') $$,
  '42501', null, 'Admin einer anderen Firma darf nicht einladen');

-- Admin I lädt ein ------------------------------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

select throws_ok($$ select public.create_invitation('f2000000-0000-4000-8000-00000000000a', 'kein-at-zeichen', 'requester') $$,
  '22023', 'invalid_email', 'ungültige E-Mail wird abgelehnt');
select throws_ok($$ select public.create_invitation('f2000000-0000-4000-8000-00000000000a', 'memberI@einladung.example', 'agent') $$,
  '23505', 'already_member', 'wer schon Mitglied ist, wird nicht eingeladen');

select lives_ok($$ insert into public.test_tokens
                   select 'gast', public.create_invitation('f2000000-0000-4000-8000-00000000000a', '  GAST@Einladung.Example ', 'agent') $$,
  'Admin lädt gast ein (E-Mail wird normalisiert)');

select is((select count(*)::int from public.invitations), 1, 'Admin sieht die offene Einladung');
select is((select email from public.invitations), 'gast@einladung.example', 'E-Mail ist klein geschrieben und getrimmt');
select ok((select length(token) >= 30 and token !~ '[+/=]' from public.test_tokens where name = 'gast'),
  'der Token ist lang und URL-tauglich');
select isnt((select token_hash from public.invitations), (select token from public.test_tokens where name = 'gast'),
  'in der Datenbank steht nur der Hash, nicht der Token selbst');

-- Erneut einladen ersetzt die alte Einladung (der alte Token wird ungültig)
select lives_ok($$ insert into public.test_tokens
                   select 'gast-neu', public.create_invitation('f2000000-0000-4000-8000-00000000000a', 'gast@einladung.example', 'requester') $$,
  'erneutes Einladen ist möglich');
select is((select count(*)::int from public.invitations), 1, 'es gibt weiterhin nur EINE offene Einladung pro E-Mail');

-- Agent sieht keine Einladungen
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
select is((select count(*)::int from public.invitations), 0, 'Agent sieht keine Einladungen');

-- Annehmen --------------------------------------------------------------------------------------------------------

-- fremd (falsche E-Mail) versucht den Token von gast
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);
select throws_ok($$ select public.accept_invitation((select token from public.test_tokens where name = 'gast-neu')) $$,
  '42501', 'wrong_email', 'ein anderer Nutzer kann die Einladung nicht annehmen');
select throws_ok($$ select public.accept_invitation('das-ist-nicht-der-token') $$,
  'P0002', 'invalid_invitation', 'ein falscher Token wird abgelehnt');

-- gast mit dem ALTEN (ersetzten) Token
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$ select public.accept_invitation((select token from public.test_tokens where name = 'gast')) $$,
  'P0002', 'invalid_invitation', 'der alte, ersetzte Token ist ungültig');

-- gast mit dem neuen Token
select lives_ok($$ select public.accept_invitation((select token from public.test_tokens where name = 'gast-neu')) $$,
  'gast darf die Einladung annehmen');
select is((select role::text from public.memberships where organization_id = 'f2000000-0000-4000-8000-00000000000a'
           and user_id = 'f1000000-0000-4000-8000-0000000000c1'),
          'requester', 'gast ist Mitglied mit der eingeladenen Rolle');
select throws_ok($$ select public.accept_invitation((select token from public.test_tokens where name = 'gast-neu')) $$,
  'P0002', 'invalid_invitation', 'der Token ist nur einmal benutzbar');

-- anon darf gar nichts ------------------------------------------------------------------------------------------

reset role;
set local role anon;
select throws_ok($$ select public.accept_invitation('x') $$, '42501', null, 'anon darf keine Einladung annehmen');
select throws_ok($$ select public.create_invitation('f2000000-0000-4000-8000-00000000000a', 'a@b.example', 'requester') $$,
  '42501', null, 'anon darf nicht einladen');

-- Abgelaufen und zurückgezogen -------------------------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$ insert into public.test_tokens
                   select 'fremd', public.create_invitation('f2000000-0000-4000-8000-00000000000a', 'fremd@einladung.example', 'requester') $$,
  'Admin lädt fremd ein');

-- abgelaufen simulieren (als postgres)
reset role;
update public.invitations set expires_at = now() - interval '1 minute' where email = 'fremd@einladung.example';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);
select throws_ok($$ select public.accept_invitation((select token from public.test_tokens where name = 'fremd')) $$,
  'P0002', 'invalid_invitation', 'eine abgelaufene Einladung lässt sich nicht annehmen');

-- Admin zieht zurück (neu einladen, dann löschen)
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$ insert into public.test_tokens
                   select 'fremd2', public.create_invitation('f2000000-0000-4000-8000-00000000000a', 'fremd@einladung.example', 'requester') $$,
  'neu einladen');
select lives_ok($$ delete from public.invitations where email = 'fremd@einladung.example' $$, 'Admin darf eine Einladung zurückziehen');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f1000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);
select throws_ok($$ select public.accept_invitation((select token from public.test_tokens where name = 'fremd2')) $$,
  'P0002', 'invalid_invitation', 'eine zurückgezogene Einladung ist ungültig');

select * from finish();

rollback;
