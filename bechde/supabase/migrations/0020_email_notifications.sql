-- Email notifications: preferences, unsubscribe, and a per-message send stamp.
--
-- The saved-search notifier that P1-2 marked done never sent anything: it logged
-- "[EMAIL] To: …" to the console and then stamped last_notified_at as though it had.
-- The sender is real now (src/lib/email), and this is the state it needs.
--
-- Nothing here is opt-in-by-silence. Both switches default to true because a
-- marketplace where a seller never learns a buyer replied is broken — but the
-- unsubscribe path works without signing in, which is the part that makes that
-- defensible, and is required of any bulk sender.

alter table public.profiles
  add column if not exists notify_messages       boolean not null default true,
  add column if not exists notify_saved_searches boolean not null default true;

-- ---------------------------------------------------------------------------
-- The unsubscribe token lives in its own table, not on profiles.
--
-- It's a credential: whoever holds it can silence that person's mail without signing
-- in. profiles is world-readable (`profiles_read using (true)`), so a column there
-- would be one `select unsubscribe_token from profiles` away from handing out
-- everyone's. Column-level grants can hide it, but they also break every
-- `profiles(*)` embed in the app — LISTING_SELECT is exactly that — so the column
-- would have been protected at the cost of the product.
--
-- A separate table with RLS on and **no policies at all** is the honest shape: no
-- browser role can read it under any query, while the SECURITY DEFINER function below
-- and the service-role cron jobs still can.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_tokens (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  token      uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.notification_tokens enable row level security;
revoke all on public.notification_tokens from anon, authenticated;

insert into public.notification_tokens (profile_id)
select id from public.profiles
on conflict (profile_id) do nothing;

create or replace function public.ensure_notification_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_tokens (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_notification_token on public.profiles;
create trigger profiles_notification_token
  after insert on public.profiles
  for each row execute function public.ensure_notification_token();

-- ---------------------------------------------------------------------------
-- Which messages have already been mailed about.
--
-- A stamp per message rather than a per-user "last emailed at": the latter loses
-- anything that arrives in the same second as a send, and the whole value of the
-- feature is reaching someone about the message they didn't see.
-- ---------------------------------------------------------------------------
alter table public.messages
  add column if not exists notified_at timestamptz;

create index if not exists messages_unnotified_idx
  on public.messages (created_at)
  where notified_at is null;

-- ---------------------------------------------------------------------------
-- Unsubscribing without signing in.
--
-- SECURITY DEFINER because the caller is anonymous by definition: they clicked a link
-- in an email, possibly on a device that has never signed in. The token is the
-- credential, and it grants exactly one authority — turn this person's email off.
-- ---------------------------------------------------------------------------
create or replace function public.unsubscribe_by_token(p_token uuid, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid;
begin
  if p_kind not in ('messages', 'saved_searches', 'all') then
    raise exception 'unknown notification kind: %', p_kind using errcode = '22023';
  end if;

  select profile_id into v_profile from public.notification_tokens where token = p_token;
  if v_profile is null then
    return false;
  end if;

  update public.profiles
     set notify_messages       = case when p_kind in ('messages', 'all') then false else notify_messages end,
         notify_saved_searches = case when p_kind in ('saved_searches', 'all') then false else notify_saved_searches end
   where id = v_profile;

  return true;
end;
$$;

grant execute on function public.unsubscribe_by_token(uuid, text) to anon, authenticated;
