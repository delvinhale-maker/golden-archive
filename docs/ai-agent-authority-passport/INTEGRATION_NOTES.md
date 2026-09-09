# Integration Notes

Branch: `feature/ai-agent-authority-passport`

The detached Agent Authority package has now been attached to the real AurumVault TanStack Start repository source. The authenticated route and API routes are present in their final source paths, and the repository build regenerated `src/routeTree.gen.ts` successfully. The schema remains a design candidate only; no Supabase migration has been applied.

## Repository attachment completed

1. Reconstructed the verified transferred source package into `src/` and `docs/`.
2. Verified the transferred archive SHA-256 before extraction.
3. Ran `bun install --frozen-lockfile`.
4. Ran the Agent Authority Vitest suite.
5. Ran the full AurumVault production build.
6. Regenerated the TanStack route tree through the repository build.
7. Removed all temporary transfer chunks and the temporary reconstruction workflow.
8. Added a permanent Agent Authority CI gate for relevant PR/main changes.

## Remaining staging attach order

1. Provision a dedicated isolated Agent Authority staging backend.
2. Review `docs/ai-agent-authority-passport/schema.sql` against the repository's current migration history.
3. Convert the reviewed schema into repository-standard timestamped migration files using the project's normal Supabase workflow rather than copying a guessed migration filename.
4. Apply those migrations only to isolated staging.
5. Regenerate database types from isolated staging.
6. Run two-user RLS, role, Action Gate, policy-change, delegation, incident, export, API and webhook-worker tests.
7. Run authenticated browser E2E against the isolated staging backend.
8. Fix every staging blocker before production enablement.

## Important integration boundaries

- Do not connect the Agent Authority foundation to the live AurumVault database for initial validation.
- Do not reuse the existing Digital Rights Passport staging database.
- Do not hand-edit generated Supabase or TanStack files.
- Do not put webhook signing secrets, API plaintext credentials or service-role values in client code/database-readable records.
- The webhook registry expects a server-side secret-reference mechanism before outbound delivery is enabled.
- `schema.sql` remains a design artifact until reconciled with the actual migration history and proven in isolated staging.
