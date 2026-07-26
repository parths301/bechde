-- Bech De — initial schema, RLS, storage, realtime
-- Mirrors the prototype's Item/Seller/ChatThread shapes in src/lib/data.ts.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- profiles  (a person; optionally linked to an auth user)
--   Seed sellers have user_id = null; real sign-ups get a linked row.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete cascade,
  name        text not null,
  initial     text,
  color       text,                          -- avatar colour (hex)
  rating      text,                          -- e.g. "★ 4.9"
  sold        integer not null default 0,
  reply_time  text,                          -- e.g. "10 min"
  phone       text,
  email       text,
  lat         double precision,
  lng         double precision,
  created_at  timestamptz not null default now()
);

-- Resolve the current user's profile id from their auth session.
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles where user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- categories  (lookup)
-- ---------------------------------------------------------------------------
create table public.categories (
  name  text primary key,
  icon  text
);

-- ---------------------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------------------
create table public.listings (
  id            text primary key default gen_random_uuid()::text, -- slug for seed, uuid for new
  seller_id     uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  label         text,                        -- short radar-bubble label
  price         text not null,               -- formatted, e.g. "₹3,200"
  category      text not null references public.categories(name),
  note          text,
  negotiable    boolean not null default true,
  neighbourhood text,
  pickup        text,
  lat           double precision,
  lng           double precision,
  km            double precision,            -- recomputed from real distance in Phase 4
  dist          text,
  angle         text,
  listed_ago    text,
  status        text not null default 'active' check (status in ('active','sold')),
  story         jsonb not null default '[]'::jsonb,
  facts         jsonb not null default '[]'::jsonb,
  home          jsonb,                        -- radar hero position (optional)
  map           jsonb,                        -- full-map position (optional)
  created_at    timestamptz not null default now()
);

create index listings_seller_idx   on public.listings (seller_id);
create index listings_category_idx on public.listings (category);
create index listings_status_idx   on public.listings (status);

-- ---------------------------------------------------------------------------
-- listing_images
-- ---------------------------------------------------------------------------
create table public.listing_images (
  id          uuid primary key default gen_random_uuid(),
  listing_id  text not null references public.listings(id) on delete cascade,
  url         text not null,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);

create index listing_images_listing_idx on public.listing_images (listing_id);

