-- P2-2: Clean up dead code and legacy columns

alter table public.listings
  drop column if exists km,
  drop column if exists dist,
  drop column if exists home,
  drop column if exists map;

alter table public.profiles
  drop column if exists rating,
  drop column if exists phone;
