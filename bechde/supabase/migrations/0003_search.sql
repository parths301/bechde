-- Phase 6 — search & discovery.
-- Ranked, typo-tolerant text search over listings, a numeric price for range filters,
-- and saved searches.

create extension if not exists pg_trgm; -- word_similarity() for fuzzy matches

-- ---------------------------------------------------------------------------
-- Numeric price. `price` stays the formatted display string ("₹3,200"); this is
-- the comparable form, kept in sync automatically.
-- ---------------------------------------------------------------------------
alter table public.listings
  add column if not exists price_num integer
  generated always as (nullif(regexp_replace(price, '[^0-9]', '', 'g'), '')::integer) stored;

create index if not exists listings_price_num_idx on public.listings (price_num);

-- ---------------------------------------------------------------------------
-- Full-text search vector. Name and label matter most, the story note least.
-- ---------------------------------------------------------------------------
alter table public.listings
  add column if not exists search tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(label, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(neighbourhood, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(note, '')), 'D')
  ) stored;

create index if not exists listings_search_idx on public.listings using gin (search);
create index if not exists listings_trgm_idx on public.listings using gin (name gin_trgm_ops, label gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- search_listings(q) — ranked active listings.
--   • empty q          → everything active (plain browse)
--   • full-text hit    → ranked by ts_rank_cd
--   • word-similarity  → "gitar" still finds the Yamaha guitar
-- Not security definer, so the normal listings RLS still applies. Returns
-- `setof public.listings` so callers can embed seller/listing_images on it.
-- ---------------------------------------------------------------------------
create or replace function public.search_listings(q text default '')
returns setof public.listings
language sql
stable
set search_path = public
as $$
  with query as (
    select
      btrim(coalesce(q, '')) as raw,
      -- guard the empty case: websearch_to_tsquery('') warns on every row
      case
        when btrim(coalesce(q, '')) = '' then null::tsquery
        else websearch_to_tsquery('english', btrim(coalesce(q, '')))
      end as tsq
  )
  select l.*
  from public.listings l, query
  where l.status = 'active'
    and (
      query.raw = ''
      or l.search @@ query.tsq
      -- Fuzzy fallback, compared explicitly rather than with the `<%` operator: its
      -- threshold lives in a GUC only a superuser can set, and Supabase's `postgres`
      -- role isn't one. 0.4 catches real typos — word_similarity('gitar', 'Yamaha
      -- F310 acoustic guitar') is 0.5 — while unrelated words score 0. This branch
      -- can't use the trigram index, which is fine at marketplace scale.
      or greatest(
           word_similarity(query.raw, l.name),
           word_similarity(query.raw, coalesce(l.label, ''))
         ) > 0.4
    )
  order by
    ts_rank_cd(l.search, query.tsq) desc nulls last,
    greatest(
      word_similarity(query.raw, l.name),
      word_similarity(query.raw, coalesce(l.label, ''))
    ) desc,
    l.created_at desc
$$;

grant execute on function public.search_listings(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- saved_searches — a person's stored filter sets. Private to the owner.
-- ---------------------------------------------------------------------------
create table if not exists public.saved_searches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  q           text not null default '',
  category    text,                          -- null / 'All' = any category
  radius_km   double precision,
  min_price   integer,
  max_price   integer,
  created_at  timestamptz not null default now()
);

create index if not exists saved_searches_user_idx on public.saved_searches (user_id);

alter table public.saved_searches enable row level security;

drop policy if exists saved_searches_rw on public.saved_searches;
create policy saved_searches_rw on public.saved_searches for all
  using (user_id = public.current_profile_id())
  with check (user_id = public.current_profile_id());
