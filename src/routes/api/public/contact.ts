import * as React from 'react'
import { render } from 'react-email'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'AurumVault'
const SENDER_DOMAIN = 'notify.www.aurumvault.store'
const FROM_DOMAIN = 'www.aurumvault.store'
const NOTIFY_TO = 'support@aurumvault.store'

const ALLOWED_TOPICS = new Set(['support', 'creator', 'press', 'other'])

async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null
  const data = new TextEncoder().encode(ip)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const Route = createFileRoute('/api/public/contact')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        let name = ''
        let email = ''
        let topic = 'support'
        let message = ''
        let honeypot = ''
        try {
          const body = await request.json()
          name = String(body.name || '').trim().slice(0, 120)
          email = String(body.email || '').trim().toLowerCase().slice(0, 255)
          topic = String(body.topic || 'support').trim().toLowerCase().slice(0, 32)
          message = String(body.message || '').trim().slice(0, 4000)
          honeypot = String(body.company || '').trim()
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        // Honeypot: silently succeed for bots
        if (honeypot) return Response.json({ ok: true })

        if (name.length < 2) return Response.json({ error: 'Please enter your name.' }, { status: 400 })
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return Response.json({ error: 'Please enter a valid email.' }, { status: 400 })
        }
        if (message.length < 10) {
          return Response.json({ error: 'Please include a longer message (10+ characters).' }, { status: 400 })
        }
        if (!ALLOWED_TOPICS.has(topic)) topic = 'support'

        const supabase = createClient(supabaseUrl, serviceKey)

        const ip =
          request.headers.get('cf-connecting-ip') ||
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          null
        const ipHash = await hashIp(ip)
        const userAgent = (request.headers.get('user-agent') || '').slice(0, 500)

        const submittedAt = new Date().toISOString()

        const { data: inserted, error: insertError } = await supabase
          .from('contact_messages')
          .insert({
            name,
            email,
            topic,
            message,
            ip_hash: ipHash,
            user_agent: userAgent,
          })
          .select('id')
          .single()

        if (insertError || !inserted) {
          console.error('contact insert failed', { error: insertError })
          return Response.json({ error: 'Could not save your message.' }, { status: 500 })
        }

        // Render and enqueue admin notification email
        const tpl = TEMPLATES['contact-message-received']
        if (tpl) {
          try {
            const data = { name, email, topic, message, submittedAt }
            const element = React.createElement(tpl.component, data)
            const html = await render(element)
            const text = await render(element, { plainText: true })
            const subject = typeof tpl.subject === 'function' ? tpl.subject(data) : tpl.subject
            const messageId = crypto.randomUUID()

            await supabase.from('email_send_log').insert({
              message_id: messageId,
              template_name: 'contact-message-received',
              recipient_email: NOTIFY_TO,
              status: 'pending',
            })

            const { error: enqErr } = await supabase.rpc('enqueue_email', {
              queue_name: 'transactional_emails',
              payload: {
                message_id: messageId,
                to: NOTIFY_TO,
                from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
                sender_domain: SENDER_DOMAIN,
                reply_to: email,
                subject,
                html,
                text,
                purpose: 'transactional',
                label: 'contact-message-received',
                idempotency_key: `contact-${inserted.id}`,
                queued_at: submittedAt,
              },
            })

            if (enqErr) {
              console.error('contact notification enqueue failed', { error: enqErr })
            }
          } catch (err) {
            console.error('contact email render failed', { error: err })
          }
        }

        return Response.json({ ok: true, id: inserted.id })
      },
    },
  },
})
