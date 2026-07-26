-- Phase 7 — trust & safety.
-- Reporting, blocking, and taking a listing down without destroying its chats.

-- ---------------------------------------------------------------------------
-- Listings can now be withdrawn. Deleting the row would cascade away the chats
-- and messages attached to it, so "remove" is a status, not a delete.
-- ---------------------------------------------------------------------------
alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings
  add constraint listings_status_check check (status in ('active', 'sold', 'removed'));

-- ---------------------------------------------------------------------------
-- reports — a listing or a person, flagged by someone. Write-only from the
-- app's point of view: reporters see their own, nobody else does.
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references public.profiles(id) on delete cascade,
  listing_id    text references public.listings(id) on delete cascade,
  profile_id    uuid references public.profiles(id) on delete cascade,
  reason        text not null check (reason in (
                  'prohibited', 'scam', 'counterfeit', 'offensive', 'wrong-category', 'other')),
  details       text,
  status        text not null default 'open' check (status in ('open', 'reviewed', 'actioned')),
  created_at    timestamptz not null default now(),
  -- a report must point at something
  constraint reports_target_check check (listing_id is not null or profile_id is not null)
);

create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists reports_listing_idx  on public.reports (listing_id);

alter table public.reports enable row level security;

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert
  with check (reporter_id = public.current_profile_id());

drop policy if exists reports_read_own on public.reports;
create policy reports_read_own on public.reports for select
  using (reporter_id = public.current_profile_id());

-- ---------------------------------------------------------------------------
-- blocks — "I don't want to see this person". Private to the blocker.
-- ---------------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id  uuid not null references public.profiles(id) on delete cascade,
  blocked_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

drop policy if exists blocks_rw on public.blocks;
create policy blocks_rw on public.blocks for all
  using (blocker_id = public.current_profile_id())
  with check (blocker_id = public.current_profile_id());

-- ---------------------------------------------------------------------------
-- Enforce blocking in the database, not just the UI.
-- current_profile_id() is null for anonymous readers, so these `not exists`
-- clauses stay true for them and public browsing is unaffected.
-- ---------------------------------------------------------------------------
drop policy if exists listings_read on public.listings;
create policy listings_read on public.listings for select
  using (
    not exists (
      select 1 from public.blocks b
      where b.blocker_id = public.current_profile_id()
        and b.blocked_id = listings.seller_id
    )
  );

drop policy if exists chats_read on public.chats;
create policy chats_read on public.chats for select
  using (
    public.current_profile_id() in (buyer_id, seller_id)
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = public.current_profile_id()
        and b.blocked_id in (chats.buyer_id, chats.seller_id)
    )
  );

-- "Has `other` blocked me?" — must be SECURITY DEFINER: blocks is RLS-scoped to the
-- blocker, so a sender checking whether they've been blocked would read zero rows and
-- always conclude "no". Returns only a boolean about the caller's own standing.
create or replace function public.is_blocked_by(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks b
    where b.blocker_id = other
      and b.blocked_id = public.current_profile_id()
  )
$$;

grant execute on function public.is_blocked_by(uuid) to authenticated;

-- Someone who blocked you can't be messaged by you.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert
  with check (
    sender_id = public.current_profile_id()
    and exists (
      select 1 from public.chats c
      where c.id = chat_id
        and public.current_profile_id() in (c.buyer_id, c.seller_id)
        and not public.is_blocked_by(c.buyer_id)
        and not public.is_blocked_by(c.seller_id)
    )
  );

-- Offers are messages by another name — same rule.
drop policy if exists offers_insert on public.offers;
create policy offers_insert on public.offers for insert
  with check (
    from_id = public.current_profile_id()
    and exists (
      select 1 from public.chats c
      where c.id = chat_id
        and public.current_profile_id() in (c.buyer_id, c.seller_id)
        and not public.is_blocked_by(c.buyer_id)
        and not public.is_blocked_by(c.seller_id)
    )
  );
