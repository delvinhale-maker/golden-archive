# Creator Rights Ledger™ reconstruction

This directory is the TanStack/Vite reconstruction target for the previously standalone Next.js Creator Rights Ledger release candidate.

## Source provenance

Recovered source basis: `Creator_Rights_Ledger_v1.0_RC1_Isolated_Staging_Launch_Gate.zip`.

The recovered RC1 contains the original atomic-rights model, lifecycle logic, rights-health logic, deal wizard, agreements, renewals, agency roles, invitations, billing, notifications, Agreement Assistant, audit/export paths, Playwright tests and migrations 0001–0011.

Later staging hardening was certified separately through migrations and live staging evidence. Those later source files were not available as a complete reproducible source tree, so this reconstruction does not pretend they were recovered. Hardened behavior must be ported deliberately into the AurumVault TanStack architecture and verified again.

## Locked product rules

- An agreement is not a right.
- An asset is not a right.
- A campaign is not a right.
- Each permission or restriction is an independent, traceable, time-aware record.
- Permission state remains `GRANTED`, `NOT_GRANTED`, or `UNCLEAR`.
- `I’m not sure` remains a first-class UX option.
- Renewals and amendments create history; material rights must never be silently overwritten.
- Conflict detection says `Possible overlap` / `Potential conflict`; it does not declare breach.
- Rights Health™ is operational guidance, not a legal conclusion.

## Integration boundary

The AurumVault store remains TanStack Start + Vite + React. Do not copy the RC1 Next.js `app/` router into this repository. Port domain logic, server actions, routes and tests into the existing conventions.

The existing AurumVault production backend must not be repurposed as the isolated Creator Rights Ledger staging backend. Database/storage migrations require an explicit staging target and live isolation verification before production use.

## Release gate

The GitHub Actions workflow `creator-rights-ledger-release-gate.yml` runs the dependency-backed sequence:

1. frozen dependency installation
2. TypeScript (`tsc --noEmit`)
3. Vitest
4. Vite/TanStack production build
5. Playwright

No production-ready claim is valid unless those stages and the remaining hosted/backend runtime gates pass.
