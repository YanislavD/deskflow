-- DeskFlow – Tests für Dateianhänge (pgTAP)
-- Ausführen: npx supabase test db   (braucht den Storage-Dienst der lokalen Supabase)
-- Eigene Testdaten, am Ende wird alles zurückgerollt.

begin;

create extension if not exists pgtap with schema extensions;

select * from no_plan();

-- Hilfsfunktion: Zahl der betroffenen Zeilen eines DELETE
create function public.att_affected(q text) returns int
language plpgsql as $$
declare n int;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Testdaten ----------------------------------------------------------------------
--  Firma F: adminF, agentF, req1F (Ticket T1), req2F (Ticket T2)      Firma G: agentG

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
       name || '@dateien.example', jsonb_build_object('full_name', name)
from (values
  ('e1000000-0000-4000-8000-0000000000a1'::uuid, 'adminF'),
  ('e1000000-0000-4000-8000-0000000000a2'::uuid, 'agentF'),
  ('e1000000-0000-4000-8000-0000000000a3'::uuid, 'req1F'),
  ('e1000000-0000-4000-8000-0000000000a4'::uuid, 'req2F'),
  ('e1000000-0000-4000-8000-0000000000b1'::uuid, 'agentG')
) as t (id, name);

insert into public.organizations (id, name, slug) values
  ('e2000000-0000-4000-8000-00000000000f', 'Dateien F', 'dateien-f'),
  ('e2000000-0000-4000-8000-00000000000e', 'Dateien G', 'dateien-g');

insert into public.memberships (organization_id, user_id, role) values
  ('e2000000-0000-4000-8000-00000000000f', 'e1000000-0000-4000-8000-0000000000a1', 'admin'),
  ('e2000000-0000-4000-8000-00000000000f', 'e1000000-0000-4000-8000-0000000000a2', 'agent'),
  ('e2000000-0000-4000-8000-00000000000f', 'e1000000-0000-4000-8000-0000000000a3', 'requester'),
  ('e2000000-0000-4000-8000-00000000000f', 'e1000000-0000-4000-8000-0000000000a4', 'requester'),
  ('e2000000-0000-4000-8000-00000000000e', 'e1000000-0000-4000-8000-0000000000b1', 'agent');

insert into public.tickets (id, organization_id, title, requester_id) values
  ('e3000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-00000000000f', 'T1', 'e1000000-0000-4000-8000-0000000000a3'),
  ('e3000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-00000000000f', 'T2', 'e1000000-0000-4000-8000-0000000000a4');

-- Bucket-Grenzen ----------------------------------------------------------------------------------

select is((select public from storage.buckets where id = 'ticket-attachments'), false, 'Bucket ist privat');
select is((select file_size_limit from storage.buckets where id = 'ticket-attachments'), 5242880::bigint, 'Größenlimit 5 MB');
select is((select 'image/svg+xml' = any (allowed_mime_types) from storage.buckets where id = 'ticket-attachments'),
          false, 'SVG ist nicht erlaubt');
select is((select 'text/html' = any (allowed_mime_types) from storage.buckets where id = 'ticket-attachments'),
          false, 'HTML ist nicht erlaubt');

-- Anfragender req1F: Datei hochladen --------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);

-- Storage-Objekt (die eigentliche Datei)
select lives_ok($$ insert into storage.objects (bucket_id, name, owner)
                   values ('ticket-attachments', 'e2000000-0000-4000-8000-00000000000f/e3000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000001.png',
                           'e1000000-0000-4000-8000-0000000000a3') $$,
  'req1F darf in den Ordner des eigenen Tickets hochladen');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner)
                    values ('ticket-attachments', 'e2000000-0000-4000-8000-00000000000f/e3000000-0000-4000-8000-000000000002/aaaaaaaa-0000-4000-8000-000000000002.png',
                            'e1000000-0000-4000-8000-0000000000a3') $$,
  '42501', null, 'req1F darf NICHT in den Ordner des Tickets von req2F hochladen');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner)
                    values ('ticket-attachments', 'kaputter-pfad.png', 'e1000000-0000-4000-8000-0000000000a3') $$,
  '42501', null, 'ein Pfad ohne <org>/<ticket>/-Ordner wird abgelehnt');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner)
                    values ('ticket-attachments', 'x/e3000000-0000-4000-8000-000000000001/y.png', 'e1000000-0000-4000-8000-0000000000a3') $$,
  '42501', null, 'ein Pfad mit ungültiger UUID wird abgelehnt (kein Fehler der Abfrage)');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner)
                    values ('andere-bucket', 'e2000000-0000-4000-8000-00000000000f/e3000000-0000-4000-8000-000000000001/z.png', 'e1000000-0000-4000-8000-0000000000a3') $$,
  '42501', null, 'in andere Buckets darf man nicht hochladen');

-- Metadaten-Eintrag
select lives_ok($$ insert into public.ticket_attachments (organization_id, ticket_id, file_name, mime_type, size_bytes, storage_path)
                   values ('e2000000-0000-4000-8000-00000000000f', 'e3000000-0000-4000-8000-000000000001', 'Fehler.png', 'image/png', 1234,
                           'e2000000-0000-4000-8000-00000000000f/e3000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000001.png') $$,
  'req1F darf den Eintrag für das eigene Ticket anlegen');
select throws_ok($$ insert into public.ticket_attachments (organization_id, ticket_id, file_name, mime_type, size_bytes, storage_path)
                    values ('e2000000-0000-4000-8000-00000000000f', 'e3000000-0000-4000-8000-000000000002', 'x.png', 'image/png', 10,
                            'e2000000-0000-4000-8000-00000000000f/e3000000-0000-4000-8000-000000000002/bbbbbbbb-0000-4000-8000-000000000001.png') $$,
  '42501', null, 'req1F darf keinen Eintrag für ein fremdes Ticket anlegen');
