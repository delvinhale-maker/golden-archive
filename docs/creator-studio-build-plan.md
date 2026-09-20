# AurumVault Creator Studio™ — CS1–CS5 Build Plan

Status: implementation branch only. Do not apply migrations to production and do not enable provider rendering in production until CS5 passes.

## Product promise

Turn a creator's product assets into a polished short promotional video without exposing a timeline editor.

V1 intents:
- Promote my ebook
- Promote my course
- Promote my planner
- Create TikTok ad
- Create Instagram Reel
- Create product trailer
- Create book trailer

Default output: 9:16 MP4, 15/30/45 seconds. Inputs: cover/product image, screenshots, optional logo, title, CTA, optional price and destination URL.

## CS1 — Foundation

- Owner-scoped Creator Studio projects.
- Private project assets with metadata and storage references.
- Draft wizard state persisted server-side.
- RLS denies cross-user reads/writes.
- Soft archive rather than destructive project deletion.
- Feature flag defaults OFF.

## CS2 — Template Engine

- Provider-neutral render plan schema validated with Zod.
- Versioned internal template definitions.
- Deterministic scene planner maps product goal + duration + style to scenes.
- Never persist provider secrets in render plans.
- Template IDs are stable; template revisions are immutable once used by a completed render.

## CS3 — Shotstack Integration

- Shotstack only behind a server adapter.
- Browser never receives Shotstack API keys.
- Render requests use idempotency keys.
- Persist provider render id, status, duration, estimated/actual cost, timestamps and sanitized failure codes.
- Webhook handler verifies configured secret before accepting status changes.
- Asset access uses short-lived signed URLs generated server-side.
- Sandbox/staging endpoint first; production provider endpoint remains gated until CS5.

## CS4 — Entitlements

Customer-facing allowances:
- Free: 1 preview.
- Creator Pro: 10 completed standard videos per billing period.
- Creator Business: 50 completed standard videos per billing period.
- Additional standard render: purchased credit, initially modeled at $3 retail.

Usage is reserved before provider submission and settled exactly once after terminal render state. Failed provider renders release the reservation unless output was successfully delivered. Never trust client-provided plan or remaining balance.

## CS5 — Production Gate

Required before production provider rendering:
- isolated staging backend/provider configuration
- two-user project, asset and render isolation
- signed URL expiry validation
- webhook signature/secret rejection tests
- provider timeout/429/5xx and malformed response tests
- idempotency and duplicate-webhook tests
- usage reservation/settlement/refund tests
- cost accounting reconciliation
- build and targeted Creator Studio test suite
- no production provider secret exposed client-side
- explicit release report and feature-flag verification

Production release remains blocked until all mandatory CS5 checks pass.
