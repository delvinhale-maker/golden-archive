-- Optimize independent-verification history and organization review queues.
create index if not exists food_reviews_entity_history_idx on public.food_assurance_reviews (organization_id, entity_type, entity_id, review_type, reviewed_at desc) where status='approved';
create index if not exists food_reviews_pending_queue_idx on public.food_assurance_reviews (organization_id, created_at desc) where status='pending';
