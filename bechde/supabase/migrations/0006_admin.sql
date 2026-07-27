-- Phase 10 — admin moderation + photo size cap.
-- A lightweight admin flag on profiles so reports have someone reading them,
-- and a file-size limit on listing photos so phone cameras don't blow up storage.

-- ---------------------------------------------------------------------------
-- Admin flag. Deliberately simple: a boolean on the profile, checked by a
-- SECURITY DEFINER helper the same way is_blocked_by() works.  Setting it is
-- a manual SQL step — there's no self-service admin creation.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = public.current_profile_id()),
    false
  )
$$;

grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Reports: admins can read all of them and update their status.
-- Regular users still see only their own (reports_read_own from 0004_safety).
-- ---------------------------------------------------------------------------
create policy reports_read_admin on public.reports for select
  using (public.is_admin());

create policy reports_update_admin on public.reports for update
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Listings: admins can update any listing (to withdraw reported ones).
-- The original policy only let the seller update their own row — an admin
-- calling setListingStatus('removed') on someone else's listing silently
-- returned zero rows.
-- ---------------------------------------------------------------------------
drop policy if exists listings_update on public.listings;
create policy listings_update on public.listings for update
  using (seller_id = public.current_profile_id() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: cap listing photos at 2 MB. Client-side compression should land
-- well under this, but the server-side cap stops anything bypassing the UI.
-- ---------------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 2097152
 where id = 'listing-images';
