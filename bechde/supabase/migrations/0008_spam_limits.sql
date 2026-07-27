-- P1-4: Spam and abuse limits

-- 1. Track repeat offenders
alter table public.profiles
  add column if not exists abuse_count integer not null default 0;

-- 2. Trigger function to enforce rate limits
create or replace function public.enforce_rate_limits()
returns trigger
security definer
language plpgsql
set search_path = public
as $$
declare
  recent_count integer;
  limit_count integer;
  interval_time interval;
  profile_id uuid;
begin
  if TG_TABLE_NAME = 'listings' then
    limit_count := 20;
    interval_time := '1 day'::interval;
    profile_id := NEW.seller_id;
    
    select count(*) into recent_count 
    from public.listings 
    where seller_id = profile_id and created_at > now() - interval_time;
    
  elsif TG_TABLE_NAME = 'messages' then
    limit_count := 200;
    interval_time := '1 hour'::interval;
    profile_id := NEW.sender_id;
    
    select count(*) into recent_count 
    from public.messages 
    where sender_id = profile_id and created_at > now() - interval_time;
  end if;

  if recent_count >= limit_count then
    update public.profiles set abuse_count = abuse_count + 1 where id = profile_id;
    raise exception 'Rate limit exceeded for % (Limit: % per %)', TG_TABLE_NAME, limit_count, interval_time;
  end if;

  return NEW;
end;
$$;

drop trigger if exists enforce_rate_limits_listings on public.listings;
create trigger enforce_rate_limits_listings
  before insert on public.listings
  for each row
  execute function public.enforce_rate_limits();

drop trigger if exists enforce_rate_limits_messages on public.messages;
create trigger enforce_rate_limits_messages
  before insert on public.messages
  for each row
  execute function public.enforce_rate_limits();