-- ---------------------------------------------------------------------------
-- saved_items  (likes / wishlist)
-- ---------------------------------------------------------------------------
create table public.saved_items (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  listing_id  text not null references public.listings(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- ---------------------------------------------------------------------------
-- chats  (one thread per buyer<->listing)
-- ---------------------------------------------------------------------------
create table public.chats (
  id          text primary key default gen_random_uuid()::text,
  listing_id  text not null references public.listings(id) on delete cascade,
  buyer_id    uuid not null references public.profiles(id) on delete cascade,
  seller_id   uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index chats_buyer_idx  on public.chats (buyer_id);
create index chats_seller_idx on public.chats (seller_id);

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  chat_id     text not null references public.chats(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);

create index messages_chat_idx on public.messages (chat_id, created_at);

-- ---------------------------------------------------------------------------
-- offers
-- ---------------------------------------------------------------------------
create table public.offers (
  id          uuid primary key default gen_random_uuid(),
  chat_id     text not null references public.chats(id) on delete cascade,
  listing_id  text not null references public.listings(id) on delete cascade,
  from_id     uuid not null references public.profiles(id) on delete cascade,
  amount      text not null,                 -- formatted, e.g. "₹2,900"
  status      text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at  timestamptz not null default now()
);

create index offers_chat_idx on public.offers (chat_id);

-- ===========================================================================
-- Row-Level Security
-- ===========================================================================
alter table public.profiles       enable row level security;
alter table public.categories      enable row level security;
alter table public.listings        enable row level security;
alter table public.listing_images  enable row level security;
alter table public.saved_items     enable row level security;
alter table public.chats           enable row level security;
alter table public.messages        enable row level security;
alter table public.offers          enable row level security;

-- profiles: world-readable; users manage their own row
create policy profiles_read   on public.profiles for select using (true);
create policy profiles_insert on public.profiles for insert with check (user_id = auth.uid());
create policy profiles_update on public.profiles for update using (user_id = auth.uid());

-- categories: world-readable, no public writes
create policy categories_read on public.categories for select using (true);

-- listings: world-readable; owner writes
create policy listings_read   on public.listings for select using (true);
create policy listings_insert on public.listings for insert
  with check (seller_id = public.current_profile_id());
create policy listings_update on public.listings for update
  using (seller_id = public.current_profile_id());
create policy listings_delete on public.listings for delete
  using (seller_id = public.current_profile_id());

-- listing_images: world-readable; owner of the parent listing writes
create policy listing_images_read on public.listing_images for select using (true);
create policy listing_images_write on public.listing_images for all
  using (exists (
    select 1 from public.listings l
    where l.id = listing_id and l.seller_id = public.current_profile_id()
  ))
  with check (exists (
    select 1 from public.listings l
    where l.id = listing_id and l.seller_id = public.current_profile_id()
  ));

-- saved_items: private to the user
create policy saved_items_rw on public.saved_items for all
  using (user_id = public.current_profile_id())
  with check (user_id = public.current_profile_id());

-- chats: visible to participants; buyer opens the thread
create policy chats_read on public.chats for select
  using (public.current_profile_id() in (buyer_id, seller_id));
create policy chats_insert on public.chats for insert
  with check (buyer_id = public.current_profile_id());

-- messages: participants read; participant sends as self
create policy messages_read on public.messages for select
  using (exists (
    select 1 from public.chats c
    where c.id = chat_id
      and public.current_profile_id() in (c.buyer_id, c.seller_id)
  ));
create policy messages_insert on public.messages for insert
  with check (
    sender_id = public.current_profile_id()
    and exists (
      select 1 from public.chats c
      where c.id = chat_id
        and public.current_profile_id() in (c.buyer_id, c.seller_id)
    )
  );

-- offers: participants read; sender creates; participants update status
create policy offers_read on public.offers for select
  using (exists (
    select 1 from public.chats c
    where c.id = chat_id
      and public.current_profile_id() in (c.buyer_id, c.seller_id)
  ));
create policy offers_insert on public.offers for insert
  with check (from_id = public.current_profile_id());
create policy offers_update on public.offers for update
  using (exists (
    select 1 from public.chats c
    where c.id = chat_id
      and public.current_profile_id() in (c.buyer_id, c.seller_id)
  ));

-- ===========================================================================
-- Auto-create a profile when a new auth user signs up
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked int;
begin
  -- If a seeded/existing profile already has this email (e.g. the demo user
  -- aisha@bechde.local), link it to the new auth user instead of duplicating.
  update public.profiles
     set user_id = new.id
   where email = new.email
     and user_id is null;
  get diagnostics linked = row_count;

  if linked = 0 then
    insert into public.profiles (user_id, name, email, initial)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
      new.email,
      upper(left(coalesce(new.raw_user_meta_data->>'name', new.email), 1))
    );
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- Storage: public bucket for listing photos
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

create policy listing_images_public_read on storage.objects for select
  using (bucket_id = 'listing-images');
create policy listing_images_auth_write on storage.objects for insert
  with check (bucket_id = 'listing-images' and auth.role() = 'authenticated');
create policy listing_images_auth_update on storage.objects for update
  using (bucket_id = 'listing-images' and auth.role() = 'authenticated');
create policy listing_images_auth_delete on storage.objects for delete
  using (bucket_id = 'listing-images' and auth.role() = 'authenticated');

-- ===========================================================================
-- Realtime: broadcast messages + offers changes to subscribed clients
-- ===========================================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.offers;
