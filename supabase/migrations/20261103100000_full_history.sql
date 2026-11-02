-- DeskFlow – Vollständiger Verlauf
--
-- Bisher wurden nur Status, Priorität und Zuständiger protokolliert. Jetzt auch Titel,
-- Beschreibung, Kategorie und Fälligkeit. Bei der Beschreibung speichern wir bewusst
-- keinen Text (er kann lang sein), nur DASS sie geändert wurde.
--
-- Sichtbarkeit unverändert: Agents/Admins sehen alles, Requester nur Status-Ereignisse
-- (siehe Policy ticket_events_select).

alter table public.ticket_events drop constraint ticket_events_type_check;
alter table public.ticket_events add constraint ticket_events_type_check
  check (type in ('status', 'priority', 'assignee', 'title', 'description', 'category', 'due_at'));

create or replace function private.log_ticket_changes()
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

  if new.title is distinct from old.title then
    insert into public.ticket_events (ticket_id, organization_id, actor_id, type, old_value, new_value)
    values (new.id, new.organization_id, actor, 'title', old.title, new.title);
  end if;

  if new.description is distinct from old.description then
    insert into public.ticket_events (ticket_id, organization_id, actor_id, type)
    values (new.id, new.organization_id, actor, 'description');
  end if;

  if new.category_id is distinct from old.category_id then
    insert into public.ticket_events (ticket_id, organization_id, actor_id, type, old_value, new_value)
    values (new.id, new.organization_id, actor, 'category', old.category_id::text, new.category_id::text);
  end if;

  if new.due_at is distinct from old.due_at then
    insert into public.ticket_events (ticket_id, organization_id, actor_id, type, old_value, new_value)
    values (new.id, new.organization_id, actor, 'due_at', old.due_at::text, new.due_at::text);
  end if;

  return null; -- AFTER-Trigger: Rückgabewert wird ignoriert
end;
$$;
