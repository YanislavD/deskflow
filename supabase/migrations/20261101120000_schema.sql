-- DeskFlow – Schritt 1: Tabellen und Enums
-- Alles hängt an einer Organisation (Mandant). Jede Tabelle trägt organization_id,
-- damit die RLS-Policies einfach und schnell prüfen können.

-- Enums ----------------------------------------------------------------------

create type public.member_role as enum ('admin', 'agent', 'requester');

create type public.ticket_status as enum (
  'neu', 'in_bearbeitung', 'wartet', 'geloest', 'geschlossen'
);

create type public.ticket_priority as enum ('niedrig', 'mittel', 'hoch', 'kritisch');

-- organizations --------------------------------------------------------------

create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

-- profiles (1:1 zu auth.users) -----------------------------------------------

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- memberships ----------------------------------------------------------------

create table public.memberships (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  role            public.member_role not null default 'requester',
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

-- categories -----------------------------------------------------------------

create table public.categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (length(btrim(name)) > 0),
  unique (organization_id, name),
  -- wird von tickets.(organization_id, category_id) als Ziel gebraucht
  unique (organization_id, id)
);

-- ticket_counters: Zähler für die Ticketnummer pro Organisation ---------------
-- Hat RLS ohne Policies -> kein Client kommt dran, nur der Trigger (security definer).

create table public.ticket_counters (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  last_number     integer not null default 0
);

-- tickets --------------------------------------------------------------------
-- Die zusammengesetzten Fremdschlüssel (organization_id, x) garantieren, dass
-- Requester, Assignee und Kategorie zur SELBEN Organisation gehören wie das Ticket.
-- Ohne sie könnte man ein Ticket einem Nutzer/einer Kategorie einer fremden Firma zuweisen.

create table public.tickets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  number          integer not null,
  title           text not null check (length(btrim(title)) > 0),
  description     text not null default '',
  status          public.ticket_status not null default 'neu',
  priority        public.ticket_priority not null default 'mittel',
  category_id     uuid,
  requester_id    uuid default auth.uid() references public.profiles (id) on delete set null,
  assignee_id     uuid references public.profiles (id) on delete set null,
  due_at          timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (organization_id, number),
  unique (organization_id, id),

  constraint tickets_category_fkey
    foreign key (organization_id, category_id)
    references public.categories (organization_id, id)
    on delete set null (category_id),
  constraint tickets_requester_membership_fkey
    foreign key (organization_id, requester_id)
    references public.memberships (organization_id, user_id)
    on delete set null (requester_id),
  constraint tickets_assignee_membership_fkey
    foreign key (organization_id, assignee_id)
    references public.memberships (organization_id, user_id)
    on delete set null (assignee_id)
);

create index tickets_org_status_idx on public.tickets (organization_id, status);
create index tickets_requester_idx  on public.tickets (requester_id);
create index tickets_assignee_idx   on public.tickets (assignee_id);

-- ticket_comments ------------------------------------------------------------

create table public.ticket_comments (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid not null,
  organization_id uuid not null,
  author_id       uuid default auth.uid() references public.profiles (id) on delete set null,
  body            text not null check (length(btrim(body)) > 0),
  is_internal     boolean not null default false,
  created_at      timestamptz not null default now(),

  foreign key (organization_id, ticket_id)
    references public.tickets (organization_id, id) on delete cascade
);

create index ticket_comments_ticket_idx on public.ticket_comments (ticket_id, created_at);

-- ticket_events (Verlauf, wird nur von Triggern geschrieben) -----------------

create table public.ticket_events (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid not null,
  organization_id uuid not null,
  actor_id        uuid references public.profiles (id) on delete set null,
  type            text not null check (type in ('status', 'priority', 'assignee')),
  old_value       text,
  new_value       text,
  created_at      timestamptz not null default now(),

  foreign key (organization_id, ticket_id)
    references public.tickets (organization_id, id) on delete cascade
);

create index ticket_events_ticket_idx on public.ticket_events (ticket_id, created_at);
