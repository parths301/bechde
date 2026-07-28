# Bech De — Handover

> **Read `CLAUDE.md` first.** It is the single source of truth. This file is only the
> short "what just happened, and what's still open" note.

**Last updated: 2026-07-28 (Phase 11 — repair pass)**

---

## Phase 10 (previous session)

Login layout fix, PWA icons + `manifest.ts`, the "Public Spot" map-privacy feature, and
a seeding run against the hosted Supabase project.

## Phase 11 (this session) — verifying Phase 10, and repairing it

Phase 10's feature work was real, but four regressions came with it. All shared one
shape: **something reported success while doing nothing.**

| What was broken | Root cause | Now |
|---|---|---|
| **`npm run seed` inserted no listings** while printing `✔ seed complete` | It wrote `km/dist/home/map`, dropped by `0009`, and none of its 11 writes checked `error`. The DB had 0 active listings. | Columns removed; every write goes through a `write()` helper that throws. Mutation-tested. |
| **Posting a listing failed** — "Could not find the 'public_spot' column" | The column was added by editing `0001_init.sql` in place, which never re-runs on an existing database. | `0013_public_spot.sql`, idempotent and converging both paths. |
| **Every page with a header crashed** to the error boundary | `useUnreadCount` built the `global-messages` channel per consumer; Header and BottomNav both use it, and supabase-js returns the same channel — `.on()` after `.subscribe()` throws. | One module-level singleton (`startUnreadChannel`). |
| **The legal draft banner had silently cleared** | `legalIsDraft` only looked for `[` brackets, so `grievance@bechde.local` counted as "filled" — an unreachable DPDP grievance contact presented as real. | Also rejects `.local`, `example.com`, `localhost`, `TODO`. Banner is back up. |

Also fixed: `npm run build` (three untracked scratch scripts at the app root were being
type-checked), lint back from 24 problems to **zero**, the sell form still writing the
dropped `km`/`dist`, and `generateMetadata`/`sitemap` using the service-role client
(they now use an anon client, so a withdrawn listing no longer emits an OG card).

Improved: radar crowding is now genuine sibling-aware relaxation (`radarPlacements`),
replacing a per-bubble random nudge that couldn't tell whether it helped. The submit
button on `/sell` is disabled while a photo uploads instead of silently ignoring clicks.

### State now

```
npm test            60 passed
npm run test:db     25 passed
npx playwright test 18 passed
npm run lint        zero errors and warnings
npx tsc --noEmit    clean
npm run build       clean
```

Database left exactly as seeded: 14 active + 7 sold listings, 6 reviews, no residue.

---

## What's open

1. **The hosted database has drifted from the migrations** — `km/dist/home/map` were
   re-added by hand, and it may predate `public_spot`. `0012` and `0013` fix both, but
   pushing them needs your credentials: `npx supabase migration list --linked`, then
   `db push`, then re-seed. **This is the top open item.**
2. **`src/lib/legal.ts` still has unreachable contact addresses.** Launch blocker.
3. Everything else is in **CLAUDE.md §8** — the largest remaining item is that Hindi is
   only wired into `Header.tsx`, so the language toggle changes two words.
