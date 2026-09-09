# Integration Notes

Recommended branch: `feature/ai-agent-authority-passport`

This package is a detached source implementation based on the previously inspected AurumVault TanStack Start/Supabase conventions. It deliberately does not contain or overwrite `routeTree.gen.ts`.

## Attach order

1. Apply `src/` additions/updates.
2. Review `docs/ai-agent-authority-passport/schema.sql` against the target branch's current schema.
3. Generate repository-standard timestamped migration files using the project's normal Supabase workflow rather than copying a guessed migration filename.
4. Regenerate database types.
5. Run the TanStack route generator/build so the new authenticated route and API routes enter `routeTree.gen.ts`.
6. Connect only to a dedicated isolated staging backend.
7. Run two-user RLS, role, Action Gate, policy-change, delegation, incident, export, API and webhook-worker tests.

## Important integration boundaries

- Do not connect this package to the live AurumVault database for initial validation.
- Do not reuse the existing Digital Rights Passport staging database.
- Do not hand-edit generated Supabase or TanStack files.
- Do not put webhook signing secrets, API plaintext credentials or service-role values in client code/database-readable records.
- The webhook registry expects a server-side secret-reference mechanism before outbound delivery is enabled.
- The detached schema is a design artifact until it is reconciled with the actual staging branch migration history.
