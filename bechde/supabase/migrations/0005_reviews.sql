-- Phase 9 — reputation.
-- Reviews after a completed deal, aggregates maintained by trigger, and read
-- receipts so the chat badge can stop lying.

-- ---------------------------------------------------------------------------
-- profiles: real, derived reputation.
-- The legacy `rating` text column ("★ 4.9") is left alone but no longer read.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists rating_avg   numeric(3,2);
alter table public.profiles add column if not exists rating_count integer not null default 0;
alter table public.profiles add column if not exists bio          text;

-- ---------------------------------------------------------------------------
-- reviews — one per side of a completed deal.
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  offer_id     uuid not null references public.offers(id) on delete cascade,
  chat_id      text not null references public.chats(id) on delete cascade,
  listing_id   text not null references public.listings(id) on delete cascade,
  reviewer_id  uuid not null references public.profiles(id) on delete cascade,
  subject_id   uuid not null references public.profiles(id) on delete cascade,
  rating       integer not null check (rating between 1 and 5),
  body         text,
  created_at   timestamptz not null default now(),
  unique (offer_id, reviewer_id),
  constraint reviews_not_self check (reviewer_id <> subject_id)
);

create index if not exists reviews_subject_idx on public.reviews (subject_id, created_at desc);

alter table public.reviews enable row level security;

-- Ratings are public — they're the whole point of a reputation.
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using (true);

-- You may only review the other party of a deal you were in, once it's accepted.
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert
  with check (
    reviewer_id = public.current_profile_id()
    and exists (
      select 1
      from public.offers o
      join public.chats c on c.id = o.chat_id
      where o.id = offer_id
        and o.status = 'accepted'
        and c.id = chat_id
        and public.current_profile_id() in (c.buyer_id, c.seller_id)
        and subject_id in (c.buyer_id, c.seller_id)
        and subject_id <> public.current_profile_id()
    )
  );

-- ---------------------------------------------------------------------------
-- chat_reads — per-person read receipts, private to the reader.
-- ---------------------------------------------------------------------------
create table if not exists public.chat_reads (
  chat_id       text not null references public.chats(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  primary key (chat_id, profile_id)
);

alter table public.chat_reads enable row level security;

drop policy if exists chat_reads_rw on public.chat_reads;
create policy chat_reads_rw on public.chat_reads for all
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

-- ---------------------------------------------------------------------------
-- Derived aggregates.
-- These run as triggers rather than being computed on read because `listings`
-- embeds `profiles` through the listing select — a view can't be joined there.
-- SECURITY DEFINER so a trigger fired by user A can still recompute user B's
-- numbers; each function only ever writes aggregate columns.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_rating(p uuid)
returns void language sql security definer set search_path = public as $$
  update public.profiles pr
     set rating_avg   = agg.avg_rating,
         rating_count = agg.n
    from (
      select round(avg(rating)::numeric, 2) as avg_rating, count(*)::int as n
        from public.reviews where subject_id = p
    ) agg
   where pr.id = p;
$$;

create or replace function public.on_review_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_rating(coalesce(new.subject_id, old.subject_id));
  return null;
end; $$;

drop trigger if exists reviews_refresh_rating on public.reviews;
create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.on_review_change();

-- sold count -----------------------------------------------------------------
create or replace function public.refresh_sold(p uuid)
returns void language sql security definer set search_path = public as $$
  update public.profiles
     set sold = (select count(*) from public.listings where seller_id = p and status = 'sold')
   where id = p;
$$;

create or replace function public.on_listing_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_sold(new.seller_id);
  if tg_op = 'UPDATE' and old.seller_id <> new.seller_id then
    perform public.refresh_sold(old.seller_id);
  end if;
  return null;
end; $$;

drop trigger if exists listings_refresh_sold on public.listings;
create trigger listings_refresh_sold
  after insert or update of status, seller_id on public.listings
  for each row execute function public.on_listing_status_change();

-- reply time -----------------------------------------------------------------
-- Average minutes between the other party's message and this profile's next
-- reply, over their 50 most recent replies. Bounded so the trigger stays cheap.
create or replace function public.refresh_reply_time(p uuid)
returns void language plpgsql security definer set search_path = public as $$
declare mins numeric;
begin
  with mine as (
    select m.chat_id, m.created_at,
           (select max(prev.created_at)
              from public.messages prev
             where prev.chat_id = m.chat_id
               and prev.sender_id <> p
               and prev.created_at < m.created_at) as asked_at
      from public.messages m
     where m.sender_id = p
     order by m.created_at desc
     limit 50
  )
  select avg(extract(epoch from (created_at - asked_at)) / 60)
    into mins
    from mine
   where asked_at is not null;

  update public.profiles
     set reply_time = case
       when mins is null then null
       when mins < 1    then 'under a min'
       when mins < 60   then round(mins)::text || ' min'
       when mins < 1440 then round(mins / 60)::text || ' hr'
       else round(mins / 1440)::text || ' days'
     end
   where id = p;
end; $$;

create or replace function public.on_message_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_reply_time(new.sender_id);
  return null;
end; $$;

drop trigger if exists messages_refresh_reply_time on public.messages;
create trigger messages_refresh_reply_time
  after insert on public.messages
  for each row execute function public.on_message_insert();

-- ---------------------------------------------------------------------------
-- How many *other* people have a saved search this listing would match?
-- saved_searches is private to its owner, so counting across users needs a
-- definer function. It returns a bare count — never anyone's search terms.
-- ---------------------------------------------------------------------------
create or replace function public.matching_saved_search_count(q text, cat text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.saved_searches s
   where s.user_id is distinct from public.current_profile_id()
     and (s.category is null or s.category = 'All' or s.category = cat)
     and (
       s.q = ''
       or to_tsvector('english', coalesce(q, '')) @@ websearch_to_tsquery('english', s.q)
       or word_similarity(s.q, coalesce(q, '')) > 0.4
     );
$$;

grant execute on function public.matching_saved_search_count(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill for rows that predate the triggers.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select id from public.profiles loop
    perform public.refresh_rating(r.id);
    perform public.refresh_sold(r.id);
    perform public.refresh_reply_time(r.id);
  end loop;
end $$;
