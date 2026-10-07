# AurumVault Food Traceability & Recall Assurance OS™

## Product mission
A live multi-tenant SaaS operating system that helps food businesses capture traceability events, identify missing evidence, investigate affected lots, execute recalls, and produce defensible traceability records.

## Positioning
AurumVault is the assurance layer, not a replacement ERP. The product connects operational traceability data to evidence, exceptions, corrective actions, verification, approval, and defensible closure.

## Core lifecycle
Supplier → Item → Traceability Lot → Critical Tracking Event → Transformation/Shipment → Exception → Investigation/Recall → Corrective Action → Evidence → Verification → Closure

## V1 workspaces
1. Command Center
2. Products & Food Traceability List applicability
3. Suppliers & Facilities
4. Traceability Lots
5. Critical Tracking Events
6. Transformations / lot genealogy
7. Shipments & destinations
8. Traceability Exceptions
9. Recall Command Center
10. Corrective Actions
11. Evidence Vault
12. FDA Readiness / 24-Hour Challenge
13. Reports & sortable export
14. Activity / immutable audit trail
15. Organization, users, roles and settings

## Shared Assurance Cloud foundation
Organizations, memberships, roles, workspaces, deadlines, cases, actions, evidence, reviews, approvals, notifications, audit events, saved views, exports and integration jobs are reusable across future AurumVault vertical OS products.

## Food-specific domain model
- facilities
- trading_partners
- food_items
- traceability_lots
- critical_tracking_events
- event_kdes
- lot_relationships
- shipments
- shipment_items
- traceability_exceptions
- recall_cases
- recall_scope_items
- recall_notifications
- dispositions
- mock_record_requests

## V1 roles
Organization Owner; Compliance Admin; Traceability Manager; Operations Contributor; Independent Reviewer; Approver; Auditor/Read Only.

## Safety and integrity requirements
- strict organization tenancy and row-level access control
- server-enforced authorization
- separation of reviewer/approver duties where configured
- append-only audit history for regulated actions
- evidence versioning and provenance
- no fabricated compliance status
- readiness scores expose missing data and calculation basis
- exports are reproducible and time-stamped
- destructive operations require explicit authorization and are audited

## FDA readiness experience
The 24-Hour Challenge lets an authorized user select a food/lot or simulated records request. The system traces upstream/downstream relationships, measures required-data completeness, identifies missing records, and produces a readiness result with exportable supporting data. It must not represent a simulation as an FDA submission or certification.

## Initial SaaS delivery
The product is built within the existing AurumVault codebase on an isolated feature branch, using the established TanStack/React/TypeScript stack and existing auth/payment/backend conventions where safe. Production storefront behavior must remain unchanged until release gates are satisfied.

## Commercial surfaces
AurumVault.store: discovery, product page, pricing and conversion.
app.aurumvault.store: target unified SaaS application surface after infrastructure/domain certification.

## Release gates
Schema/RLS certification; authorization tests; traceability genealogy tests; recall-scope tests; export determinism; audit immutability; accessibility; responsive/mobile checks; build/type/lint/tests; preview smoke; production deployment; live critical-path smoke.
