-- Aurum Intelligence Layer — Phase I
-- Privacy posture: raw text is session-scoped; aggregate gap analytics only
-- receive normalized objective keys when analytics consent is true.

create table if not exists public.aurum_intent_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid null references auth.users(id) on delete set null,
  channel text not null check (channel in ('text','voice')),
  objective_key text not null,
  stage text not null check (stage in ('exploring','planning','buying','executing')),
  category_hints text[] not null default '{}',
  analytics_consent boolean not null default false,
  personalization_consent boolean not null default false,
  result_count integer not null default 0 check (result_count >= 0),
  recommendation_confidence numeric(4,3) null check (recommendation_confidence between 0 and 1),
  converted boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.aurum_intent_events enable row level security;
create index if not exists aurum_intent_events_objective_created_idx on public.aurum_intent_events (objective_key, created_at desc);
create index if not exists aurum_intent_events_user_created_idx on public.aurum_intent_events (user_id, created_at desc) where user_id is not null;

drop policy if exists "users read own aurum intents" on public.aurum_intent_events;
create policy "users read own aurum intents" on public.aurum_intent_events
for select to authenticated using (auth.uid() = user_id);

create table if not exists public.aurum_product_proof (
  product_id uuid primary key references public.marketplace_products(id) on delete cascade,
  version text null,
  product_reviewed boolean not null default false,
  claims_reviewed boolean not null default false,
  ai_involvement text null,
  evidence jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.aurum_product_proof enable row level security;
drop policy if exists "public reads proof for published products" on public.aurum_product_proof;
create policy "public reads proof for published products" on public.aurum_product_proof
for select to anon, authenticated using (
  exists (
    select 1 from public.marketplace_products p
    where p.id = product_id and p.status = 'approved' and p.published = true
  )
);

create or replace view public.aurum_marketplace_gap_signals
with (security_invoker = true) as
select
  objective_key,
  coalesce(category_hints[1], null) as category_hint,
  count(*)::bigint as request_count,
  sum(case when result_count = 0 then 1 else 0 end)::bigint as no_result_count,
  sum(case when recommendation_confidence is not null and recommendation_confidence < 0.55 then 1 else 0 end)::bigint as low_confidence_count,
  sum(case when converted then 1 else 0 end)::bigint as conversion_count,
  min(created_at) as first_seen_at,
  max(created_at) as last_seen_at
from public.aurum_intent_events
where analytics_consent = true
group by objective_key, coalesce(category_hints[1], null);

revoke all on public.aurum_intent_events from anon;
revoke insert, update, delete on public.aurum_intent_events from authenticated;
revoke all on public.aurum_marketplace_gap_signals from anon, authenticated;
revoke insert, update, delete on public.aurum_product_proof from anon, authenticated;
