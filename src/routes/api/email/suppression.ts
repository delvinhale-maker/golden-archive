import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { verifySvixWebhook } from '@/lib/svix-webhook.server'

type SuppressionReason = 'bounce' | 'complaint' | 'unsubscribe'

type ResendEmailEvent = {
  type: string
  created_at?: string
  data?: {
    email_id?: string
    message_id?: string
    to?: string[]
    bounce?: Record<string, unknown>
    [key: string]: unknown
  }
}

function normalizeSuppression(event: ResendEmailEvent): {
  email: string
  reason: SuppressionReason
  messageId: string | null
  metadata: Record<string, unknown>
} | null {
  const recipient = Array.isArray(event.data?.to) ? event.data?.to?.[0] : null
  if (!recipient) return null

  let reason: SuppressionReason | null = null
  if (event.type === 'email.bounced' || event.type === 'email.suppressed') {
    reason = 'bounce'
  } else if (event.type === 'email.complained') {
    reason = 'complaint'
  }
  if (!reason) return null

  return {
    email: recipient.toLowerCase(),
    reason,
    messageId:
      typeof event.data?.email_id === 'string'
        ? event.data.email_id
        : typeof event.data?.message_id === 'string'
          ? event.data.message_id
          : null,
    metadata: {
      provider: 'resend',
      event_type: event.type,
      created_at: event.created_at ?? null,
      bounce: event.data?.bounce ?? null,
    },
  }
}

function mapReasonToStatus(
  reason: SuppressionReason,
): 'bounced' | 'complained' | 'suppressed' {
  if (reason === 'bounce') return 'bounced'
  if (reason === 'complaint') return 'complained'
  return 'suppressed'
}

function mapReasonToMessage(reason: SuppressionReason): string {
  if (reason === 'bounce') {
    return 'Permanent bounce or provider suppression — recipient should not be retried'
  }
  if (reason === 'complaint') {
    return 'Spam complaint — recipient marked email as spam'
  }
  return 'Recipient unsubscribed'
}

// Compatibility route retained during migration. The implementation is fully
// independent and verifies Resend/Svix signatures; it no longer calls Lovable.
export const Route = createFileRoute("/api/email/suppression")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
        const supabaseUrl =
          import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
          console.error('Missing required email webhook environment variables')
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        const rawBody = await request.text()
        try {
          await verifySvixWebhook({
            payload: rawBody,
            id: request.headers.get('svix-id'),
            timestamp: request.headers.get('svix-timestamp'),
            signature: request.headers.get('svix-signature'),
            secret: webhookSecret,
          })
        } catch (error) {
          console.error('Invalid email webhook signature', {
            error: error instanceof Error ? error.message : String(error),
          })
          return Response.json({ error: 'Invalid signature' }, { status: 401 })
        }

        let event: ResendEmailEvent
        try {
          event = JSON.parse(rawBody) as ResendEmailEvent
        } catch {
          return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
        }

        const payload = normalizeSuppression(event)
        if (!payload) {
          return Response.json({ success: true, ignored: true })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const { error: suppressError } = await supabase
          .from('suppressed_emails')
          .upsert(
            {
              email: payload.email,
              reason: payload.reason,
              metadata: payload.metadata,
            },
            { onConflict: 'email' },
          )

        if (suppressError) {
          console.error('Failed to upsert suppressed email', {
            error: suppressError,
            email_redacted: payload.email[0] + '***@' + payload.email.split('@')[1],
          })
          return Response.json({ error: 'Failed to write suppression' }, { status: 500 })
        }

        const { error: insertError } = await supabase
          .from('email_send_log')
          .insert({
            message_id: payload.messageId,
            template_name: 'system',
            recipient_email: payload.email,
            status: mapReasonToStatus(payload.reason),
            error_message: mapReasonToMessage(payload.reason),
            metadata: payload.metadata,
          })

        if (insertError) {
          console.warn('Failed to append email_send_log suppression event', {
            error: insertError,
          })
        }

        return Response.json({ success: true })
      },
    },
  },
})
