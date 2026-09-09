-- PHASE 1 SCHEMA — historical product-slug redirect registry.
-- Safe for long malformed historical slugs: the indexed key is a fixed-length
-- lookup digest, not old_slug text. md5() is used only as an index key, not for
-- security; the resolver also requires exact full old_slug equality.

create table if not exists public.product_slug_redirects (
  old_slug_key char(32) primary key,
  old_slug text not null,
  product_id uuid not null references public.marketplace_products(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  constraint product_slug_redirects_key_format check (old_slug_key ~ '^[0-9a-f]{32}$'),
  constraint product_slug_redirects_nonempty_slug check (char_length(old_slug) > 0)
);

create index if not exists product_slug_redirects_product_id_idx
  on public.product_slug_redirects(product_id);

alter table public.product_slug_redirects enable row level security;

revoke all on table public.product_slug_redirects from anon;
revoke all on table public.product_slug_redirects from authenticated;
grant select on table public.product_slug_redirects to service_role;

-- No Data API table-read policy is needed. The product resolver invokes this
-- function only through the server-only service-role client.
create or replace function public.resolve_product_slug_redirect(_old_slug text)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select r.product_id
  from public.product_slug_redirects r
  where r.old_slug_key = md5(_old_slug)
    and r.old_slug = _old_slug
  limit 1
$$;

revoke all on function public.resolve_product_slug_redirect(text) from public;
revoke all on function public.resolve_product_slug_redirect(text) from anon;
revoke all on function public.resolve_product_slug_redirect(text) from authenticated;
grant execute on function public.resolve_product_slug_redirect(text) to service_role;