select throws_ok($$ insert into public.ticket_attachments (organization_id, ticket_id, file_name, mime_type, size_bytes, storage_path)
                    values ('e2000000-0000-4000-8000-00000000000f', 'e3000000-0000-4000-8000-000000000001', 'x.png', 'image/png', 10,
                            'e2000000-0000-4000-8000-00000000000f/e3000000-0000-4000-8000-000000000002/cccccccc-0000-4000-8000-000000000001.png') $$,
  '23514', null, 'der Pfad muss zum Ticket des Eintrags passen');
select throws_ok($$ insert into public.ticket_attachments (organization_id, ticket_id, file_name, mime_type, size_bytes, storage_path)
                    values ('e2000000-0000-4000-8000-00000000000f', 'e3000000-0000-4000-8000-000000000001', 'gross.png', 'image/png', 6000000,
                            'e2000000-0000-4000-8000-00000000000f/e3000000-0000-4000-8000-000000000001/dddddddd-0000-4000-8000-000000000001.png') $$,
  '23514', null, 'Dateien über 5 MB werden abgelehnt');
select throws_ok($$ insert into public.ticket_attachments (organization_id, ticket_id, file_name, mime_type, size_bytes, storage_path, uploaded_by)
                    values ('e2000000-0000-4000-8000-00000000000f', 'e3000000-0000-4000-8000-000000000001', 'x.png', 'image/png', 10,
                            'e2000000-0000-4000-8000-00000000000f/e3000000-0000-4000-8000-000000000001/eeeeeeee-0000-4000-8000-000000000001.png',
                            'e1000000-0000-4000-8000-0000000000a2') $$,
  '42501', null, 'uploaded_by lässt sich nicht auf jemand anderen fälschen');

select is((select count(*)::int from public.ticket_attachments), 1, 'req1F sieht seinen Anhang');
select is((select count(*)::int from storage.objects where bucket_id = 'ticket-attachments'), 1,
  'und die zugehörige Datei');

-- Agent: sieht alles in Firma F, lädt selbst etwas zu T2 hoch ----------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);

select lives_ok($$ insert into storage.objects (bucket_id, name, owner)
                   values ('ticket-attachments', 'e2000000-0000-4000-8000-00000000000f/e3000000-0000-4000-8000-000000000002/ffffffff-0000-4000-8000-000000000001.pdf',
                           'e1000000-0000-4000-8000-0000000000a2') $$, 'Agent darf in jedes Ticket der Firma hochladen');
select lives_ok($$ insert into public.ticket_attachments (organization_id, ticket_id, file_name, mime_type, size_bytes, storage_path)
                   values ('e2000000-0000-4000-8000-00000000000f', 'e3000000-0000-4000-8000-000000000002', 'Anleitung.pdf', 'application/pdf', 5000,
                           'e2000000-0000-4000-8000-00000000000f/e3000000-0000-4000-8000-000000000002/ffffffff-0000-4000-8000-000000000001.pdf') $$,
  'Agent legt den Eintrag an');
select is((select count(*)::int from public.ticket_attachments), 2, 'Agent sieht beide Anhänge der Firma');

-- Der Agent darf die Datei des Anfragenden nicht löschen (nicht Hochlader, kein Admin)
select is(public.att_affected($$ delete from public.ticket_attachments where file_name = 'Fehler.png' $$), 0,
  'Agent darf den Anhang des Anfragenden nicht löschen');

-- req2F: sieht nur den Anhang an seinem Ticket -------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-0000000000a4","role":"authenticated"}', true);

select is((select count(*)::int from public.ticket_attachments), 1, 'req2F sieht nur den Anhang seines eigenen Tickets');
select is((select file_name from public.ticket_attachments), 'Anleitung.pdf', 'und zwar den vom Agent');
select is((select count(*)::int from storage.objects where bucket_id = 'ticket-attachments'), 1,
  'req2F sieht auch nur die eigene Datei im Storage');

-- Fremde Firma ------------------------------------------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);

select is((select count(*)::int from public.ticket_attachments), 0, 'agentG (andere Firma) sieht keine Anhänge');
select is((select count(*)::int from storage.objects where bucket_id = 'ticket-attachments'), 0,
  'und keine Dateien im Storage');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner)
                    values ('ticket-attachments', 'e2000000-0000-4000-8000-00000000000f/e3000000-0000-4000-8000-000000000001/gggggggg-0000-4000-8000-000000000001.png',
                            'e1000000-0000-4000-8000-0000000000b1') $$,
  '42501', null, 'agentG darf nicht in Tickets einer fremden Firma hochladen');

-- Admin darf fremde Anhänge der eigenen Firma löschen ---------------------------------------------------------

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

-- Reihenfolge ist wichtig: ERST die Datei, DANN der Eintrag. Die Lese-Policy des Storage prüft
-- den Eintrag in ticket_attachments; ist er schon weg, lässt sich die Datei nicht mehr löschen.
-- Storage verbietet direktes DELETE per SQL, außer man erlaubt es ausdrücklich (nur für diesen Test).
select set_config('storage.allow_delete_query', 'true', true);
select is(public.att_affected($$ delete from storage.objects where name like '%aaaaaaaa-0000-4000-8000-000000000001.png' $$), 1,
  'Admin darf die Datei im Storage löschen');
select is(public.att_affected($$ delete from public.ticket_attachments where file_name = 'Fehler.png' $$), 1,
  'und danach den Eintrag der Firma');

select * from finish();

rollback;
