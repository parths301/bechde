-- Re-assert the 0009 cleanup.
--
-- 0009_cleanup.sql dropped listings.km/dist/home/map, but they were later re-added by
-- hand on the hosted database (add_columns.sql) so an out-of-date copy of the seed
-- script would run. That patched the symptom in the wrong place: the seed and the sell
-- form were writing columns the schema had deliberately retired. Both now stop, so the
-- columns can go again — and this time it's recorded as a migration, which the manual
-- ALTER never was.
--
-- Nothing reads them: distance is derived per viewer in rowToItem() (src/lib/queries.ts)
-- and radar coordinates come from radarPlacements() (src/lib/geo.ts). Idempotent, so it
-- is a no-op on any database that already has 0009 and was never hand-patched.

alter table public.listings
  drop column if exists km,
  drop column if exists dist,
  drop column if exists home,
  drop column if exists map;
