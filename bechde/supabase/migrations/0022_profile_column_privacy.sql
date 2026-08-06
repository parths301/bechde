-- Lock down which columns of `profiles` are world-readable.
--
-- `profiles_read using (true)` (0001) makes every ROW visible to anon/authenticated — by
-- design, profile cards are public. But nothing has ever restricted which COLUMNS of a
-- visible row are readable, so `email`, `is_admin`, `suspended_reason`, `notify_messages`
-- etc. have been readable by anyone, unauthenticated, since day one: proven live against
-- production with a plain curl using the public anon key, no session —
--   select id,name,email,is_admin,suspended_reason,notify_messages from profiles
-- returned every real user's row. `LISTING_SELECT`'s `profiles(*)` embed leaks it passively
-- on every listing page load; the REST API leaks it to anyone who reads the anon key out of
-- the client bundle, which is meant to be public — that part isn't the bug.
--
-- Fixing only the app's own select statements doesn't close this: someone can always query
-- PostgREST directly. The actual boundary is a Postgres column-level GRANT, because RLS
-- alone can't express "you may read your own row's private columns but not the same columns
-- on someone else's row" — RLS is row-scoped, grants are column-scoped, and "my own private
-- data" needs both: a public column allowlist for everyone, and a SECURITY DEFINER function
-- (the same shape as notification_tokens' access and every admin_* RPC below) for the owner
-- to read their own full row despite the grant.

-- ---------------------------------------------------------------------------
-- The public allowlist. Matches exactly what ProductClient.tsx / ListingCard.tsx render
-- for a seller — nothing more.
-- ---------------------------------------------------------------------------
revoke select on public.profiles from anon, authenticated;
grant select (id, name, initial, color, rating_avg, rating_count, sold, reply_time, bio, created_at)
  on public.profiles to anon, authenticated;

-- ---------------------------------------------------------------------------
-- "Read my own full row" — the private columns aren't in the grant above, so this has to
-- run as the table owner. Takes no argument and resolves from auth.uid(), same reasoning
-- as close_my_account(): there's no id to forge.
-- ---------------------------------------------------------------------------
create or replace function public.my_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where user_id = auth.uid()
$$;

revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin console reads that touch private columns. Same is_admin() gate as every other
-- admin_* RPC in 0016 — these are reads, so there's no admin_actions row to write.
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_profiles(p_query text default null)
returns setof public.profiles
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
    select * from public.profiles p
    where p_query is null
       or p.name  ilike '%' || p_query || '%'
       or p.email ilike '%' || p_query || '%'
    order by p.created_at desc
    limit 60;
end;
$$;

revoke all on function public.admin_list_profiles(text) from public, anon;
grant execute on function public.admin_list_profiles(text) to authenticated;

create or replace function public.admin_profile_counts()
returns table (suspended bigint, newbies bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  return query
    select
      (select count(*) from public.profiles where suspended_at is not null),
      (select count(*) from public.profiles where created_at >= now() - interval '7 days');
end;
$$;

revoke all on function public.admin_profile_counts() from public, anon;
grant execute on function public.admin_profile_counts() to authenticated;
