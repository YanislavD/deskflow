-- DeskFlow – Benachrichtigungen in der App
--
-- Wer bekommt wann eine Benachrichtigung?
--   * Neuer Kommentar:   der Zuständige des Tickets und der Anfragende (außer dem Autor selbst).
--                        Interne Kommentare gehen NIE an den Anfragenden.
--   * Zuständigkeit:     der neue Zuständige (wenn jemand anderes ihn zugewiesen hat).
--   * Statuswechsel:     der Anfragende (wenn jemand anderes den Status geändert hat).
--
-- Erzeugt werden sie ausschließlich von Triggern (security definer). Clients dürfen sie nur
-- lesen, als gelesen markieren (read_at) und löschen – und nur die eigenen.

create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  ticket_id       uuid not null,
  type            text not null check (type in ('comment', 'assigned', 'status')),
  actor_id        uuid references public.profiles (id) on delete set null,
  -- bei type = 'status': der neue Status (z. B. "in_bearbeitung")
  detail          text,
  created_at      timestamptz not null default now(),
  read_at         timestamptz,

  foreign key (organization_id, ticket_id)
    references public.tickets (organization_id, id) on delete cascade
);

create index notifications_user_idx
  on public.notifications (user_id, organization_id, read_at, created_at desc);

-- RLS und Rechte --------------------------------------------------------------------------

alter table public.notifications enable row level security;

revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
-- Ändern darf man nur "gelesen" – nicht ticket_id, user_id usw.
grant update (read_at) on public.notifications to authenticated;

create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()) and private.is_org_member(organization_id));

create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy notifications_delete on public.notifications
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Trigger: neuer Kommentar -------------------------------------------------------------------

create function private.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ticket record;
begin
  select t.requester_id, t.assignee_id into ticket
  from public.tickets t where t.id = new.ticket_id;

  -- Zuständiger (sieht auch interne Kommentare)
  if ticket.assignee_id is not null and ticket.assignee_id is distinct from new.author_id then
    insert into public.notifications (organization_id, user_id, ticket_id, type, actor_id)
    values (new.organization_id, ticket.assignee_id, new.ticket_id, 'comment', new.author_id);
  end if;

  -- Anfragender: nur bei ÖFFENTLICHEN Kommentaren, und nicht doppelt, falls er selbst zuständig ist
  if not new.is_internal
     and ticket.requester_id is not null
     and ticket.requester_id is distinct from new.author_id
     and ticket.requester_id is distinct from ticket.assignee_id then
    insert into public.notifications (organization_id, user_id, ticket_id, type, actor_id)
    values (new.organization_id, ticket.requester_id, new.ticket_id, 'comment', new.author_id);
  end if;

  return null;
end;
$$;

create trigger ticket_comments_notify
  after insert on public.ticket_comments
  for each row execute function private.notify_on_comment();

-- Trigger: Zuständigkeit und Status ---------------------------------------------------------------

create function private.notify_on_ticket_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if new.assignee_id is not null
     and new.assignee_id is distinct from old.assignee_id
     and new.assignee_id is distinct from actor then
    insert into public.notifications (organization_id, user_id, ticket_id, type, actor_id)
    values (new.organization_id, new.assignee_id, new.id, 'assigned', actor);
  end if;

  if new.status is distinct from old.status
     and new.requester_id is not null
     and new.requester_id is distinct from actor then
    insert into public.notifications (organization_id, user_id, ticket_id, type, actor_id, detail)
    values (new.organization_id, new.requester_id, new.id, 'status', actor, new.status::text);
  end if;

  return null;
end;
$$;

create trigger tickets_notify
  after update on public.tickets
  for each row execute function private.notify_on_ticket_change();

revoke all on function private.notify_on_comment(), private.notify_on_ticket_change() from public;

-- Realtime: die Glocke aktualisiert sich sofort -------------------------------------------------------

alter publication supabase_realtime add table public.notifications;
