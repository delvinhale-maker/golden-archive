import { createFileRoute } from '@tanstack/react-router'
import { enqueueInsiderEmail, insiderAdminClient } from '@/lib/insider-email.server'

/**
 * Confirms a double opt-in subscription and sends exactly one Insider welcome
 * email. Idempotent: the welcome is guarded by `welcome_sent_at` plus a stable
 * idempotency key, so retries never duplicate mail.
 */
export const Route = createFileRoute('/api/public/subscribers/confirm')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let token = ''
        try {
          const body = await request.json()
          token = String(body.token || '')
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 })
        }
        if (token.length < 16) {
          return Response.json({ ok: false, reason: 'invalid_token' }, { status: 400 })
        }

        let supabase
        try {
          supabase = insiderAdminClient()
        } catch {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        const { data: confirmResult, error } = await supabase.rpc('confirm_subscriber', {
          _token: token,
        })
        const payload = (confirmResult ?? {}) as {
          ok?: boolean
          already?: boolean
          email?: string
        }
        if (error || !payload.ok) {
          return Response.json({ ok: false, reason: 'invalid_or_expired' }, { status: 200 })
        }
        if (payload.already || !payload.email) {
          return Response.json({ ok: true, already: true })
        }

        const email = payload.email.toLowerCase()
        const { data: sub } = await supabase
          .from('subscribers')
          .select('id, first_name, audience_type, welcome_sent_at')
          .eq('email', email)
          .maybeSingle()

        let welcomeQueued = false
        if (sub && !sub.welcome_sent_at) {
          const res = await enqueueInsiderEmail(supabase, {
            templateName: 'insider-welcome',
            to: email,
            props: {
              firstName: sub.first_name,
              audienceType: sub.audience_type ?? 'GENERAL',
            },
            idempotencyKey: `insider-welcome-${sub.id}`,
          })
          if (res.ok) {
            welcomeQueued = true
            await supabase
              .from('subscribers')
              .update({ welcome_sent_at: new Date().toISOString() })
              .eq('id', sub.id)
          }
        }

        return Response.json({ ok: true, already: false, email, welcomeQueued })
      },
    },
  },
})
