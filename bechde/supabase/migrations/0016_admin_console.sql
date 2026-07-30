-- Admin console — moderation powers, and a record of every one of them.
--
-- Before this migration an admin could do exactly two things: withdraw a reported
-- listing and mark a report reviewed. Neither was recorded, so there was no way to
-- answer "who changed this, and to what" — which the DPDP Act's correction and
-- access rights require us to be able to answer.
--
-- The design rule here, and the reason this file is longer than a few `or is_admin()`
-- clauses would be: **the audit row is written by the same function that makes the
-- change, inside the same transaction.** Widening `profiles_update` with `or
-- is_admin()` would have been three lines, but it would also let an admin rename
-- anyone through plain PostgREST with nothing written down. Logging you have to
-- remember to do is logging that eventually doesn't happen.
--
-- What this does NOT cover: the service-role key still bypasses all of it. This is a
-- record of admins acting in the app, not of everything that can touch the database.

-- ---------------------------------------------------------------------------
-- The log itself.
--
-- `authenticated` gets SELECT only, and even that is narrowed to admins by RLS.
-- There is deliberately no insert/update/delete policy and no grant: the only way a
-- row gets in here is a SECURITY DEFINER function below, running as the owner.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_actions (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid not null references public.profiles(id) on delete set null,
  action        text not null,
  target_table  text not null,
  target_id     text not null,
  before        jsonb,
  after         jsonb,
  -- Required. An entry that doesn't say why is barely better than no entry.
  reason        text not null check (length(btrim(reason)) >= 3),
  created_at    timestamptz not null default now()
);

create index if not exists admin_actions_created_idx on public.admin_actions (created_at desc);
create index if not exists admin_actions_actor_idx   on public.admin_actions (actor_id);
create index if not exists admin_actions_target_idx  on public.admin_actions (target_table, target_id);

alter table public.admin_actions enable row level security;

revoke all on public.admin_actions from anon, authenticated;
grant select on public.admin_actions to authenticated;

drop policy if exists admin_actions_read on public.admin_actions;
create policy admin_actions_read on public.admin_actions for select
  using (public.is_admin());

