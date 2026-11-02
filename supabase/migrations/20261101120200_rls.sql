-- DeskFlow – Schritt 1: Row Level Security
--
-- Regeln:
--   * Man sieht nur Daten von Organisationen, in denen man eine Membership hat.
--   * requester: nur eigene Tickets, nur Kommentare mit is_internal = false.
--   * agent/admin: alle Tickets der Organisation sehen und bearbeiten.
--   * Nur admin verwaltet memberships und categories.
--
-- Warum Helper-Funktionen mit security definer?
-- Eine Policy auf "memberships", die selbst "memberships" abfragt, würde wieder
-- die Policy auslösen -> Endlosrekursion. Eine security-definer-Funktion läuft mit
-- den Rechten ihres Besitzers (umgeht RLS) und unterbricht diese Schleife.
-- Wichtig dabei: search_path leer lassen und alles mit Schema-Namen schreiben.

grant usage on schema private to authenticated;

create function private.is_org_member(org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org and m.user_id = (select auth.uid())
  );
$$;

create function private.is_org_staff(org uuid)  -- admin oder agent
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org
      and m.user_id = (select auth.uid())
      and m.role in ('admin', 'agent')
  );
$$;

create function private.is_org_admin(org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org
      and m.user_id = (select auth.uid())
      and m.role = 'admin'
  );
$$;

-- Ist der angemeldete Nutzer der Requester dieses Tickets?
create function private.owns_ticket(ticket uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tickets t
    where t.id = ticket and t.requester_id = (select auth.uid())
  );
$$;

-- Profile sehen: sich selbst; Staff sieht alle der eigenen Organisationen;
-- Requester sieht nur das Staff-Team seiner Organisationen (nicht andere Requester).
create function private.can_see_profile(target uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select target = (select auth.uid())
    or exists (
      select 1
      from public.memberships me
      join public.memberships other on other.organization_id = me.organization_id
      where me.user_id = (select auth.uid())
        and other.user_id = target
        and (me.role in ('admin', 'agent') or other.role in ('admin', 'agent'))
    );
$$;

revoke all on function
  private.is_org_member(uuid), private.is_org_staff(uuid), private.is_org_admin(uuid),
  private.owns_ticket(uuid), private.can_see_profile(uuid)
from public;
grant execute on function
  private.is_org_member(uuid), private.is_org_staff(uuid), private.is_org_admin(uuid),
  private.owns_ticket(uuid), private.can_see_profile(uuid)
to authenticated;

-- RLS einschalten (auf ALLEN Tabellen) ---------------------------------------

alter table public.organizations    enable row level security;
alter table public.profiles         enable row level security;
alter table public.memberships      enable row level security;
alter table public.categories       enable row level security;
alter table public.ticket_counters  enable row level security;
alter table public.tickets          enable row level security;
alter table public.ticket_comments  enable row level security;
alter table public.ticket_events    enable row level security;

-- Nicht angemeldete Nutzer (anon) brauchen gar nichts; der Zähler ist nur für den Trigger.
revoke all on
  public.organizations, public.profiles, public.memberships, public.categories,
  public.ticket_counters, public.tickets, public.ticket_comments, public.ticket_events
from anon;
revoke all on public.ticket_counters from authenticated;

-- organizations --------------------------------------------------------------
-- Kein INSERT/DELETE für Clients: Firmen legt vorerst nur das Backend/SQL an.

create policy organizations_select on public.organizations
  for select to authenticated
  using (private.is_org_member(id));

create policy organizations_update on public.organizations
  for update to authenticated
  using (private.is_org_admin(id))
  with check (private.is_org_admin(id));

-- profiles -------------------------------------------------------------------
-- Kein INSERT (macht der Trigger) und kein DELETE (läuft über auth.users).

create policy profiles_select on public.profiles
  for select to authenticated
  using (private.can_see_profile(id));

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- memberships ----------------------------------------------------------------

create policy memberships_select on public.memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_org_staff(organization_id));

create policy memberships_insert on public.memberships
  for insert to authenticated
  with check (private.is_org_admin(organization_id));

create policy memberships_update on public.memberships
  for update to authenticated
  using (private.is_org_admin(organization_id))
  with check (private.is_org_admin(organization_id));

create policy memberships_delete on public.memberships
  for delete to authenticated
  using (private.is_org_admin(organization_id));

-- categories -----------------------------------------------------------------

create policy categories_select on public.categories
  for select to authenticated
  using (private.is_org_member(organization_id));

create policy categories_insert on public.categories
  for insert to authenticated
  with check (private.is_org_admin(organization_id));

create policy categories_update on public.categories
  for update to authenticated
  using (private.is_org_admin(organization_id))
  with check (private.is_org_admin(organization_id));

create policy categories_delete on public.categories
  for delete to authenticated
  using (private.is_org_admin(organization_id));

-- tickets --------------------------------------------------------------------
-- Requester dürfen Tickets nur für sich selbst anlegen, immer als "neu" und ohne
-- Assignee. Ändern: Staff. Löschen: nur Admin.

create policy tickets_select on public.tickets
  for select to authenticated
  using (
    private.is_org_staff(organization_id)
    or (requester_id = (select auth.uid()) and private.is_org_member(organization_id))
  );

create policy tickets_insert on public.tickets
  for insert to authenticated
  with check (
    private.is_org_staff(organization_id)
    or (
      private.is_org_member(organization_id)
      and requester_id = (select auth.uid())
      and status = 'neu'
      and assignee_id is null
    )
  );

create policy tickets_update on public.tickets
  for update to authenticated
  using (private.is_org_staff(organization_id))
  with check (private.is_org_staff(organization_id));

create policy tickets_delete on public.tickets
  for delete to authenticated
  using (private.is_org_admin(organization_id));

-- ticket_comments ------------------------------------------------------------
-- Dass organization_id zum Ticket passt, erzwingt der zusammengesetzte Fremdschlüssel.

create policy ticket_comments_select on public.ticket_comments
  for select to authenticated
  using (
    private.is_org_staff(organization_id)
    or (
      not is_internal
      and private.owns_ticket(ticket_id)
      and private.is_org_member(organization_id)
    )
  );

create policy ticket_comments_insert on public.ticket_comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (
      private.is_org_staff(organization_id)
      or (
        not is_internal
        and private.owns_ticket(ticket_id)
        and private.is_org_member(organization_id)
      )
    )
  );

create policy ticket_comments_update on public.ticket_comments
  for update to authenticated
  using (
    private.is_org_staff(organization_id)
    and (author_id = (select auth.uid()) or private.is_org_admin(organization_id))
  )
  with check (
    private.is_org_staff(organization_id)
    and (author_id = (select auth.uid()) or private.is_org_admin(organization_id))
  );

create policy ticket_comments_delete on public.ticket_comments
  for delete to authenticated
  using (
    private.is_org_staff(organization_id)
    and (author_id = (select auth.uid()) or private.is_org_admin(organization_id))
  );

-- ticket_events --------------------------------------------------------------
-- Nur lesen. Geschrieben wird ausschließlich vom Trigger -> Verlauf ist manipulationssicher.
-- Requester sehen nur Status-Änderungen ihrer eigenen Tickets (Priorität/Zuweisung sind intern).

create policy ticket_events_select on public.ticket_events
  for select to authenticated
  using (
    private.is_org_staff(organization_id)
    or (
      type = 'status'
      and private.owns_ticket(ticket_id)
      and private.is_org_member(organization_id)
    )
  );
