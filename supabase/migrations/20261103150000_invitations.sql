-- DeskFlow – Einladungen
--
-- Ein Admin lädt eine Person per E-Mail-Adresse ein. Dabei entsteht ein Einladungs-Link mit
-- einem geheimen Token. Die Person registriert sich (oder meldet sich an) und nimmt die
-- Einladung an – danach ist sie Mitglied der Firma.
--
-- Sicherheit:
--   * Der Token wird nur EINMAL angezeigt. In der Datenbank steht nur sein SHA-256-Hash:
--     Wer die Tabelle liest (z. B. ein Backup), kann daraus keinen gültigen Link bauen.
--   * Der Token hat 192 Bit Zufall -> kann nicht erraten werden.
--   * Die Einladung gilt nur für die genannte E-Mail-Adresse und 7 Tage.
--   * Clients dürfen die Tabelle nicht direkt beschreiben, nur über die Funktionen unten.

create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           text not null check (email = lower(btrim(email)) and position('@' in email) > 1),
  role            public.member_role not null default 'requester',
  token_hash      text not null unique,
  invited_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '7 days',
  accepted_at     timestamptz,
  accepted_by     uuid references public.profiles (id) on delete set null
);

-- Pro Firma und E-Mail gibt es höchstens EINE offene Einladung
create unique index invitations_open_unique
  on public.invitations (organization_id, email) where accepted_at is null;

alter table public.invitations enable row level security;
revoke all on public.invitations from anon, authenticated;
grant select, delete on public.invitations to authenticated;

create policy invitations_select on public.invitations
  for select to authenticated
  using (private.is_org_admin(organization_id));

-- Löschen = Einladung zurückziehen
create policy invitations_delete on public.invitations
  for delete to authenticated
  using (private.is_org_admin(organization_id));

-- Einladung erstellen ------------------------------------------------------------------------------

create function public.create_invitation(org uuid, invite_email text, invite_role public.member_role)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_email text := lower(btrim(invite_email));
  token text;
begin
  if not private.is_org_admin(org) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if clean_email is null or position('@' in clean_email) < 2 or length(clean_email) > 254 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;

  -- Wer schon Mitglied ist, braucht keine Einladung
  if exists (
    select 1
    from public.memberships m
    join auth.users u on u.id = m.user_id
    where m.organization_id = org and lower(u.email) = clean_email
  ) then
    raise exception 'already_member' using errcode = '23505';
  end if;

  -- Eine frühere, noch offene Einladung wird ersetzt ("erneut senden")
  delete from public.invitations
  where organization_id = org and email = clean_email and accepted_at is null;

  -- URL-tauglicher Token: base64 ohne "+", "/" und "="
  token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');

  insert into public.invitations (organization_id, email, role, token_hash)
  values (org, clean_email, invite_role, encode(extensions.digest(token, 'sha256'), 'hex'));

  return token;
end;
$$;

-- Einladung annehmen --------------------------------------------------------------------------------

create function public.accept_invitation(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  user_email text;
  inv public.invitations;
begin
  if uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into inv
  from public.invitations i
  where i.token_hash = encode(extensions.digest(coalesce(invite_token, ''), 'sha256'), 'hex')
    and i.accepted_at is null
    and i.expires_at > now();

  -- Absichtlich dieselbe Meldung für "falscher Token", "abgelaufen" und "schon benutzt"
  if inv.id is null then
    raise exception 'invalid_invitation' using errcode = 'P0002';
  end if;

  select lower(u.email) into user_email from auth.users u where u.id = uid;
  if user_email is distinct from inv.email then
    raise exception 'wrong_email' using errcode = '42501';
  end if;

  insert into public.memberships (organization_id, user_id, role)
  values (inv.organization_id, uid, inv.role)
  on conflict (organization_id, user_id) do nothing;

  update public.invitations
     set accepted_at = now(), accepted_by = uid
   where id = inv.id;

  return inv.organization_id;
end;
$$;

revoke all on function
  public.create_invitation(uuid, text, public.member_role), public.accept_invitation(text)
from public, anon;
grant execute on function
  public.create_invitation(uuid, text, public.member_role), public.accept_invitation(text)
to authenticated;