-- Internal. Not granted to anyone — callable only from the functions below, which
-- run as the owner. Returns nothing; it either records or the transaction dies.
create or replace function public.log_admin_action(
  p_action text,
  p_table  text,
  p_id     text,
  p_before jsonb,
  p_after  jsonb,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_actions (actor_id, action, target_table, target_id, before, after, reason)
  values (public.current_profile_id(), p_action, p_table, p_id, p_before, p_after, p_reason);
end;
$$;

revoke all on function public.log_admin_action(text, text, text, jsonb, jsonb, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Suspension. A blunter instrument than blocking: blocking is one person's
-- preference, suspension is ours, so it's enforced on writes as well as reads.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_reason text;

-- profiles is world-readable, so this needn't be SECURITY DEFINER the way
-- is_blocked_by() must be — but keeping the shape identical makes the policies below
-- read the same as the ones in 0004_safety.sql.
create or replace function public.is_suspended(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select suspended_at is not null from public.profiles where id = p), false)
$$;

grant execute on function public.is_suspended(uuid) to anon, authenticated;

-- Hide a suspended seller's listings from everyone except themselves and admins.
-- Rebuilt in full rather than patched: 0004's block clause has to survive.
drop policy if exists listings_read on public.listings;
create policy listings_read on public.listings for select
  using (
    not exists (
      select 1 from public.blocks b
      where b.blocker_id = public.current_profile_id()
        and b.blocked_id = listings.seller_id
    )
    and (
      not public.is_suspended(listings.seller_id)
      or listings.seller_id = public.current_profile_id()
      or public.is_admin()
    )
  );

-- A suspended account can read, but cannot post, message or offer.
drop policy if exists listings_insert on public.listings;
create policy listings_insert on public.listings for insert
  with check (
    seller_id = public.current_profile_id()
    and not public.is_suspended(public.current_profile_id())
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert
  with check (
    sender_id = public.current_profile_id()
    and not public.is_suspended(public.current_profile_id())
    and exists (
      select 1 from public.chats c
      where c.id = chat_id
        and public.current_profile_id() in (c.buyer_id, c.seller_id)
        and not public.is_blocked_by(c.buyer_id)
        and not public.is_blocked_by(c.seller_id)
    )
  );

drop policy if exists offers_insert on public.offers;
create policy offers_insert on public.offers for insert
  with check (
    from_id = public.current_profile_id()
    and not public.is_suspended(public.current_profile_id())
    and exists (
      select 1 from public.chats c
      where c.id = chat_id
        and public.current_profile_id() in (c.buyer_id, c.seller_id)
        and not public.is_blocked_by(c.buyer_id)
        and not public.is_blocked_by(c.seller_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Reports gain an outcome trail of their own. `status` alone couldn't say who
-- closed a report or when.
-- ---------------------------------------------------------------------------
alter table public.reports
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null,
  add column if not exists resolved_at timestamptz;

-- Admins may read every profile column they need for the console; profiles_read is
-- already `using (true)`, so nothing to widen there. profiles_update is deliberately
-- left alone — see the header.

-- ---------------------------------------------------------------------------
-- The admin write API.
--
-- Each function: refuse a non-admin, snapshot `before`, apply a whitelisted patch,
-- snapshot `after`, log. The `case when patch ? 'key'` idiom rather than coalesce is
-- so that clearing a field to null is expressible — coalesce would silently ignore it.
-- ---------------------------------------------------------------------------

create or replace function public.admin_update_listing(
  p_id     text,
  p_patch  jsonb,
  p_reason text
) returns public.listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_row    public.listings;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select to_jsonb(l) into v_before from public.listings l where l.id = p_id;
  if v_before is null then
    raise exception 'no such listing: %', p_id using errcode = 'P0002';
  end if;

  update public.listings set
    name          = case when p_patch ? 'name'          then p_patch->>'name'                    else name          end,
    label         = case when p_patch ? 'label'         then p_patch->>'label'                   else label         end,
    price         = case when p_patch ? 'price'         then p_patch->>'price'                   else price         end,
    category      = case when p_patch ? 'category'      then p_patch->>'category'                else category      end,
    note          = case when p_patch ? 'note'          then p_patch->>'note'                    else note          end,
    negotiable    = case when p_patch ? 'negotiable'    then (p_patch->>'negotiable')::boolean   else negotiable    end,
    neighbourhood = case when p_patch ? 'neighbourhood' then p_patch->>'neighbourhood'           else neighbourhood end,
    pickup        = case when p_patch ? 'pickup'        then p_patch->>'pickup'                  else pickup        end,
    lat           = case when p_patch ? 'lat'           then (p_patch->>'lat')::double precision else lat           end,
    lng           = case when p_patch ? 'lng'           then (p_patch->>'lng')::double precision else lng           end,
    public_spot   = case when p_patch ? 'public_spot'   then (p_patch->>'public_spot')::boolean  else public_spot   end,
    status        = case when p_patch ? 'status'        then p_patch->>'status'                  else status        end,
    story         = case when p_patch ? 'story'         then p_patch->'story'                    else story         end,
    facts         = case when p_patch ? 'facts'         then p_patch->'facts'                    else facts         end
  where id = p_id
  returning * into v_row;

  perform public.log_admin_action('listing.update', 'listings', p_id, v_before, to_jsonb(v_row), p_reason);
  return v_row;
end;
$$;

grant execute on function public.admin_update_listing(text, jsonb, text) to authenticated;

create or replace function public.admin_update_profile(
  p_id     uuid,
  p_patch  jsonb,
  p_reason text
) returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_row    public.profiles;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select to_jsonb(p) into v_before from public.profiles p where p.id = p_id;
  if v_before is null then
    raise exception 'no such profile: %', p_id using errcode = 'P0002';
  end if;

  -- Name, initial, colour and bio only. The derived stats (rating_avg, sold,
  -- reply_time) are trigger-owned per the "derived, never written" rule in README §3.5 —
  -- an admin editing a rating by hand would be inventing a number.
  update public.profiles set
    name    = case when p_patch ? 'name'    then p_patch->>'name'    else name    end,
    initial = case when p_patch ? 'initial' then p_patch->>'initial' else initial end,
    color   = case when p_patch ? 'color'   then p_patch->>'color'   else color   end,
    bio     = case when p_patch ? 'bio'     then p_patch->>'bio'     else bio     end
  where id = p_id
  returning * into v_row;

  perform public.log_admin_action('profile.update', 'profiles', p_id::text, v_before, to_jsonb(v_row), p_reason);
  return v_row;
end;
$$;

grant execute on function public.admin_update_profile(uuid, jsonb, text) to authenticated;

create or replace function public.admin_set_suspension(
  p_id       uuid,
  p_suspend  boolean,
  p_reason   text
) returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_row    public.profiles;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_id = public.current_profile_id() then
    raise exception 'you cannot suspend yourself' using errcode = '22023';
  end if;

  select to_jsonb(p) into v_before from public.profiles p where p.id = p_id;
  if v_before is null then
    raise exception 'no such profile: %', p_id using errcode = 'P0002';
  end if;

  update public.profiles set
    suspended_at     = case when p_suspend then now() else null end,
    suspended_reason = case when p_suspend then p_reason else null end
  where id = p_id
  returning * into v_row;

  perform public.log_admin_action(
    case when p_suspend then 'profile.suspend' else 'profile.unsuspend' end,
    'profiles', p_id::text, v_before, to_jsonb(v_row), p_reason);
  return v_row;
end;
$$;

grant execute on function public.admin_set_suspension(uuid, boolean, text) to authenticated;

-- Reviews: 0011 let people *report* a review but left `reviews_update` scoped to its
-- author, so a reported review had no possible outcome. Removal is a delete rather
-- than a status because refresh_rating() derives the subject's ★ from the rows that
-- exist — leaving a hidden row would keep an abusive rating in the average.
create or replace function public.admin_remove_review(
  p_id     uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select to_jsonb(r) into v_before from public.reviews r where r.id = p_id;
  if v_before is null then
    raise exception 'no such review: %', p_id using errcode = 'P0002';
  end if;

  delete from public.reviews where id = p_id;
  perform public.log_admin_action('review.remove', 'reviews', p_id::text, v_before, null, p_reason);
end;
$$;

grant execute on function public.admin_remove_review(uuid, text) to authenticated;

create or replace function public.admin_set_report_status(
  p_id     uuid,
  p_status text,
  p_reason text
) returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_row    public.reports;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_status not in ('open', 'reviewed', 'actioned') then
    raise exception 'bad report status: %', p_status using errcode = '22023';
  end if;

  select to_jsonb(r) into v_before from public.reports r where r.id = p_id;
  if v_before is null then
    raise exception 'no such report: %', p_id using errcode = 'P0002';
  end if;

  update public.reports set
    status      = p_status,
    resolved_by = case when p_status = 'open' then null else public.current_profile_id() end,
    resolved_at = case when p_status = 'open' then null else now() end
  where id = p_id
  returning * into v_row;

  perform public.log_admin_action('report.' || p_status, 'reports', p_id::text, v_before, to_jsonb(v_row), p_reason);
  return v_row;
end;
$$;

grant execute on function public.admin_set_report_status(uuid, text, text) to authenticated;
