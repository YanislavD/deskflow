-- DeskFlow – Dateianhänge zu Tickets
--
-- Zwei Teile gehören zusammen:
--   * Die Datei selbst liegt in Supabase Storage (privater Bucket "ticket-attachments").
--   * Die Tabelle ticket_attachments hält die Metadaten (Name, Typ, Größe, Pfad).
--
-- Wer eine Datei sehen/hochladen darf, ist an das TICKET gekoppelt: Agents/Admins der Firma
-- und der Anfragende des Tickets – sonst niemand. Der Bucket ist nicht öffentlich; Dateien
-- werden nur über kurzlebige, signierte Links geladen.
--
-- Pfad-Regel: <organization_id>/<ticket_id>/<uuid>.<endung>
-- Die Ordner im Pfad dürfen nicht gefälscht werden: Die Policies prüfen sie gegen die Rechte
-- des Nutzers (siehe can_attach_path).

-- Bucket ---------------------------------------------------------------------------------------
-- Die Grenzen gelten serverseitig, egal was der Browser behauptet.
-- Bewusst KEIN SVG und KEIN HTML: Solche Dateien können Skripte enthalten.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-attachments', 'ticket-attachments', false, 5242880,
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Rechte-Helfer ---------------------------------------------------------------------------------

-- Darf der angemeldete Nutzer Anhänge dieses Tickets sehen und hinzufügen?
create function private.can_attach(org uuid, ticket uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_org_staff(org)
      or (private.owns_ticket(ticket) and private.is_org_member(org));
$$;

-- Wie can_attach, aber für einen Storage-Pfad "<org>/<ticket>/<datei>". Ungültige Pfade -> false
-- (nie ein Fehler: Eine kaputte UUID würde sonst die ganze Abfrage abbrechen).
create function private.can_attach_path(path text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  parts text[] := string_to_array(path, '/');
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if array_length(parts, 1) is distinct from 3
     or parts[1] !~ uuid_re or parts[2] !~ uuid_re or parts[3] = '' then
    return false;
  end if;
  return private.can_attach(parts[1]::uuid, parts[2]::uuid);
end;
$$;

-- Darf der Nutzer die Datei an diesem Pfad löschen? (Hochlader oder Admin der Firma)
create function private.can_delete_path(path text, uploader uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  parts text[] := string_to_array(path, '/');
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if array_length(parts, 1) is distinct from 3 or parts[1] !~ uuid_re or parts[2] !~ uuid_re then
    return false;
  end if;
  return private.can_attach(parts[1]::uuid, parts[2]::uuid)
     and (uploader = (select auth.uid()) or private.is_org_admin(parts[1]::uuid));
end;
$$;

revoke all on function
  private.can_attach(uuid, uuid), private.can_attach_path(text), private.can_delete_path(text, uuid)
from public;
grant execute on function
  private.can_attach(uuid, uuid), private.can_attach_path(text), private.can_delete_path(text, uuid)
to authenticated;

-- Tabelle ---------------------------------------------------------------------------------------

create table public.ticket_attachments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  ticket_id       uuid not null,
  uploaded_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  file_name       text not null check (length(btrim(file_name)) between 1 and 200),
  mime_type       text not null,
  size_bytes      bigint not null check (size_bytes > 0 and size_bytes <= 5242880),
  storage_path    text not null unique,
  created_at      timestamptz not null default now(),

  foreign key (organization_id, ticket_id)
    references public.tickets (organization_id, id) on delete cascade,
  -- Der Pfad muss zu genau diesem Ticket gehören
  check (storage_path like organization_id::text || '/' || ticket_id::text || '/%')
);

create index ticket_attachments_ticket_idx on public.ticket_attachments (ticket_id, created_at);

alter table public.ticket_attachments enable row level security;
revoke all on public.ticket_attachments from anon;
-- Nachträglich ändern darf niemand etwas (löschen und neu hochladen)
revoke update on public.ticket_attachments from authenticated;

create policy ticket_attachments_select on public.ticket_attachments
  for select to authenticated
  using (private.can_attach(organization_id, ticket_id));

create policy ticket_attachments_insert on public.ticket_attachments
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and private.can_attach(organization_id, ticket_id)
  );

create policy ticket_attachments_delete on public.ticket_attachments
  for delete to authenticated
  using (
    private.can_attach(organization_id, ticket_id)
    and (uploaded_by = (select auth.uid()) or private.is_org_admin(organization_id))
  );

-- Storage-Policies (auf storage.objects, RLS ist dort schon eingeschaltet) --------------------------

-- Hochladen: nur in den Ordner eines Tickets, auf das man Zugriff hat
create policy ticket_attachments_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ticket-attachments' and private.can_attach_path(name));

-- Lesen (nötig für signierte Links): nur, wenn man den zugehörigen Metadaten-Eintrag sehen darf.
-- Die Unterabfrage läuft mit den Rechten des Nutzers, die RLS von ticket_attachments gilt also.
create policy ticket_attachments_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and exists (select 1 from public.ticket_attachments a where a.storage_path = name)
  );

-- Löschen: der Hochlader selbst oder ein Admin der Firma
create policy ticket_attachments_remove on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and private.can_delete_path(name, owner)
  );

-- Realtime: Anhänge erscheinen bei allen offenen Ticket-Seiten sofort
alter publication supabase_realtime add table public.ticket_attachments;
