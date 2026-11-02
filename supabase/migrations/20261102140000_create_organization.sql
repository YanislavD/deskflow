-- DeskFlow – Firma anlegen (Onboarding)
--
-- Ein frisch registrierter Nutzer hat noch keine Firma. Die RLS-Policies erlauben Clients
-- bewusst kein INSERT auf organizations/memberships (sonst könnte sich jeder zum Admin
-- einer beliebigen Firma machen). Deshalb gibt es genau diese eine Funktion:
-- Sie legt Firma, Admin-Mitgliedschaft und Standard-Kategorien in einem Schritt an.
--
-- Schutz vor Missbrauch: Nur Nutzer OHNE bestehende Mitgliedschaft dürfen eine Firma
-- gründen. So kann niemand unbegrenzt Firmen erzeugen.

create function public.create_organization(org_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  clean_name text := btrim(org_name);
  base_slug text;
  final_slug text;
  new_org uuid;
begin
  if uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if clean_name is null or length(clean_name) < 2 or length(clean_name) > 80 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;

  if exists (select 1 from public.memberships m where m.user_id = uid) then
    raise exception 'already_in_organization' using errcode = 'P0001';
  end if;

  -- "Müller & Partner GmbH" -> "mueller-partner-gmbh"
  base_slug := lower(clean_name);
  base_slug := replace(replace(replace(replace(base_slug, 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss');
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := btrim(base_slug, '-');
  if base_slug = '' then
    base_slug := 'firma';
  end if;

  final_slug := base_slug;
  if exists (select 1 from public.organizations o where o.slug = final_slug) then
    final_slug := base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end if;

  insert into public.organizations (name, slug)
  values (clean_name, final_slug)
  returning id into new_org;

  insert into public.memberships (organization_id, user_id, role)
  values (new_org, uid, 'admin');

  insert into public.categories (organization_id, name)
  values
    (new_org, 'Hardware'),
    (new_org, 'Software'),
    (new_org, 'Netzwerk & VPN'),
    (new_org, 'Zugänge & Konten'),
    (new_org, 'Sonstiges');

  return new_org;
end;
$$;

revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;
