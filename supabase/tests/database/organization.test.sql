-- DeskFlow – Tests für create_organization (pgTAP)
-- Ausführen: npx supabase test db
-- Eigene Testdaten, am Ende wird alles zurückgerollt.

begin;

create extension if not exists pgtap with schema extensions;

select * from no_plan();

-- Testdaten ----------------------------------------------------------------------
--  gruender1, gruender2, gruender3: registriert, ohne Firma     mitglied: ist schon in einer Firma

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
       name || '@onboarding.example', jsonb_build_object('full_name', name)
from (values
  ('e1000000-0000-4000-8000-0000000000a1'::uuid, 'gruender1'),
  ('e1000000-0000-4000-8000-0000000000a2'::uuid, 'gruender2'),
  ('e1000000-0000-4000-8000-0000000000a3'::uuid, 'gruender3'),
  ('e1000000-0000-4000-8000-0000000000b1'::uuid, 'mitglied')
) as t (id, name);

insert into public.organizations (id, name, slug)
values ('e2000000-0000-4000-8000-00000000000b', 'Bestehende Firma', 'bestehende-firma');
insert into public.memberships (organization_id, user_id, role)
values ('e2000000-0000-4000-8000-00000000000b', 'e1000000-0000-4000-8000-0000000000b1', 'requester');

-- Nicht angemeldet ---------------------------------------------------------------------

set local role anon;
select throws_ok($$ select public.create_organization('Anon GmbH') $$, '42501', null,
  'anon darf keine Firma gründen');

-- gruender1 gründet "Müller & Söhne GmbH" -------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

select throws_ok($$ select public.create_organization('X') $$, '22023', 'invalid_name',
  'zu kurzer Name wird abgelehnt');
select throws_ok($$ select public.create_organization('   ') $$, '22023', 'invalid_name',
  'leerer Name wird abgelehnt');
select lives_ok($$ select public.create_organization('  Müller & Söhne GmbH ') $$,
  'gruender1 darf eine Firma gründen');

select is((select count(*)::int from public.organizations), 1, 'gruender1 sieht seine Firma (und nur diese)');
select is((select slug from public.organizations), 'mueller-soehne-gmbh', 'Slug: Umlaute und Sonderzeichen werden bereinigt');
select is((select name from public.organizations), 'Müller & Söhne GmbH', 'Name wird getrimmt');
select is((select role::text from public.memberships), 'admin', 'gruender1 ist Admin der neuen Firma');
select is((select count(*)::int from public.categories), 5, 'es gibt 5 Standard-Kategorien');
select throws_ok($$ select public.create_organization('Zweite Firma') $$, 'P0001', 'already_in_organization',
  'wer schon Mitglied ist, darf keine weitere Firma gründen');

-- Das Ergebnis funktioniert wirklich: als Admin Tickets anlegen und Kategorien verwalten
select lives_ok($$ insert into public.tickets (organization_id, title)
                   select id, 'Erstes Ticket' from public.organizations $$,
  'der neue Admin kann Tickets in seiner Firma anlegen');
select is((select number from public.tickets), 1, 'und das erste Ticket hat die Nummer 1');

-- gruender2 gründet eine Firma mit demselben Namen -----------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);

select lives_ok($$ select public.create_organization('Müller & Söhne GmbH') $$,
  'gleicher Firmenname ist erlaubt');
select ok((select slug from public.organizations) ~ '^mueller-soehne-gmbh-[0-9a-f]{6}$',
  'der Slug bekommt ein Suffix, damit er eindeutig bleibt');
select is((select count(*)::int from public.organizations), 1,
  'gruender2 sieht nur die eigene Firma, nicht die von gruender1');

-- Mitglied einer bestehenden Firma ------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);

select throws_ok($$ select public.create_organization('Noch eine Firma') $$, 'P0001', 'already_in_organization',
  'ein Mitglied einer Firma darf keine weitere gründen');

-- Namen nur aus Sonderzeichen -> Fallback-Slug ---------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);

select lives_ok($$ select public.create_organization('&&') $$, 'Name aus Sonderzeichen ist (2 Zeichen) erlaubt');
select is((select slug from public.organizations), 'firma', 'Slug fällt auf "firma" zurück');

select * from finish();

rollback;
