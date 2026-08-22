# Creator Starter Pack — Audit + Build Plan

## Part 0 — Audit of what already exists

**Stack**: React 19 + TanStack Start (file routes in `src/routes`), Vite, Tailwind v4, Lovable Cloud backend (Postgres + auth + storage). Server logic uses `createServerFn`; external callers use `src/routes/api/public/*`.

**Auth / roles**: Supabase auth; `user_roles` + `has_role(_user_id, _role)` security-definer function. Protected pages live under `src/routes/_authenticated/`. Bearer attach already registered in `src/start.ts`.

**Lead capture already shipped**: `creator_leads` (email, product_type, follower_count, cta_source, created_at) with insert-only anon policy, plus per-IP rate limiting via `check_creator_lead_rate_limit`, honeypot and minimum-fill-time checks in `src/lib/creator-leads.functions.ts`. Landing pages `/sell-with-us` and `/creator-earnings` already feed it.

**Email infrastructure (reuse, do not replace)**: internal queue — `enqueue_email` RPC → `transactional_emails` queue → `/lovable/email/queue/process` — with `email_send_log` (message_id/status/error), `suppressed_emails`, `email_unsubscribe_tokens` (one-click unsubscribe at `/email/unsubscribe`), `email_send_state` throttling, and a suppression webhook at `/lovable/email/suppression`. React Email templates live in `src/lib/email-templates/` and are registered in `registry.ts`. Sending domain `notify.www.aurumvault.store`. **No second provider (no Resend) will be added.**

**Scheduling**: `pg_cron` + `net.http_post` hitting `/api/public/cron/*`, authenticated with the publishable key in the `apikey` header (see `subscriber-sequence`, `release-preorders`). The nurture drip will reuse this exact pattern.

**Analytics**: `cta_click_events` (session_id, cta_location, page_path) + `logCtaClick()` in `src/lib/cta-tracking.ts`; admin funnel view at `/admin/lead-analytics` built on `src/lib/lead-analytics.ts`.

**Creator application (unchanged)**: `seller_applications` + `/sell` review flow, statuses `pending/approved/rejected/under_review/info_requested`. No new status model, no new creator table.

**Existing Starter Kit asset**: static PDF `public/downloads/AurumVault-Creator-Starter-Kit.pdf` referenced by `src/lib/starter-kit.ts`.

### Reuse vs. add

Reuse: email queue + logging + suppression + unsubscribe, cron pattern, `cta_click_events` analytics, `has_role` admin gate, `seller_applications`, `creator_leads` table, rate-limit RPC, existing legal pages.

Add (minimum): new columns on `creator_leads` for name, normalized email uniqueness, consent, UTM attribution and send bookkeeping; one nurture-schedule column set; new landing/thank-you routes; new email templates; one cron endpoint; one admin panel.

## Part 1 — Database migration (additive, reversible)

Extend `creator_leads` rather than creating a parallel table:

- `first_name text`, `normalized_email text` (generated/lowercased, unique index), `acquisition_type text default 'CREATOR_STARTER_PACK'`
- `marketing_consent boolean default false`, `consent_at timestamptz`, `consent_source text`
- `utm_source/medium/campaign/content/term text`, `referring_url text`, `landing_page text`
- `starter_pack_requested_at`, `starter_pack_last_sent_at`, `starter_pack_send_count integer default 0`, `last_send_status text`
- `nurture_step2_sent_at … nurture_step5_sent_at timestamptz`
- `seller_application_id uuid references seller_applications(id)`, `converted_to_creator_at timestamptz`
- `lead_status text default 'NEW'` (NEW / STARTER_PACK_SENT / ENGAGED / APPLICATION_SUBMITTED / CREATOR_ACTIVE) — descriptive mirror only; creator approval stays governed by `seller_applications`.

RLS: keep insert-only for anon, no anon SELECT/UPDATE/DELETE (no enumeration). Admin reads go through service-role server functions behind `has_role`. GRANTs included in the same migration.

A trigger links a new `seller_applications` row back to a matching lead by normalized email and stamps `converted_to_creator_at` on approval.

## Part 2 — Starter Pack file

The uploaded `AurumVault_Digital_Creator_Starter_Pack.pdf` is published as a stable public asset (CDN pointer + `/downloads` path) — evergreen link, no expiring signed URL, not attached to emails. Documented in `src/lib/starter-kit.ts`.

## Part 3 — Landing page `/creator-starter-pack`

Luxury vault aesthetic on existing tokens (deep navy/near-black, AurumVault gold, cream, serif headings). Headline "Build Something Worth Selling", Starter Pack mockup, the 8 benefit bullets, first name + email fields, unchecked marketing-consent checkbox, privacy/terms links, primary CTA "Send Me the Free Starter Pack", secondary CTA to the existing `/sell` application. UTM/referrer/landing page captured silently from the URL. Mobile-first: 44px touch targets, `inputMode="email"`, visible labels, loading/success/duplicate states, no horizontal scroll at 375px.

Thank-you route `/creator-starter-pack/thank-you` with inbox confirmation, direct download fallback, and the creator-application invite.

## Part 4 — Server functions

New `src/lib/starter-pack.functions.ts` (public, no auth): zod validation, email normalization, honeypot + min-fill-time, per-IP rate limit via the existing RPC, upsert on `normalized_email` (attribution filled only when previously empty), consent recorded with timestamp + source, then queue the transactional email. Resend path is rate-limited and increments `starter_pack_send_count`. No recipient/template injection: the recipient is always the stored lead email and the template name is fixed.

## Part 5 — Emails

- New `creator-starter-pack-delivery` template — subject "Your AurumVault Creator Starter Pack Is Ready", download CTA, creator invitation, transactional footer (no false subscription claim).
- Four nurture templates (day 2 / 4 / 7 / 10) matching the requested topics, marketing footer with unsubscribe link.
- Delivery state is read from `email_send_log` (requested → queued → provider accepted → delivered/bounced/complained/failed) via the existing suppression/status webhook; success is never inferred from an HTTP 200.

## Part 6 — Cron + nurture

New `/api/public/cron/starter-pack-nurture` (publishable-key auth, mirroring the existing cron routes) sends only the due step, only for leads with `marketing_consent = true`, skipping suppressed/unsubscribed addresses. Idempotent per step column, batch-capped, no runaway retries. Scheduled every 6 hours with `pg_cron`.

## Part 7 — Admin view

`/admin/creator-acquisition` (admin-gated): signups, unique leads, opt-in rate, delivery rate, download-click and application-click rates, application/approval conversion, top sources and campaigns, recent failures, per-lead detail with funnel events and a manual retry button.

## Part 8 — Analytics events

`logCtaClick` calls for: viewed, form_started, submitted, email_queued, download_clicked, application_clicked. No email addresses in analytics rows.

## Part 9 — Tests

Vitest unit tests for the validator/normalizer/consent defaults and nurture due-step selection; integration tests for duplicate-lead idempotency, anon lead read denial and recipient-injection rejection; Playwright checks at 390px / tablet / desktop for the form flow. I will report only the tests that actually ran, and label everything else source-reviewed or unverified.

## Guardrails

No changes to payments, marketplace economics, existing newsletter signup, existing creator application, or existing templates. No RLS weakening. All schema changes additive and reversible.
