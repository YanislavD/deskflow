-- DeskFlow – Schritt 1: Trigger
-- Alle Trigger-Funktionen liegen im Schema "private". Das Schema "public" wird von
-- Supabase als API (PostgREST) freigegeben, "private" nicht -> Funktionen dort
-- kann kein Client per RPC aufrufen.

create schema if not exists private;

-- 1) Profil beim Registrieren anlegen ----------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- 2) Fortlaufende Ticketnummer pro Organisation ------------------------------
-- INSERT ... ON CONFLICT DO UPDATE sperrt die Zählerzeile der Organisation.
-- Zwei gleichzeitige Inserts derselben Firma laufen deshalb nacheinander und
-- bekommen nie dieselbe Nummer. Bei einem Rollback wird auch der Zähler zurückgesetzt.
-- Eine vom Client mitgeschickte Nummer wird bewusst überschrieben.

create function private.assign_ticket_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ticket_counters as c (organization_id, last_number)
  values (new.organization_id, 1)
  on conflict (organization_id)
  do update set last_number = c.last_number + 1
  returning c.last_number into new.number;

  return new;
end;
$$;

create trigger tickets_assign_number
  before insert on public.tickets
  for each row execute function private.assign_ticket_number();

-- 3) Schutz beim Update + updated_at -----------------------------------------

create function private.tickets_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.number is distinct from old.number then
    raise exception 'id, organization_id und number eines Tickets sind unveränderlich'
      using errcode = '42501';
  end if;

  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger tickets_before_update
  before update on public.tickets
  for each row execute function private.tickets_before_update();

-- 4) Verlauf: Änderungen an status, priority, assignee protokollieren ---------
-- security definer, weil Clients keine INSERT-Policy auf ticket_events haben.
-- auth.uid() liest weiterhin die JWT-Claims der aktuellen Anfrage (actor_id).
-- Bei Änderungen per SQL/Service-Key ist auth.uid() null -> actor_id null.

create function private.log_ticket_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if new.status is distinct from old.status then
    insert into public.ticket_events (ticket_id, organization_id, actor_id, type, old_value, new_value)
    values (new.id, new.organization_id, actor, 'status', old.status::text, new.status::text);
  end if;

  if new.priority is distinct from old.priority then
    insert into public.ticket_events (ticket_id, organization_id, actor_id, type, old_value, new_value)
    values (new.id, new.organization_id, actor, 'priority', old.priority::text, new.priority::text);
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into public.ticket_events (ticket_id, organization_id, actor_id, type, old_value, new_value)
    values (new.id, new.organization_id, actor, 'assignee', old.assignee_id::text, new.assignee_id::text);
  end if;

  return null; -- AFTER-Trigger: Rückgabewert wird ignoriert
end;
$$;

create trigger tickets_log_changes
  after update on public.tickets
  for each row execute function private.log_ticket_changes();

-- Trigger-Funktionen muss niemand direkt aufrufen
revoke all on function
  private.handle_new_user(),
  private.assign_ticket_number(),
  private.tickets_before_update(),
  private.log_ticket_changes()
from public;
