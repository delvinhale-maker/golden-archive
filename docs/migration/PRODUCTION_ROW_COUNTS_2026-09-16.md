# AurumVault Lovable Exit — Exact Production Row Counts

Date: 2026-09-16
Source: Lovable production PostgreSQL for project `622409bb-9a09-4d0a-94c0-f5a8640d5c80`
Source backend reference: `rymruqkxmbxobrkkekoc`
Frozen source anchor: `c78b3ca13b27e0563a6bb01c270bef10407b82db`

## Boundary

This inventory was produced using read-only `SELECT count(*)` queries against production. No production rows, schema, auth records, storage objects, Stripe configuration, DNS, or customer accounts were modified.

The counts below are exact query results, not `reltuples` estimates. There are 114 public base tables, 45 non-empty and 69 empty, containing 6,232 public rows in total at the time of this inventory.

| Table | Exact rows |
|---|---:|
| abandoned_carts | 12 |
| academy_article_products | 13 |
| academy_article_related | 1 |
| academy_article_versions | 297 |
| academy_articles | 66 |
| academy_bookmarks | 0 |
| academy_categories | 11 |
| affiliate_clicks | 9 |
| affiliate_commissions | 0 |
| affiliate_products | 6 |
| affiliate_referral_clicks | 0 |
| audiobook_activity_events | 0 |
| audiobook_audio_assets | 0 |
| audiobook_chapter_versions | 0 |
| audiobook_chapters | 0 |
| audiobook_generation_jobs | 0 |
| audiobook_metadata | 0 |
| audiobook_projects | 0 |
| audiobook_pronunciations | 0 |
| audiobook_qc_results | 0 |
| audiobook_qc_runs | 0 |
| audiobook_rights_attestations | 0 |
| audiobook_sources | 0 |
| audiobook_usage | 0 |
| audiobook_voice_configs | 0 |
| auto_release_runs | 1,905 |
| contact_messages | 2 |
| cover_audit_alert_config | 1 |
| cover_audit_runs | 5 |
| creator_activation | 0 |
| creator_affiliate_programs | 0 |
| creator_affiliates | 0 |
| creator_announcement_reads | 0 |
| creator_announcements | 0 |
| creator_bundle_items | 0 |
| creator_bundles | 0 |
| creator_followers | 0 |
| creator_forum_likes | 0 |
| creator_forum_posts | 0 |
| creator_forum_replies | 0 |
| creator_lead_rate_limits | 0 |
| creator_leads | 4 |
| creator_payout_methods | 1 |
| creator_prospects | 0 |
| creator_referrals | 0 |
| creator_spotlights | 0 |
| creator_storefront_events | 3 |
| creator_storefront_settings | 0 |
| creator_tax_forms | 0 |
| cta_click_events | 1,933 |
| email_send_log | 517 |
| email_send_state | 1 |
| email_unsubscribe_tokens | 15 |
| error_logs | 777 |
| founding_creators | 0 |
| homepage_layout | 7 |
| insider_editions | 0 |
| integration_connections | 4 |
| license_wallet_activity | 0 |
| license_wallet_billing_events | 0 |
| license_wallet_documents | 0 |
| license_wallet_entitlements | 0 |
| license_wallet_locations | 0 |
| license_wallet_reminder_log | 0 |
| license_wallet_reminder_settings | 0 |
| marketplace_bundle_items | 0 |
| marketplace_bundles | 0 |
| marketplace_products | 67 |
| merch_events | 9 |
| notifications | 69 |
| order_downloads | 4 |
| order_items | 4 |
| orders | 4 |
| payout_release_runs | 1 |
| payout_requests | 0 |
| product_download_files | 14 |
| product_order_bumps | 0 |
| product_previews | 3 |
| product_publish_history | 277 |
| product_qa | 0 |
| product_recommendations | 0 |
| product_reviews | 0 |
| product_slug_redirects | 17 |
| product_subcategories | 40 |
| product_variants | 4 |
| profiles | 4 |
| qr_campaigns | 0 |
| qr_projects | 0 |
| qr_scan_events | 0 |
| referrals | 0 |
| review_helpful_votes | 0 |
| review_photos | 0 |
| rights_ai_consents | 0 |
| rights_analysis_findings | 0 |
| rights_analysis_runs | 0 |
| rights_evidence | 0 |
| rights_licenses | 0 |
| rights_passport_assets | 0 |
| rights_passport_documents | 0 |
| rights_passport_entitlements | 0 |
| rights_passport_events | 0 |
| rights_passport_public_identities | 0 |
| rights_passport_snapshots | 0 |
| rights_passports | 1 |
| rights_review_flags | 0 |
| seller_applications | 3 |
| seller_balances | 1 |
| seller_payouts | 0 |
| slug_integrity_alerts | 79 |
| subscribers | 1 |
| suppressed_emails | 7 |
| user_roles | 4 |
| vault_finds_products | 28 |
| wishlists | 1 |

## Use at migration gate

After the first independent-staging data restore, rerun exact counts against the restored tables and reconcile every difference. A row-count match is necessary but not sufficient: foreign-key integrity, key identifiers, auth identities, storage objects, and representative functional reads must also pass before any production cutover is considered.