-- Editable taxonomy — categories, cities, localities.
--
-- Two problems this fixes, both of which block "an admin can add a category".
--
-- 1. Categories were defined **twice**: as rows in `categories` (the FK target for
--    listings.category) and as a hardcoded array in src/lib/data.ts:517 that actually
--    drives the UI. They agree today only because the same six were written in both
--    places. Adding a row would have changed nothing on screen; adding an array entry
--    would have violated the foreign key. §4.5's "one definition per concept" rule
--    already forbids this — the database becomes the definition, and data.ts's list
--    becomes the seed for it below.
--
-- 2. Cities didn't exist at all. `POPULAR_CITIES` was four hardcoded entries in
--    LocationModal.tsx, and localities were whatever string Nominatim happened to
--    return. Neither could be curated.
--
-- Writes go through the audited RPCs at the bottom, for the reasons in 0016.

-- ---------------------------------------------------------------------------
-- Categories: orderable, retirable, renameable.
-- ---------------------------------------------------------------------------
alter table public.categories
  add column if not exists sort   integer not null default 100,
  add column if not exists active boolean not null default true;

-- Renaming is an UPDATE of a primary key that listings point at. Without ON UPDATE
-- CASCADE the rename is simply refused, so "edit a category" would fail on the one
-- field anybody wants to edit.
alter table public.listings drop constraint if exists listings_category_fkey;
alter table public.listings
  add constraint listings_category_fkey
  foreign key (category) references public.categories(name)
  on update cascade;

-- The categories themselves live here now, not in the demo seed.
--
-- They were only ever created by `npm run seed` upserting homeCategories, which means
-- a production database that (correctly) never runs the demo seed had an empty
-- categories table — and since listings.category is a foreign key onto it, every
-- attempt to post a listing would have been rejected. Taxonomy is app content, not
-- demo data. Order matches data.ts so nothing moves on screen.
insert into public.categories (name, icon, sort) values
  ('Gadgets',    '📱',  10),
  ('Furniture',  '🛋️',  20),
  ('Music',      '🎸',  30),
  ('Fashion',    '👕',  40),
  ('Books',      '📚',  50),
  ('Everything', '✨', 900)
on conflict (name) do update set icon = excluded.icon, sort = excluded.sort;

alter table public.categories enable row level security;

drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select using (true);

