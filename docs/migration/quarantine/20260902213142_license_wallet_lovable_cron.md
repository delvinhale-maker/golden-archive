# Quarantined migration: 20260902213142_f8dffe65-c985-4f29-ba77-80405c3dd48b.sql

Source: exact Lovable revision `c78b3ca13b27e0563a6bb01c270bef10407b82db`.

This migration is intentionally excluded from the executable recovery migration chain.

Reason: the original migration schedules `license-wallet-reminders-daily` against a Lovable-hosted application endpoint and embeds a legacy credential in the scheduled request. Replaying it in independent staging would recreate a Lovable runtime dependency and would copy a credential into Git history.

The legacy credential is intentionally omitted from this repository and must not be recovered into source control.

Before License Wallet reminder scheduling is enabled in the independent environment, replace this migration with a new migration that targets an independently hosted reminder endpoint, obtains authentication from an independently managed secret/configuration boundary, preserves idempotency, and is certified in staging before any production scheduling change.

Quarantine status: **DO NOT APPLY**.