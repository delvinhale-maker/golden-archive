-- Taxonomy corrective upgrade: normalize legacy Business Systems subcategory
-- (System Type) values to the canonical set seeded into product_subcategories
-- by 20260823183902 (Interactive Decision Tools, Complete Business Systems,
-- Live Dashboards & Calculators, Operating Systems, Assessment & Scoring
-- Tools). That migration added the new managed rows but did not touch
-- existing marketplace_products rows, so any Business Systems product
-- created before it still carries an old, now-unlisted subcategory string
-- (AI Business Systems / Creator Business Systems / Marketing Systems /
-- Sales & Client Systems / Operations & Productivity Systems). Those
-- products remain visible under "All Business Systems" (category-only
-- filter) but return zero results under every specific System Type chip,
-- because no chip or filter offers the old strings anymore — this is the
-- root cause of the "Business Systems returns 0 results" report.
--
-- Mapping (old subcategory -> new canonical System Type). This is a
-- best-effort default based on the old function-based grouping, not manual
-- per-product content inspection (not available from this migration) —
-- "Interactive Decision Tools" already matches a canonical name and is left
-- untouched:
--   AI Business Systems              -> Operating Systems
--   Creator Business Systems         -> Complete Business Systems
--   Marketing Systems                -> Complete Business Systems
--   Sales & Client Systems           -> Complete Business Systems
--   Operations & Productivity Systems -> Operating Systems
--
-- Additive, idempotent (safe to re-run), and scoped to
-- category = 'business_operating_systems' only. No rows are deleted, no
-- other category is touched, no price/seller/order data is touched.

UPDATE public.marketplace_products
SET subcategory = 'Operating Systems'
WHERE category = 'business_operating_systems'
  AND subcategory = 'AI Business Systems';

UPDATE public.marketplace_products
SET subcategory = 'Complete Business Systems'
WHERE category = 'business_operating_systems'
  AND subcategory = 'Creator Business Systems';

UPDATE public.marketplace_products
SET subcategory = 'Complete Business Systems'
WHERE category = 'business_operating_systems'
  AND subcategory = 'Marketing Systems';

UPDATE public.marketplace_products
SET subcategory = 'Complete Business Systems'
WHERE category = 'business_operating_systems'
  AND subcategory = 'Sales & Client Systems';

UPDATE public.marketplace_products
SET subcategory = 'Operating Systems'
WHERE category = 'business_operating_systems'
  AND subcategory = 'Operations & Productivity Systems';

-- Named reference products (spec-provided classification) — title-matched
-- overrides applied after the generic mapping above, since these are known
-- with certainty rather than inferred from the old grouping. Trademark
-- symbols are intentionally excluded from the match so a missing/extra (TM)
-- glyph never breaks the match. Creator AI Rights & Licensing System is
-- deliberately NOT force-classified here: the spec itself flags its System
-- Type as ambiguous ("Interactive Decision Tools or Operating System based
-- on the current implementation") — that needs a human admin decision, not
-- an automated guess, so it only receives whatever the generic mapping
-- above already gave it (if anything).

UPDATE public.marketplace_products
SET subcategory = 'Interactive Decision Tools',
    product_type = 'complete_digital_system'
WHERE category = 'business_operating_systems'
  AND title ILIKE '%Creator Performance & ROI%';

UPDATE public.marketplace_products
SET subcategory = 'Interactive Decision Tools',
    product_type = 'complete_digital_system'
WHERE category = 'business_operating_systems'
  AND title ILIKE '%Digital Product Opportunity%Validation%';

UPDATE public.marketplace_products
SET subcategory = 'Operating Systems',
    product_type = 'complete_digital_system'
WHERE category = 'business_operating_systems'
  AND title ILIKE '%AI Small Business Operating System%';
