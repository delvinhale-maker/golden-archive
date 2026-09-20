# AurumVault Production Export Inventory — 2026-09-17

## Boundary

This report was produced from **read-only** inspection of the Lovable-hosted production backend for project `622409bb-9a09-4d0a-94c0-f5a8640d5c80` / Supabase ref `rymruqkxmbxobrkkekoc`.

No production rows, Auth records, Storage objects, DNS, Stripe settings, or secrets were modified.

Independent migration target: `aurumvault-staging` / `ypelutaddlibqvpaekyq`.

## Production inventory

- Public tables: **114**
- Recorded Supabase migrations: **161**
- First recorded migration: `20260625220928`
- Latest recorded migration: `20260907183018`
- Exact public-table rows across all 114 tables: **368**
- Auth users: **4**
- Auth identities: **4**
- Auth identity providers: **email only**
- Storage buckets: **15**
- Storage objects: **341**
- Storage bytes: **846,449,712** (~807 MiB)

## Exact public-table row counts

```text
abandoned_carts 0
academy_article_products 0
academy_article_related 30
academy_article_versions 0
academy_articles 20
academy_bookmarks 0
academy_categories 9
affiliate_clicks 1
affiliate_commissions 0
affiliate_products 6
affiliate_referral_clicks 0
audiobook_activity_events 0
audiobook_audio_assets 0
audiobook_chapter_versions 0
audiobook_chapters 0
audiobook_generation_jobs 0
audiobook_metadata 0
audiobook_projects 0
audiobook_pronunciations 0
audiobook_qc_results 0
audiobook_qc_runs 0
audiobook_rights_attestations 0
audiobook_sources 0
audiobook_usage 0
audiobook_voice_configs 0
auto_release_runs 0
contact_messages 0
cover_audit_alert_config 1
cover_audit_runs 9
creator_activation 0
creator_affiliate_programs 0
creator_affiliates 0
creator_announcement_reads 0
creator_announcements 3
creator_bundle_items 0
creator_bundles 0
creator_followers 0
creator_forum_likes 0
creator_forum_posts 0
creator_forum_replies 0
creator_lead_rate_limits 5
creator_leads 6
creator_payout_methods 0
creator_prospects 16
creator_referrals 0
creator_spotlights 0
creator_storefront_events 0
creator_storefront_settings 0
creator_tax_forms 0
cta_click_events 0
email_send_log 0
email_send_state 1
email_unsubscribe_tokens 0
error_logs 1
founding_creators 1
homepage_layout 8
insider_editions 0
integration_connections 0
license_wallet_activity 0
license_wallet_billing_events 0
license_wallet_documents 0
license_wallet_entitlements 0
license_wallet_locations 0
license_wallet_reminder_log 0
license_wallet_reminder_settings 0
marketplace_bundle_items 0
marketplace_bundles 0
marketplace_products 23
merch_events 1
notifications 1
order_downloads 2
order_items 2
orders 1
payout_release_runs 0
payout_requests 0
product_download_files 52
product_order_bumps 0
product_previews 3
product_publish_history 23
product_qa 0
product_recommendations 0
product_reviews 0
product_slug_redirects 0
product_subcategories 78
product_variants 0
profiles 4
qr_campaigns 0
qr_projects 1
qr_scan_events 1
referrals 0
review_helpful_votes 0
review_photos 0
rights_ai_consents 2
rights_analysis_findings 0
rights_analysis_runs 0
rights_evidence 0
rights_licenses 0
rights_passport_assets 0
rights_passport_documents 2
rights_passport_entitlements 1
rights_passport_events 0
rights_passport_public_identities 0
rights_passport_snapshots 0
rights_passports 1
rights_review_flags 0
seller_applications 3
seller_balances 1
seller_payouts 0
slug_integrity_alerts 8
subscribers 0
suppressed_emails 0
user_roles 1
vault_finds_products 22
wishlists 0
```

## Production Storage inventory

| Bucket | Public | Objects | Bytes |
|---|---:|---:|---:|
| academy-covers | yes | 66 | 5,421,136 |
| audiobook-audio | no | 0 | 0 |
| audiobook-manuscripts | no | 0 | 0 |
| avatars | yes | 0 | 0 |
| creator-covers | yes | 0 | 0 |
| creator-resources | yes | 1 | 1,685,616 |
| digital-rights-evidence | no | 0 | 0 |
| kingdom-picks | yes | 13 | 9,550,879 |
| license-wallet-documents | no | 0 | 0 |
| product-covers | yes | 100 | 48,632,381 |
| product-files | no | 136 | 770,898,517 |
| product-previews | yes | 3 | 118,688 |
| review-photos | no | 0 | 0 |
| tax-forms | no | 0 | 0 |
| vault-finds | yes | 22 | 143,195 |

No object paths, user emails, password material, OAuth tokens, or secret values are recorded in this document.

## Migration implication

Independent staging is **not** a production clone. Staging currently has a different Auth population and staging-specific data, so production must not be restored over it wholesale.

Use an explicit transfer plan:

1. Produce a production data export in dependency-safe order, preserving primary keys and timestamps.
2. Keep staging-only certification data isolated or purge only after it has been positively identified as synthetic.
3. Import the four production Auth users using a supported Auth migration mechanism that preserves identity continuity where possible; do not copy active sessions.
4. Copy Storage objects bucket-for-bucket while preserving exact object paths, metadata, privacy mode, and signed-download behavior.
5. Reconcile relational rows after Auth identity mapping is fixed, then verify foreign-key counts and representative customer entitlements/downloads.
6. Re-run exact row counts after import and require source/target equality for production-owned data before production cutover.

## Cutover gate

This inventory enables migration planning only. It does **not** authorize production writes, production deletion, DNS changes, live Stripe webhook changes, or production promotion.
