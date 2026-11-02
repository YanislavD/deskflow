-- DeskFlow – Antwortvorlagen
--
-- Textbausteine für häufige Antworten. Nur Agents/Admins der Firma sehen und benutzen sie
-- (Requester haben damit nichts zu tun), verwalten dürfen sie nur Admins – wie die Kategorien.

create table public.reply_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title           text not null check (length(btrim(title)) between 1 and 80),
  body            text not null check (length(btrim(body)) between 1 and 4000),
  created_at      timestamptz not null default now(),
  unique (organization_id, title)
);

alter table public.reply_templates enable row level security;
revoke all on public.reply_templates from anon;

create policy reply_templates_select on public.reply_templates
  for select to authenticated
  using (private.is_org_staff(organization_id));

create policy reply_templates_insert on public.reply_templates
  for insert to authenticated
  with check (private.is_org_admin(organization_id));

create policy reply_templates_update on public.reply_templates
  for update to authenticated
  using (private.is_org_admin(organization_id))
  with check (private.is_org_admin(organization_id));

create policy reply_templates_delete on public.reply_templates
  for delete to authenticated
  using (private.is_org_admin(organization_id));
