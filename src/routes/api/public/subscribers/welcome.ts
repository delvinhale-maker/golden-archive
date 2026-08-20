import { createFileRoute } from '@tanstack/react-router'
import { sendSubscriberWelcomeEmail } from '@/lib/subscriber-welcome-email.server'

// Called by the confirm-subscription page right after a subscriber confirms
// their address, to send the first welcome email. Looks up the subscriber
// server-side and only sends when their status is actually 'confirmed', so
// this can't be used to spam arbitrary addresses. Best-effort: a failure
// here must not block the confirmation flow the user already completed.
export const Route = createFileRoute('/api/public/subscribers/welcome')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let email = ''
        try {
          const body = await request.json()
          email = String(body.email || '').trim().toLowerCase()
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
          return Response.json({ error: 'Invalid email' }, { status: 400 })
        }

        const result = await sendSubscriberWelcomeEmail(email)
        return Response.json({ ok: true, sent: result.sent })
      },
    },
  },
})
