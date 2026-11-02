-- DeskFlow – E-Mail-Versand: offene E-Mails sicher "abholen"
--
-- Zwei Aufrufe der Edge Function können fast gleichzeitig laufen (jede neue E-Mail weckt sie).
-- Ohne Schutz würden beide dieselben E-Mails verschicken. claim_outbox_emails markiert die
-- abgeholten Zeilen deshalb sofort (claimed_at) und gibt sie nur zurück, wenn sie noch nicht
-- abgeholt wurden – oder die letzte Abholung über 5 Minuten her ist (z. B. weil die Funktion
-- mittendrin abgestürzt ist). "for update skip locked" sorgt dafür, dass sich zwei Aufrufe
-- nicht in die Quere kommen.

alter table public.email_outbox add column claimed_at timestamptz;

create function public.claim_outbox_emails(batch integer default 25)
returns setof public.email_outbox
language sql
security definer
set search_path = ''
as $$
  update public.email_outbox o
     set attempts = o.attempts + 1,
         claimed_at = now()
   where o.id in (
     select e.id
     from public.email_outbox e
     where e.sent_at is null
       and e.attempts < 5
       and (e.claimed_at is null or e.claimed_at < now() - interval '5 minutes')
     order by e.created_at
     limit batch
     for update skip locked
   )
  returning o.*;
$$;

-- Nur der Service-Key der Edge Function darf das aufrufen, kein Client
revoke all on function public.claim_outbox_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_outbox_emails(integer) to service_role;
