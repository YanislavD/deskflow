-- DeskFlow – E-Mail-Benachrichtigungen
--
-- Ablauf:
--   1. Entsteht eine Benachrichtigung (siehe Migration "notifications"), legt ein Trigger
--      eine E-Mail in der Warteschlange public.email_outbox ab – wenn der Empfänger
--      E-Mails eingeschaltet hat (profiles.email_notifications).
--   2. Ein zweiter Trigger weckt die Edge Function "send-emails" per HTTP (pg_net).
--   3. Die Edge Function holt die offenen E-Mails ab, verschickt sie per SMTP und markiert sie.
--
-- Warum eine Warteschlange statt direkt zu senden? Fällt die Funktion oder der Mailserver
-- kurz aus, geht nichts verloren: Die E-Mail bleibt in der Tabelle und wird beim nächsten
-- Wecken erneut versucht (maximal 5 Versuche).
--
-- Datenschutz: Die E-Mails enthalten Ticketnummer, Titel und wer etwas getan hat – bewusst
-- NICHT den Text von Kommentaren, nur einen Link zur App.

create extension if not exists pg_net with schema extensions;

-- Einstellung pro Nutzer ---------------------------------------------------------------------------

alter table public.profiles add column email_notifications boolean not null default true;

-- Interne Einstellungen (Adresse der Funktion usw.) -------------------------------------------------
-- Liegt im Schema "private" und ist für Clients gesperrt. Gefüllt wird sie einmal pro Umgebung:
-- lokal von supabase/seed.sql, in der Cloud per SQL im Dashboard (siehe README).

create table private.app_settings (
  key   text primary key,
  value text not null
);
revoke all on private.app_settings from public, anon, authenticated;

-- Warteschlange ----------------------------------------------------------------------------------------

create table public.email_outbox (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete cascade,
  to_email   text not null,
  subject    text not null,
  body       text not null,
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  attempts   integer not null default 0,
  last_error text
);

create index email_outbox_unsent_idx on public.email_outbox (created_at) where sent_at is null;

-- RLS ohne Policies + keine Rechte: Nur der Service-Key der Edge Function und die Trigger
-- (security definer) kommen an diese Tabelle.
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;

-- Trigger 1: Benachrichtigung -> E-Mail in die Warteschlange --------------------------------------------

create function private.queue_notification_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient record;
  ticket record;
  actor_name text;
  app_url text;
  subject text;
  action text;
begin
  select u.email, p.email_notifications into recipient
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.id = new.user_id;

  if recipient.email is null or not recipient.email_notifications then
    return null;
  end if;

  select t.number, t.title into ticket from public.tickets t where t.id = new.ticket_id;
  select coalesce(p.full_name, 'Jemand') into actor_name
  from public.profiles p where p.id = new.actor_id;
  actor_name := coalesce(actor_name, 'Jemand');

  select value into app_url from private.app_settings where key = 'app_url';
  app_url := coalesce(app_url, '');

  if new.type = 'comment' then
    subject := 'Neuer Kommentar zu Ticket #' || ticket.number;
    action := actor_name || ' hat das Ticket kommentiert.';
  elsif new.type = 'assigned' then
    subject := 'Dir wurde Ticket #' || ticket.number || ' zugewiesen';
    action := actor_name || ' hat dir das Ticket zugewiesen.';
  else
    subject := 'Ticket #' || ticket.number || ': Status geändert';
    action := 'Der Status des Tickets wurde geändert.';
  end if;

  insert into public.email_outbox (user_id, to_email, subject, body)
  values (
    new.user_id,
    recipient.email,
    subject,
    'Ticket #' || ticket.number || ' – ' || ticket.title || E'\n\n' || action || E'\n\n'
      || 'Ticket öffnen: ' || app_url || '/tickets/' || new.ticket_id || E'\n\n'
      || E'--\n'
      || 'Du erhältst diese E-Mail, weil E-Mail-Benachrichtigungen in deinem Profil eingeschaltet sind.' || E'\n'
      || 'Ausschalten: ' || app_url || '/profile'
  );

  return null;
end;
$$;

create trigger notifications_queue_email
  after insert on public.notifications
  for each row execute function private.queue_notification_email();

-- Trigger 2: Die Edge Function wecken ----------------------------------------------------------------------
-- Ist nichts konfiguriert (z. B. in den Tests), passiert hier gar nichts – die E-Mails bleiben
-- einfach in der Warteschlange liegen. pg_net sendet die Anfrage asynchron nach dem Commit,
-- das Anlegen einer Benachrichtigung wird also nie durch einen langsamen Mailserver ausgebremst.

create function private.wake_email_sender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_url text;
  sender_secret text;
begin
  select value into sender_url from private.app_settings where key = 'email_sender_url';
  select value into sender_secret from private.app_settings where key = 'email_sender_secret';

  if sender_url is not null and sender_secret is not null then
    perform net.http_post(
      url := sender_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', sender_secret),
      body := '{}'::jsonb
    );
  end if;

  return null;
end;
$$;

-- "for each statement": Ein INSERT mit vielen Zeilen weckt die Funktion nur einmal
create trigger email_outbox_wake_sender
  after insert on public.email_outbox
  for each statement execute function private.wake_email_sender();

revoke all on function private.queue_notification_email(), private.wake_email_sender() from public;
