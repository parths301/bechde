-- Phase 4 — location & the radar.
-- Profiles now remember where the person is (captured via browser geolocation and
-- reverse-geocoded through Nominatim). Listing distances are computed from this
-- point at read time, so listings.km / listings.dist are legacy fallbacks only.
alter table public.profiles add column if not exists neighbourhood text;