revoke insert, update, delete on public.categories from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cities and localities.
--
-- These are curation, not geocoding: Nominatim still resolves whatever a user
-- actually types. What a row here buys you is a *chosen* shortlist — the chips on the
-- location sheet, and the places you're willing to say Bech De covers.
-- ---------------------------------------------------------------------------
create table if not exists public.cities (
  id      text primary key,                     -- slug, e.g. 'bengaluru'
  name    text not null,
  state   text,
  lat     double precision not null,
  lng     double precision not null,
  sort    integer not null default 100,
  active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.localities (
  id       uuid primary key default gen_random_uuid(),
  city_id  text not null references public.cities(id) on delete cascade on update cascade,
  name     text not null,
  lat      double precision not null,
  lng      double precision not null,
  sort     integer not null default 100,
  active   boolean not null default true,
  created_at timestamptz not null default now(),
  unique (city_id, name)
);

create index if not exists localities_city_idx on public.localities (city_id, sort);

alter table public.cities     enable row level security;
alter table public.localities enable row level security;

-- Readable signed out: the location sheet opens before anyone signs in.
drop policy if exists cities_read on public.cities;
create policy cities_read on public.cities for select using (true);

drop policy if exists localities_read on public.localities;
create policy localities_read on public.localities for select using (true);

revoke insert, update, delete on public.cities     from anon, authenticated;
revoke insert, update, delete on public.localities from anon, authenticated;

-- The four that were hardcoded in LocationModal.tsx, split into the city and the
-- locality they conflated ("Bengaluru (Koramangala)" was one string).
insert into public.cities (id, name, state, lat, lng, sort) values
  ('bengaluru', 'Bengaluru', 'Karnataka',   12.9716, 77.5946, 10),
  ('mumbai',    'Mumbai',    'Maharashtra', 19.0760, 72.8777, 20),
  ('delhi',     'Delhi',     'Delhi',       28.6139, 77.2090, 30),
  ('hyderabad', 'Hyderabad', 'Telangana',   17.3850, 78.4867, 40)
on conflict (id) do nothing;

insert into public.localities (city_id, name, lat, lng, sort) values
  ('bengaluru', 'Koramangala', 12.9352, 77.6245, 10),
  ('mumbai',    'Bandra',      19.0596, 72.8295, 10),
  ('hyderabad', 'Hitec City',  17.4435, 78.3772, 10)
on conflict (city_id, name) do nothing;

-- ---------------------------------------------------------------------------
-- Audited admin writes. Same contract as 0016: refuse a non-admin, snapshot,
-- change, log — all in one transaction.
-- ---------------------------------------------------------------------------

create or replace function public.admin_upsert_category(
  p_name   text,
  p_icon   text,
  p_sort   integer,
  p_active boolean,
  p_reason text
) returns public.categories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_row    public.categories;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'a category needs a name' using errcode = '22023';
  end if;

  select to_jsonb(c) into v_before from public.categories c where c.name = p_name;

  insert into public.categories (name, icon, sort, active)
  values (btrim(p_name), p_icon, coalesce(p_sort, 100), coalesce(p_active, true))
  on conflict (name) do update
    set icon = excluded.icon, sort = excluded.sort, active = excluded.active
  returning * into v_row;

  perform public.log_admin_action(
    case when v_before is null then 'category.create' else 'category.update' end,
    'categories', v_row.name, v_before, to_jsonb(v_row), p_reason);
  return v_row;
end;
$$;

grant execute on function public.admin_upsert_category(text, text, integer, boolean, text) to authenticated;

-- Renaming is separate from upsert because it moves a primary key that listings
-- reference; the cascade above carries them across.
create or replace function public.admin_rename_category(
  p_from   text,
  p_to     text,
  p_reason text
) returns public.categories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_row    public.categories;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  select to_jsonb(c) into v_before from public.categories c where c.name = p_from;
  if v_before is null then
    raise exception 'no such category: %', p_from using errcode = 'P0002';
  end if;

  update public.categories set name = btrim(p_to) where name = p_from returning * into v_row;

  perform public.log_admin_action('category.rename', 'categories', v_row.name, v_before, to_jsonb(v_row), p_reason);
  return v_row;
end;
$$;

grant execute on function public.admin_rename_category(text, text, text) to authenticated;

create or replace function public.admin_upsert_city(
  p_id     text,
  p_name   text,
  p_state  text,
  p_lat    double precision,
  p_lng    double precision,
  p_sort   integer,
  p_active boolean,
  p_reason text
) returns public.cities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_row    public.cities;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_lat is null or p_lng is null then
    raise exception 'a city needs coordinates' using errcode = '22023';
  end if;

  select to_jsonb(c) into v_before from public.cities c where c.id = p_id;

  insert into public.cities (id, name, state, lat, lng, sort, active)
  values (p_id, btrim(p_name), p_state, p_lat, p_lng, coalesce(p_sort, 100), coalesce(p_active, true))
  on conflict (id) do update
    set name = excluded.name, state = excluded.state, lat = excluded.lat,
        lng = excluded.lng, sort = excluded.sort, active = excluded.active
  returning * into v_row;

  perform public.log_admin_action(
    case when v_before is null then 'city.create' else 'city.update' end,
    'cities', v_row.id, v_before, to_jsonb(v_row), p_reason);
  return v_row;
end;
$$;

grant execute on function public.admin_upsert_city(text, text, text, double precision, double precision, integer, boolean, text) to authenticated;

create or replace function public.admin_upsert_locality(
  p_id      uuid,
  p_city_id text,
  p_name    text,
  p_lat     double precision,
  p_lng     double precision,
  p_sort    integer,
  p_active  boolean,
  p_reason  text
) returns public.localities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_row    public.localities;
begin
  if not public.is_admin() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_lat is null or p_lng is null then
    raise exception 'a locality needs coordinates' using errcode = '22023';
  end if;

  select to_jsonb(l) into v_before from public.localities l where l.id = p_id;

  if p_id is null or v_before is null then
    insert into public.localities (city_id, name, lat, lng, sort, active)
    values (p_city_id, btrim(p_name), p_lat, p_lng, coalesce(p_sort, 100), coalesce(p_active, true))
    on conflict (city_id, name) do update
      set lat = excluded.lat, lng = excluded.lng, sort = excluded.sort, active = excluded.active
    returning * into v_row;
  else
    update public.localities set
      city_id = p_city_id, name = btrim(p_name), lat = p_lat, lng = p_lng,
      sort = coalesce(p_sort, 100), active = coalesce(p_active, true)
    where id = p_id
    returning * into v_row;
  end if;

  perform public.log_admin_action(
    case when v_before is null then 'locality.create' else 'locality.update' end,
    'localities', v_row.id::text, v_before, to_jsonb(v_row), p_reason);
  return v_row;
end;
$$;

grant execute on function public.admin_upsert_locality(uuid, text, text, double precision, double precision, integer, boolean, text) to authenticated;

create or replace function public.admin_delete_locality(
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

  select to_jsonb(l) into v_before from public.localities l where l.id = p_id;
  if v_before is null then
    raise exception 'no such locality: %', p_id using errcode = 'P0002';
  end if;

  delete from public.localities where id = p_id;
  perform public.log_admin_action('locality.remove', 'localities', p_id::text, v_before, null, p_reason);
end;
$$;

grant execute on function public.admin_delete_locality(uuid, text) to authenticated;
