# AurumVault Creator Studio — CS1 Foundation

Branch: `creator-studio/cs1-foundation`

Scope: schema, RLS, projects, assets, wizard shell.

Non-goals for CS1: provider rendering, billing enforcement, production publishing, timeline editing.

## Product flow

1. Choose promotion goal.
2. Create a Creator Studio project.
3. Upload/select product assets.
4. Enter CTA and optional product metadata.
5. Review project readiness.
6. Continue to template/render stages in later phases.

## Security principles

- Every project and asset is owner-scoped.
- RLS is enabled on all Creator Studio tables.
- Anonymous access is denied.
- Asset storage is private.
- Provider credentials are never browser-visible.
- No production migrations are applied from this branch.

## CS1 acceptance gate

- Additive migration only.
- Creator Studio tables and private asset bucket defined.
- Owner-only policies for select/insert/update; no delete grants unless explicitly required.
- Wizard shell and project/asset routes compile against existing app architecture.
- No Shotstack calls yet.
- No entitlement/billing logic yet.
