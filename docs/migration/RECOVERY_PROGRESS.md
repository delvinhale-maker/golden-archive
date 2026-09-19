# AurumVault Lovable Exit — Recovery Progress

Updated: 2026-09-15

## Safety boundary

Production remains untouched. This recovery work is isolated to `migration/aurumvault-lovable-exit` and draft PR #15.

- `main`: unchanged by recovery work
- `aurumvault.store` DNS: unchanged
- live Stripe webhooks: unchanged
- Lovable production database `rymruqkxmbxobrkkekoc`: no writes
- independent staging `ypelutaddlibqvpaekyq`: not yet schema-mutated by this branch

## Recovered from the Lovable c78 snapshot

### Digital Rights Passport

- Imported the existing `rights-passport/foundation` recovery source into the migration sandbox only.
- Reconciled `PublisherShell.tsx` to the later Lovable snapshot behavior that includes Rights Passport, Audiobook Studio and License Wallet navigation gates.
- Recovered the seven actual Rights Passport production migration files from Lovable source:
  - `20260907182244_02121ac7-993f-402b-bc7b-c467b12d6b79.sql`
  - `20260907182425_c1fe2e66-0e34-4517-a9cd-cac3259d3177.sql`
  - `20260907182634_631cad06-c9ea-4e60-8185-5944aa911ec2.sql`
  - `20260907182801_243e9d6a-e355-4763-b8bc-71a8e386c294.sql`
  - `20260907182844_6b61a8ea-e676-4779-a1b0-a8aaa7001c57.sql`
  - `20260907182928_7b801b83-72b5-4df2-a08f-4c367eaed603.sql`
  - `20260907183018_32debdf6-5b5e-48a7-9139-afccd324ebe2.sql`

These migrations are source recovery only. They have not been executed against production.

### Audiobook Studio

Recovered into the migration sandbox so far:

- schema foundation migration `20260902151330_c00d942f-4e86-4650-baab-34781a4fcae1.sql`
- relational owner hardening migrations `20260902151736_82a4b826-7571-4546-b41b-d6b6b28ec4c1.sql` and `20260902151848_986fc369-9419-4efa-9eea-eeec20c39da9.sql`
- feature flags and server feature-gate middleware
- beta cohort middleware
- private storage helper
- metadata, rights and readiness rules
- UI workflow rules
- project/source/chapter workflow module
- project-list route

Audiobook recovery is **in progress**. Remaining generation, TTS, QC, packaging, parsing and detailed studio route files still have to be recovered/reconciled before the migration branch can be called source-complete.

## Important certification note

This branch is **not yet exact-source certified** against Lovable revision `c78b3ca13b27e0563a6bb01c270bef10407b82db`.

Recovery is being performed file-by-file because the paused Lovable project does not currently expose a one-click source archive through the available interface. A file being present on this branch is not, by itself, proof of complete parity. Exact file reconciliation, dependency closure, build/typecheck/tests, database migration replay and runtime staging evidence are still required.

## Production-blocking Lovable dependencies still to replace

- Google OAuth broker → native Supabase OAuth
- Stripe connector gateway → direct Stripe server API
- Lovable email dispatcher → independent transactional email provider
- Lovable AI gateway used by product review → direct model-provider adapter
- Lovable build/runtime helper dependencies → standard deployment configuration where required

## Next gates

1. Finish Audiobook Studio and License Wallet source recovery/dependency closure.
2. Reconcile generated route tree after all recovered routes exist.
3. Run the Lovable dependency audit and normal build/typecheck/test suite from a trusted Git SHA.
4. Restore and prepare independent AurumVault staging.
5. Replay schema only after migration ordering is reviewed.
6. Replace Lovable runtime adapters in staging.
7. Recover/transfer production data, auth identities and storage with evidence.
8. Certify storefront + auth + checkout + webhook fulfillment + downloads + creator/admin functions.
9. Freeze exact release SHA before any production cutover.

Current cutover status: **NO-GO**.
