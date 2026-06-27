import * as React from 'react'
import { render } from 'react-email'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'AurumVault'
const SENDER_DOMAIN = 'notify.www.aurumvault.store'
const FROM_DOMAIN = 'www.aurumvault.store'
const SITE_URL = 'https://www.aurumvault.store'

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
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        let email = ''
        let source = 'homepage_banner'
        try {
          const body = await request.json()
          email = String(body.email || '').trim().toLowerCase()
          if (body.source && typeof body.source === 'string') source = body.source.slice(0, 64)
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
          return Response.json({ error: 'Invalid email' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, serviceKey)

        // Honor suppression list
        const { data: suppressed } = await supabase
          .from('suppressed_emails').select('id').eq('email', email).maybeSingle()
        if (suppressed) {
          return Response.json({ ok: true, status: 'suppressed' })
        }

        // Check existing subscriber
        const { data: existing } = await supabase
          .from('subscribers')
          .select('id, status, confirmation_sent_at')
          .eq('email', email)
          .maybeSingle()

        if (existing?.status === 'confirmed') {
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

        if (existing) {
          const { error } = await supabase
            .from('subscribers')
            .update({
              status: 'pending',
              confirmation_token: token,
              confirmation_sent_at: nowIso,
              source,
            })
            .eq('id', existing.id)
          if (error) {
            console.error('subscribe update failed', { error, email: redact(email) })
            return Response.json({ error: 'Could not subscribe' }, { status: 500 })
          }
        } else {
          const { error } = await supabase.from('subscribers').insert({
            email,
            source,
            status: 'pending',
            confirmation_token: token,
            confirmation_sent_at: nowIso,
          })
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
