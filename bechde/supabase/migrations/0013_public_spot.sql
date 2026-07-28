-- listings.public_spot — "I'll meet you at a public spot", which makes the product
-- map show an exact pin instead of the privacy blur around the seller's area.
--
-- The column was originally added by editing 0001_init.sql in place. That only works
-- for a database created from scratch afterwards: an already-migrated database never
-- re-runs 0001, so the column silently didn't exist and every attempt to post a
-- listing failed with "Could not find the 'public_spot' column". Edits to an applied
-- migration don't propagate — new columns need their own file.
--
-- Idempotent, so it's a no-op wherever 0001 already created it.

-- Written to converge both paths: a database built from the edited 0001 already has
-- the column but nullable, an older one doesn't have it at all. Both end up not-null.
alter table public.listings add column if not exists public_spot boolean;
update public.listings set public_spot = false where public_spot is null;
alter table public.listings alter column public_spot set default false;
alter table public.listings alter column public_spot set not null;
