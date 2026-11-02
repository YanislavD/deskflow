// DeskFlow – Edge Function "send-emails"
//
// Holt offene E-Mails aus der Warteschlange (public.email_outbox) und verschickt sie per SMTP.
// Aufgerufen wird sie von der Datenbank (pg_net, siehe Migration email_notifications), sobald
// eine neue E-Mail eingereiht wurde.
//
// Konfiguration über Umgebungsvariablen (lokal: supabase/functions/.env, siehe .env.example;
// in der Cloud: `supabase secrets set ...`):
//   EMAIL_WEBHOOK_SECRET  gemeinsames Geheimnis – muss auch in private.app_settings stehen
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_TLS, MAIL_FROM
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY setzt Supabase selbst.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'

const BATCH = 25

Deno.serve(async (req) => {
  // Die Funktion ist ohne JWT erreichbar (die Datenbank hat keinen Nutzer-Token). Schutz ist
  // das gemeinsame Geheimnis im Header – ohne es passiert nichts.
  const secret = Deno.env.get('EMAIL_WEBHOOK_SECRET')
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Abholen markiert die Zeilen sofort -> zwei gleichzeitige Aufrufe versenden nichts doppelt
  const { data: emails, error } = await supabase.rpc('claim_outbox_emails', { batch: BATCH })
  if (error) {
    console.error('Abholen fehlgeschlagen:', error.message)
    return Response.json({ error: 'claim_failed' }, { status: 500 })
  }
  if (!emails || emails.length === 0) return Response.json({ claimed: 0, sent: 0, failed: 0 })

  const useTls = Deno.env.get('SMTP_TLS') === 'true'
  const user = Deno.env.get('SMTP_USER')

  const transport = nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOST') ?? 'localhost',
    port: Number(Deno.env.get('SMTP_PORT') ?? 587),
    // true = von Anfang an verschlüsselt (Port 465). false = unverschlüsselt oder STARTTLS (Port 587).
    secure: useTls,
    auth: user ? { user, pass: Deno.env.get('SMTP_PASS') ?? '' } : undefined,
    // Mit Zugangsdaten MUSS die Verbindung verschlüsselt sein: Passwörter gehen nie im Klartext raus.
    // Ohne Zugangsdaten und ohne TLS (nur das lokale Mailpit) schalten wir STARTTLS ab.
    requireTLS: Boolean(user) && !useTls,
    ignoreTLS: !user && !useTls,
  })
  const from = Deno.env.get('MAIL_FROM') ?? 'DeskFlow <noreply@localhost>'

  let sent = 0
  let failed = 0
  for (const email of emails) {
    try {
      await transport.sendMail({ from, to: email.to_email, subject: email.subject, text: email.body })
      await supabase
        .from('email_outbox')
        .update({ sent_at: new Date().toISOString(), last_error: null })
        .eq('id', email.id)
      sent++
    } catch (e) {
      // Bleibt in der Warteschlange; nach 5 Versuchen (attempts) gibt claim_outbox_emails sie nicht mehr her
      failed++
      await supabase
        .from('email_outbox')
        .update({ last_error: String(e).slice(0, 500) })
        .eq('id', email.id)
    }
  }

  transport.close()

  return Response.json({ claimed: emails.length, sent, failed })
})
