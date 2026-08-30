INSERT INTO public.academy_categories (slug, name, emoji, description, sort_order) VALUES
  ('creator-economy', 'Creator Economy', '🎨', 'Audience building, storefronts, monetization, brand deals, creator business models', 6),
  ('ai-governance-digital-rights', 'AI Governance & Digital Rights', '⚖️', 'AI policy, licensing, ownership, disclosure, ethics, protecting your digital work', 7),
  ('business-systems', 'Business Systems', '🧩', 'Operating systems, dashboards, SOPs, decision tools, scalable workflows', 8),
  ('film-tv-media', 'Film, TV & Media', '🎬', 'Production business, media rights, distribution, pitching, creator production systems', 9),
  ('personal-finance', 'Personal Finance', '📊', 'Budgeting frameworks, planning spreadsheets, credit, taxes, household money systems', 10),
  ('life-planning', 'Life Planning', '🗓️', 'Goal setting, habits, planners, journaling systems, seasonal reviews', 11)
ON CONFLICT (slug) DO NOTHING;