import * as React from 'react'
import { render } from 'react-email'
import { createFileRoute } from '@tanstack/react-router'
import { TEMPLATES } from '@/lib/email-templates/registry'
import { audienceForSource, isValidAudience, isValidEmail, CONSENT_VERSION } from '@/lib/insider'
import {
  insiderAdminClient,
  SITE_NAME,
  SENDER_DOMAIN,
  FROM_DOMAIN,
  SITE_URL,
} from '@/lib/insider-email.server'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function redact(email: string): string {
  const [l, d] = email.split('@')
  return l && d ? `${l[0]}***@${d}` : '***'
}

export const Route = createFileRoute('/api/public/subscribers/subscribe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let email = ''
        let source = 'homepage_banner'
        let firstName: string | null = null
        let audienceType: string | null = null
        let topicInterest: string | null = null
        try {
          const body = await request.json()
          email = String(body.email || '').trim().toLowerCase()
          if (body.source && typeof body.source === 'string') source = body.source.slice(0, 64)
          if (body.first_name && typeof body.first_name === 'string') {
            firstName = body.first_name.trim().slice(0, 60) || null
          }
          if (isValidAudience(body.audience_type)) audienceType = body.audience_type
          if (body.topic_interest && typeof body.topic_interest === 'string') {
            topicInterest = body.topic_interest.slice(0, 120)
          }
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        if (!isValidEmail(email)) {
          return Response.json({ error: 'Invalid email' }, { status: 400 })
        }

        const audience = audienceType ?? audienceForSource(source)

        let supabase
        try {
          supabase = insiderAdminClient()
        } catch {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        // Existing subscriber (checked first so an intentional resubscribe can
        // clear a prior marketing opt-out).
        const { data: existing } = await supabase
          .from('subscribers')
          .select('id, status, confirmation_sent_at')
          .eq('email', email)
          .maybeSingle()

        // Honor the suppression list, except for an intentional resubscribe of
        // an address that had only unsubscribed (bounces/complaints stay blocked).
        const { data: suppressed } = await supabase
          .from('suppressed_emails')
          .select('id, reason')
          .eq('email', email)
          .maybeSingle()
        if (suppressed) {
          if (suppressed.reason !== 'unsubscribe') {
            return Response.json({ ok: true, status: 'suppressed' })
          }
          await supabase.from('suppressed_emails').delete().eq('id', suppressed.id)
          await supabase
            .from('email_unsubscribe_tokens')
            .update({ used_at: null })
            .eq('email', email)
        }

        if (existing?.status === 'confirmed') {
          // Keep segmentation/consent metadata fresh without duplicating rows.
          await supabase
            .from('subscribers')
            .update({
              unsubscribed_at: null,
              ...(firstName ? { first_name: firstName } : {}),
              ...(topicInterest ? { topic_interest: topicInterest } : {}),
            })
            .eq('id', existing.id)
          return Response.json({ ok: true, status: 'already_confirmed' })
        }

        // Throttle re-sends to once per 60s
        if (existing?.confirmation_sent_at) {
          const last = new Date(existing.confirmation_sent_at).getTime()
          if (Date.now() - last < 60_000) {
            return Response.json({ ok: true, status: 'pending', throttled: true })
          }
        }

        const token = generateToken()
        const nowIso = new Date().toISOString()

        const record = {
          status: 'pending',
          confirmation_token: token,
          confirmation_sent_at: nowIso,
          source,
          audience_type: audience,
          consent_source: source,
          consent_version: CONSENT_VERSION,
          unsubscribed_at: null,
          ...(firstName ? { first_name: firstName } : {}),
          ...(topicInterest ? { topic_interest: topicInterest } : {}),
        }

        if (existing) {
          const { error } = await supabase.from('subscribers').update(record).eq('id', existing.id)
          if (error) {
            console.error('subscribe update failed', { error, email: redact(email) })
            return Response.json({ error: 'Could not subscribe' }, { status: 500 })
          }
        } else {
          const { error } = await supabase.from('subscribers').insert({ email, ...record })
          if (error) {
            console.error('subscribe insert failed', { error, email: redact(email) })
            return Response.json({ error: 'Could not subscribe' }, { status: 500 })
          }
        }

        // Render and enqueue confirmation email
        const tpl = TEMPLATES['subscriber-confirmation']
        if (!tpl) return Response.json({ error: 'Template missing' }, { status: 500 })

        const confirmUrl = `${SITE_URL}/subscribe/confirm?token=${encodeURIComponent(token)}`
        const element = React.createElement(tpl.component, { confirmUrl })
        const html = await render(element)
        const text = await render(element, { plainText: true })
        const subject = typeof tpl.subject === 'function' ? tpl.subject({ confirmUrl }) : tpl.subject
        const messageId = crypto.randomUUID()

        await supabase.from('email_send_log').insert({
          message_id: messageId,
          template_name: 'subscriber-confirmation',
          recipient_email: email,
          status: 'pending',
        })

        const { error: enqErr } = await supabase.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: {
            message_id: messageId,
            to: email,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject,
            html,
            text,
            purpose: 'transactional',
            label: 'subscriber-confirmation',
            idempotency_key: `subscribe-confirm-${token}`,
            queued_at: nowIso,
          },
        })

        if (enqErr) {
          console.error('subscribe enqueue failed', { error: enqErr, email: redact(email) })
          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: 'subscriber-confirmation',
            recipient_email: email,
            status: 'failed',
            error_message: 'enqueue failed',
          })
          return Response.json({ error: 'Could not send confirmation' }, { status: 500 })
        }

        return Response.json({ ok: true, status: 'pending' })
      },
    },
  },
})
