-- DeskFlow – Statistik für das Dashboard und Realtime
--
-- 1) ticket_stats: zählt die Tickets einer Firma direkt in der Datenbank.
--    Die Funktion ist bewusst KEIN "security definer": Sie läuft mit den Rechten des
--    Aufrufers, die RLS-Policies greifen also. Ein Requester zählt nur seine eigenen
--    Tickets, ein Agent alle seiner Firma, und für eine fremde Firma kommt überall 0.
-- 2) Realtime: Die drei Tabellen kommen in die Publikation "supabase_realtime".
--    Der Realtime-Dienst prüft dann pro Empfänger die RLS-Policies: Ein Requester
--    bekommt keine Änderungen an fremden Tickets oder internen Kommentaren zu sehen.

-- 1) Statistik -------------------------------------------------------------------------

create function public.ticket_stats(org uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with t as (
    select status, priority, due_at, assignee_id,
           status not in ('geloest', 'geschlossen') as is_open
    from public.tickets
    where organization_id = org
  )
  select jsonb_build_object(
    'total',      (select count(*) from t),
    'open',       (select count(*) from t where is_open),
    'overdue',    (select count(*) from t where is_open and due_at < now()),
    'unassigned', (select count(*) from t where is_open and assignee_id is null),
    'mine',       (select count(*) from t where is_open and assignee_id = (select auth.uid())),
    'by_status',  coalesce(
      (select jsonb_object_agg(status::text, n)
       from (select status, count(*) as n from t group by status) s),
      '{}'::jsonb),
    -- nach Priorität zählen wir nur offene Tickets: Erledigtes interessiert dort nicht mehr
    'by_priority', coalesce(
      (select jsonb_object_agg(priority::text, n)
       from (select priority, count(*) as n from t where is_open group by priority) p),
      '{}'::jsonb)
  );
$$;

revoke all on function public.ticket_stats(uuid) from public, anon;
grant execute on function public.ticket_stats(uuid) to authenticated;

-- 2) Realtime ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.tickets, public.ticket_comments, public.ticket_events;
