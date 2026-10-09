-- Persist Stripe subscription creation time to reject stale replacement events without depending on retrieval of canceled subscriptions.
alter table public.food_os_entitlements add column if not exists stripe_subscription_created_at timestamptz;
create index if not exists food_entitlements_subscription_created_idx on public.food_os_entitlements (stripe_subscription_created_at desc) where stripe_subscription_id is not null;
