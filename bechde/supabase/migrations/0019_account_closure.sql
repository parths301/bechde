-- Closing an account.
--
-- The privacy policy already promises DPDP erasure "within 30 days" and points at a
-- grievance mailbox; nothing in the product could actually do it, so the promise had
-- no mechanism behind it. This is that mechanism.
--
-- It anonymises rather than deletes, for a specific reason. profiles.user_id is
-- `references auth.users on delete cascade`, and listings/chats/messages all cascade
-- off profiles.id — so calling auth.admin.deleteUser() would take the *counterparty's*
-- entire chat history with it. One person exercising their erasure right must not
-- destroy another person's records. README §3.5's "status over delete" says the same thing
-- for a smaller reason.
--
-- What actually goes: the name, bio, location, email on the profile, plus saved items,
-- saved searches and blocks. What stays: message bodies, which are the other party's
-- record of a deal and which the policy already reserves ("data relating to a reported
-- fraud"). The sender of those messages is now anonymous, which is the erasure that
-- matters here.

alter table public.profiles
  add column if not exists closed_at timestamptz;

create or replace function public.close_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := public.current_profile_id();
begin
  if v_id is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  update public.listings
     set status = 'removed'
   where seller_id = v_id
     and status = 'active';

  delete from public.saved_items    where user_id    = v_id;
  delete from public.saved_searches where user_id    = v_id;
  delete from public.blocks         where blocker_id = v_id or blocked_id = v_id;

  update public.profiles
     set name          = 'Deleted user',
         initial       = '·',
         bio           = null,
         email         = null,
         lat           = null,
         lng           = null,
         neighbourhood = null,
         closed_at     = now()
   where id = v_id;
end;
$$;

-- Callable only by the account's own owner: it takes no arguments and resolves the
-- profile from auth.uid(), so there is no id to forge.
grant execute on function public.close_my_account() to authenticated;

-- A closed profile shouldn't be re-animated by signing up again on the same address.
-- handle_new_user() links a new auth user to an existing profile row by email; email
-- is nulled above, so the link can't be made. This index documents the intent and
-- keeps the lookup honest if that function ever changes.
create index if not exists profiles_closed_idx on public.profiles (closed_at)
  where closed_at is not null;
