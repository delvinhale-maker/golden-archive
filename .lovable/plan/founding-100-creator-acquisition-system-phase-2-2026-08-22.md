# Founding 100 Creator Acquisition System (Phase 2)

## Architecture audit — what already exists and gets reused

| Need | Existing system (reuse, do not duplicate) |
| --- | --- |
| Framework | TanStack Start + React 19, routes in `src/routes`, server fns in `*.functions.ts` |
| Creator application | `seller_applications` table + `/sell` route + `CreatorApplicationsBoard` admin review with `application_status` enum |
| Creator account/seller flag | `profiles.is_seller` |
| Lead capture | `creator_leads` (already has UTM, consent, nurture steps, `seller_application_id`, `converted_to_creator_at`) |
| Starter Pack funnel | `/creator-starter-pack`, `src/lib/starter-pack.*`, nurture cron |
| Email | React Email templates + `registry.ts` + `enqueue_email` RPC + `email_send_log` |
| Analytics events | `cta_click_events` + `src/lib/cta-tracking.ts` |
| Storefront | `/store/$slug`, `StorefrontBadgeRow` (badge pattern already exists) |
| Referrals | `creator_referrals` + `/refer` + `dashboard.creator-referrals` |
| Admin acquisition dashboard | `/admin/creator-acquisition` (extend, don't replace) |
| Payouts / 85-15 split | existing marketplace config — untouched |

No new application form, no second seller table, no parallel analytics or lead store.

## Additions

### Schema (one migration, additive, with GRANTs + RLS)
- `public.founding_creators` — `user_id` unique, `founding_number` unique (1–100), `accepted_at`, `accepted_by`, `campaign_source`, `seller_application_id`, `lead_id`. Read: public SELECT of number + user_id only via a view/policy for badges; write: service role only.
- `assign_founding_creator(_user_id, _application_id)` — `SECURITY DEFINER`, advisory-lock + `max(founding_number)+1`, refuses above 100, idempotent. Public EXECUTE revoked.
- `seller_applications` additive columns: `campaign`, `campaign_source`, `utm_*`, `referring_url`, `creator_lead_id`.
- `public.creator_prospects` — outreach CRM with the requested fields and status set; admin-only RLS, notes sanitized server-side.
- `public.creator_activation` — per-creator milestone timestamps (first login, profile complete, first product started/submitted/approved/published, first sale) written only by server logic derived from real records.

### Routes
- `/founding-100` — public campaign page: hero, why-join, who-we-look-for, live counter from `founding_creators`, dual CTA (Apply → `/sell` with campaign attribution; Starter Pack → `/creator-starter-pack`), FAQ, closed-cohort state at 100.
- `/_authenticated/dashboard/launch-kit` — Creator Launch Kit: announcement + Founding Creator graphics, copyable caption, storefront link, QR code (client-side generation).
- `/_authenticated/admin/creator-prospects` — outreach tracker + copyable outreach templates.
- `/_authenticated/admin/creator-acquisition` — extended into the Founding 100 command center (cohort count, funnel stages, acquisition sources, outreach stats, email stats, real empty states).

### Components / libs
- `FoundingCreatorBadge.tsx` — restrained gold-on-navy seal, optional `#027`, used on storefront, product page seller line, creator dashboard, admin profile.
- `src/lib/founding.ts` (constants/copy), `founding.functions.ts` (public counter + admin accept/assign), `founding.server.ts` (privileged assign + acceptance email), `creator-prospects.functions.ts`.
- Attribution: `/founding-100` stores campaign params in session storage and `/sell` submission persists them onto the application; if a `creator_leads` row matches the applicant email, link it.

### Email
- `founding-acceptance` transactional template (name, status, number, next steps, dashboard/storefront/launch-kit links; no product-approval promises).
- Founding recruitment sequence emails 1–4 for consented marketing contacts only; sequence auto-stops when the cohort is full.
- Activation emails reuse existing queue: profile incomplete, no first product, product live, first sale.

### Security
Founding status and creator number are server-assigned only; admin role checked via `has_role`; prospect table admin-only; no lead enumeration; rate limiting on public endpoints; recipient always read from the stored row, never the request body.

### Tests (vitest + existing playwright patterns)
Counter truthfulness and 100 cap, concurrency-safe numbering, self-assignment rejection, attribution persistence, admin-only prospect access, activation states derived from real records, acceptance email recipient integrity, responsive checks at 390/768/1280.

## Build order
1. Migration (schema + function + RLS + grants)
2. `founding.ts` / server fns / badge component
3. `/founding-100` page + attribution wiring into `/sell`
4. Acceptance email + admin accept action in `CreatorApplicationsBoard`
5. Launch kit route
6. Prospect tracker + outreach templates
7. Admin command center metrics
8. Recruitment/activation emails + cron reuse
9. Tests, responsive verification, report

## Notes
Delivered in staged batches; nothing is reported as verified unless the test run output is shown. Changes go live only after Publish.
