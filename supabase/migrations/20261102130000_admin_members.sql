-- DeskFlow – Verwaltung von Mitgliedern
--
-- 1) add_member_by_email: Ein Admin fügt einen bereits registrierten Nutzer anhand
--    der E-Mail zur Firma hinzu. Das Frontend darf auth.users nicht lesen (dort stehen
--    die E-Mails), deshalb macht das diese Funktion mit security definer – nachdem
--    sie selbst geprüft hat, dass der Aufrufer Admin der Firma ist.
-- 2) keep_one_admin: Eine Firma darf nie ohne Admin dastehen.

-- 1) Mitglied per E-Mail hinzufügen --------------------------------------------

create function public.add_member_by_email(
  org uuid,
  member_email text,
  member_role public.member_role
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  new_id uuid;
begin
  if not private.is_org_admin(org) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select u.id into target
  from auth.users u
  where lower(u.email) = lower(btrim(member_email));

  if target is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  begin
    insert into public.memberships (organization_id, user_id, role)
    values (org, target, member_role)
    returning id into new_id;
  exception when unique_violation then
    raise exception 'already_member' using errcode = '23505';
  end;

  return new_id;
end;
$$;

-- Nur angemeldete Nutzer dürfen die Funktion aufrufen (und sie prüft zusätzlich selbst).
revoke all on function public.add_member_by_email(uuid, text, public.member_role) from public, anon;
grant execute on function public.add_member_by_email(uuid, text, public.member_role) to authenticated;

-- 2) Den letzten Admin schützen -------------------------------------------------
-- Greift beim Degradieren, Entfernen oder Verschieben des letzten Admins.
-- Wird die ganze Firma gelöscht, ist die Zeile in organizations schon weg
-- -> die Prüfung "exists organizations" ist dann falsch und das Löschen läuft durch.

create function private.keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin' or new.organization_id <> old.organization_id)
     and exists (select 1 from public.organizations o where o.id = old.organization_id)
     and not exists (
       select 1 from public.memberships m
       where m.organization_id = old.organization_id and m.role = 'admin' and m.id <> old.id
     )
  then
    raise exception 'last_admin' using errcode = 'P0001';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger memberships_keep_one_admin
  before update or delete on public.memberships
  for each row execute function private.keep_one_admin();

revoke all on function private.keep_one_admin() from public;
