# Bech De — agent brief & handover

> **Audience:** any coding agent (Claude, Gemini, …) or developer picking this up.
> This file is the single source of truth for *what exists*, *how it works*, *what
> bites*, and *what to do next*. Read it fully before touching code.

<!-- BEGIN:nextjs-agent-rules -->
## ⚠️ This is NOT the Next.js you know

This is **Next.js 16.2.10**. It has breaking changes — APIs, conventions and file
structure may all differ from your training data. **Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code.** Heed deprecation notices.

Concrete traps already hit in this repo:

| Thing | Next 16 reality |
|---|---|
| `middleware.ts` | Renamed. It's **`src/proxy.ts`**, exporting `proxy()`, not `middleware()`. |
| `error.tsx` prop | `reset` is now **`unstable_retry`**. |
| `useSearchParams` | Needs a `<Suspense>` boundary in a prerendered route, or the build fails. |
| Typed routes | `.next/dev/types/validator.ts` is generated; a stale copy causes phantom `tsc` errors after adding a route. Delete `.next/dev/types` and restart if you see them. |
<!-- END:nextjs-agent-rules -->

---

## 1. What this is

A **hyperlocal second-hand marketplace for India** ("bech de" = "sell it"), cozy and
playful rather than utilitarian. Signature feature: a **radar** on the home screen that
floats nearby listings around you at their real geographic positions.

It began as an HTML prototype from Claude Design (see `../project/*.dc.html` and the
transcripts in `../chats/`), and has been built out into a real product on Supabase.

**Status: feature-complete and verified locally. Not yet deployed.** Everything a user
touches is backed by real data — no mock arrays, no fake counters. What's left is
account-level setup (§7) plus the improvements in §8.

Design language is fixed and must be respected: Bricolage Grotesque + Karla, cream
`#FBF6ED`, ink `#2E2A24`, clay prices, pill buttons, dashed dividers, hand-drawn
rotations. Tokens live in `src/lib/colors.ts` — **use them, never hardcode a hex.**

---

## 2. Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript | Turbopack dev |
| DB / Auth / Storage / Realtime | Supabase (Postgres 17) | local via Supabase CLI + colima |
| Maps | Leaflet + raw OpenStreetMap tiles | **no API key**; MapTiler was dropped |
| Geocoding | OSM Nominatim, proxied server-side | `/api/geocode` |
| Styling | Inline styles + one global stylesheet | ported from the prototype; no Tailwind |
| Tests | Vitest (unit), Vitest (RLS), Playwright + axe (E2E) | see §6 |
| Hosting | Vercel (planned) | root directory must be `bechde` |

---

## 3. Running it

Needs Docker or [colima](https://github.com/abiosoft/colima).

```bash
colima start                 # or Docker Desktop
npx supabase start           # Postgres, Auth, Storage, Realtime, Studio, Mailpit
cp .env.local.example .env.local
npx supabase status -o env   # paste anon + service_role keys into .env.local
npm install
npm run seed                 # demo data
npm run dev                  # http://localhost:3000
```

- **Sign in as `aisha@bechde.local`** (demo buyer, has chats) or **`rohan@bechde.local`**
  (seller of the guitar). Any other address creates a fresh account.
- Emails go to **Mailpit: http://127.0.0.1:54324** — never a real inbox.
- Supabase Studio: http://127.0.0.1:54323
- `[analytics] enabled = false` in `supabase/config.toml` because the vector container
  can't mount colima's docker socket. Remove that if you're on Docker Desktop.

---

## 4. Architecture

### 4.1 Data flow

Every screen is a **client component**. They never talk to Supabase directly — they call
hooks in **`src/lib/queries.ts`**, which is the whole data layer (~1000 lines, the most
important file in the repo).

```
screen (client component)
  └─ hook from src/lib/queries.ts
       └─ getSupabaseBrowser()   (src/lib/supabase/client.ts, anon key)
            └─ PostgREST / Realtime, gated by RLS
```

`src/lib/supabase/server.ts` is `server-only`: a cookie-bound client for route handlers
plus `createAdminClient()` (service role, bypasses RLS) for the seed and privileged work.

### 4.2 Key files

| File | Role |
|---|---|
| `src/lib/queries.ts` | **All** reads/writes. Hooks + mutations. Start here. |
| `src/lib/geo.ts` | haversine, `formatKm`, `offsetKm`, `radarPlacement` |
| `src/lib/search.ts` | the `Filters` shape + URL codec + `searchCategories` |
| `src/lib/time.ts` | `listedAgo` relative timestamps |
| `src/lib/legal.ts` | **operator identity — placeholders, must be filled before launch** |
| `src/lib/colors.ts` | design tokens (contrast-corrected, see §5) |
| `src/lib/data.ts` | seed source + UI constants + types. **No runtime data.** |
| `src/lib/store.tsx` | React context: session/optimistic UI only |
| `src/proxy.ts` | session refresh + route gating (Next 16's middleware) |
| `supabase/migrations/*.sql` | schema, RLS, search, safety, reputation |
| `supabase/seed.ts` | idempotent demo data (deterministic UUIDs) |

### 4.3 Routes

```
/                       landing + email sign-in
/auth/confirm           magic-link callback (route handler)
/api/geocode            Nominatim proxy (?q= forward, ?lat=&lng= reverse)
/home                   radar + nearby feed
/search                 ranked search, filters, saved searches
/map                    Leaflet map + radius/category/price filters
/product/[id]           listing detail, like, report/block, mark sold
/chat                   threads, live messages, offers, reviews
/sell                   photo upload → geocoded listing
/profile                my listings/sold/saved/reviews, blocked list, edit
/legal/{terms,privacy,prohibited}
/opengraph-image        generated OG card (next/og)
```

Protected paths are listed in `src/proxy.ts` — **add new app routes there** or they'll be
publicly reachable.

### 4.4 Database (13 tables)

`profiles`, `categories`, `listings`, `listing_images`, `saved_items`, `saved_searches`,
`chats`, `messages`, `offers`, `reports`, `blocks`, `reviews`, `chat_reads`.

Migrations, in order:

| File | Contents |
|---|---|
| `0001_init.sql` | 8 core tables, RLS on all, `listing-images` storage bucket, realtime publication for `messages`/`offers`, `current_profile_id()`, `handle_new_user()` trigger |
| `0002_location.sql` | `profiles.neighbourhood` |
| `0003_search.sql` | `pg_trgm`, generated `listings.price_num` + `listings.search` tsvector, GIN indexes, `search_listings(q)`, `saved_searches` |
| `0004_safety.sql` | `reports`, `blocks`, `is_blocked_by()`, `'removed'` listing status, block enforcement folded into `listings_read`/`chats_read`/`messages_insert`/`offers_insert` |
| `0005_reviews.sql` | `reviews`, `chat_reads`, `profiles.rating_avg/rating_count/bio`, trigger functions `refresh_rating`/`refresh_sold`/`refresh_reply_time`, `matching_saved_search_count()` |
| `0006_admin.sql` | `profiles.is_admin`, `is_admin()`, admin read/update on `reports` and `listings` |
| `0007_notifications.sql` | `saved_searches.last_notified_at` (+ commented pg_cron wiring for production) |
| `0008_spam_limits.sql` | `profiles.abuse_count`, `enforce_rate_limits()` trigger — 20 listings/day, 200 messages/hour |
| `0009_cleanup.sql` | drops the legacy `listings.km/dist/home/map` and `profiles.rating/phone` |
| `0010_integrity.sql` | `ON DELETE SET NULL` for `chats`/`offers`/`reviews` → `listings`; one pending offer per chat |
| `0011_reviews_report.sql` | `reports.review_id`, reviewers may edit their own review |
| `0012_drop_legacy_columns.sql` | re-asserts the 0009 drops — they were re-added by hand on the hosted DB (see §5) |
| `0013_public_spot.sql` | `listings.public_spot` — was added by editing `0001` in place, so existing databases never got it |

**Never change an applied migration.** Editing `0001_init.sql` to add `public_spot` is
why posting a listing failed with *"Could not find the 'public_spot' column"*: the file
only runs on a database built from scratch. New column → new migration file.

**RLS is the security model.** There is no server-side authorization layer — the browser
holds an anon key and Postgres decides what it may see. Never "fix" a permissions problem
by moving a query to the service-role client.

### 4.5 Principles this codebase follows

1. **Derived, never written.** A profile's ★ rating, sold count and reply time are
   computed by triggers from `reviews`, sold listings and message timings. The seed
   deliberately does *not* set them. Distances are computed at read time from the
   viewer's own position. If you add a stat, derive it.
2. **No invented numbers.** Every count, price range and badge on screen traces to rows.
   Where data is insufficient the UI *hides the claim* (e.g. the sell-page price guide
   needs ≥3 comparables) or says so plainly ("no reviews yet", "new seller").
3. **Status over delete.** Withdrawing a listing sets `status='removed'`; deleting the
   row would cascade away its chats and message history.
4. **One definition per concept.** Filters live only in `search.ts`; categories only in
   `searchCategories`. Two lists drift — the old map list silently omitted "Music", so
   guitars were unfilterable.

---

## 5. Gotchas that cost real time

Read these. Each one was found the hard way.

### Auth / magic links
- **`@supabase/ssr`'s `createBrowserClient` hard-codes `flowType: "pkce"`** — it cannot be
  overridden. The emailed token is therefore `pkce_…`, which **`verifyOtp` cannot
  redeem**. The email template must link to **`{{ .ConfirmationURL }}`** and
  `/auth/confirm` completes it with `exchangeCodeForSession`.
  *Consequence:* **a magic link only works in the browser that requested it.** Laptop →
  phone will fail. Changing that needs a different client, not a config flag.
- Node scripts using plain `@supabase/supabase-js` get the *implicit* flow and a hex
  token — so scripts can pass while real browsers are broken. **Verify auth in a
  browser.**
- Editing `supabase/templates/*.html` requires **restarting the kong container** —
  it serves the old byte length and truncates the new file, and GoTrue then fails with
  "ends in a non-text context".
- **HTML comments break Go's `html/template`.** Use `{{/* … */}}` inside those templates.
- Test helpers must **clear Mailpit first** (`DELETE /api/v1/messages`) or they redeem a
  stale token and you get a baffling "link is invalid or has expired".
- `auth.rate_limit.email_sent` is raised to 200 in `config.toml` **for local testing
  only**. Production uses real SMTP with its own limits.

### RLS
- **A policy that asks about *another user's* rows must call a `SECURITY DEFINER`
  helper.** Reading the table inline runs as the caller. `blocks` is scoped to the
  blocker, so "has someone blocked me?" read zero rows and silently let blocked users
  keep messaging. `is_blocked_by()` exists for exactly this. There's a regression test.
- `supabase/tests/rls.test.ts` is the safety net. Adding a policy? Add a test.

### Postgres / PostgREST
- `SET pg_trgm.word_similarity_threshold` inside a function is **denied** — Supabase's
  `postgres` role isn't a superuser. Compare `word_similarity(...) > 0.4` explicitly.
  (Costs the trigram index on that branch; fine at this scale.)
- PostgREST **can** embed relations and apply filters on a `setof <table>` RPC:
  `.rpc("search_listings", {q}).select(LISTING_SELECT).eq("category", …)` works.
  Pass RPC args in the **POST body** — curl's `-G` silently drops them.
- Generated columns must be immutable expressions (`price_num`, `search` are).

### Local stack
- `supabase_storage` sometimes comes up **unhealthy and the CLI rolls the whole stack
  back**. It's transient — just run `npx supabase start` again.
- `supabase stop --no-backup` **wipes the volume**; you'll need `npm run seed` after.
- `docker exec` needs **`-i`** to accept a heredoc, or your SQL silently does nothing.
- Next 16 refuses a second `next dev` for the same directory. Background it with a plain
  file redirect (`npm run dev > dev.log 2>&1 &`) — piping through `tee` kills it.
- A **wedged dev server still holds port 3000**, and Playwright's `reuseExistingServer`
  will happily reuse it, so every spec fails at `page.goto`. If the suite dies on
  navigation, `curl localhost:3000` first; if it hangs, kill the process and restart.

### Silent failures — the ones that cost the most
These all shared a shape: something reported success while doing nothing.

- **`supabase/seed.ts` must check `error` on every write.** It once ignored all eleven,
  so when `0009` dropped `km`/`dist`/`home`/`map` and the seed kept writing them,
  PostgREST rejected the batch and the script still printed `✔ seed complete` with an
  empty listings table. Six RLS tests then failed for reasons that looked unrelated.
  The `write()` helper now throws; keep using it.
- **Don't patch the database to match stale code.** The response to the above was an
  `ALTER TABLE` re-adding the dead columns *on the hosted project* — schema drift no
  migration described. Fix the writer, not the schema.
- **`sb.channel(name)` returns the existing channel for a repeated topic**, and calling
  `.on()` on one that's already `subscribe()`d **throws**. Header and BottomNav both use
  `useUnreadCount()`, so the second one crashed every page with a header into the error
  boundary. Shared channels belong in a module-level singleton (`startUnreadChannel`).
- **`tsconfig.json` excludes `supabase/`**, so the seed and RLS tests are *not*
  type-checked. Their bugs only show at runtime — which is why the checked `write()`
  helper matters more here than elsewhere.
- **An RLS-denied `UPDATE` returns no error.** The `USING` clause filters the row out, so
  PostgREST reports success on zero rows. A test asserting `42501` passes vacuously when
  the row simply doesn't exist. Assert the value is *unchanged* instead.
- **`legalIsDraft` guards against exactly this.** It once checked only for `[` brackets,
  so replacing the placeholders with `grievance@bechde.local` cleared the launch banner
  while leaving an unreachable DPDP contact. It now rejects `.local`, `example.com` and
  `localhost` too.

---

## 6. Tests

```bash
npm test              # 60 unit tests (pure logic) — no DB needed
npm run test:db       # 25 RLS tests — needs the local stack, seeded
npx playwright test   # 18 E2E incl. an axe pass on 7 routes; needs a dev server + seed
npm run lint          # currently ZERO errors and warnings — keep it there
npx tsc --noEmit
npm run build
```

- Unit: `src/lib/*.test.ts` (geo, search, time, legal).
- RLS: `supabase/tests/` — signs in for real via Mailpit. **This suite has caught
  genuine security bugs.** It is mutation-tested: reintroducing the `is_blocked_by` bug
  makes it fail.
- E2E: `e2e/` — one shared sign-in via `storageState` (signing in per test trips the
  auth rate limit), screenshots to `e2e/screenshots/`. Every spec cleans up after
  itself; the suite must leave 14 active + 7 sold listings, exactly as seeded.
- **When a spec fails, check whether the app changed before you change the spec.** The
  `useUnreadCount` crash and the missing `public_spot` column both surfaced here first,
  as nine specs "drifting" at once. Nine at once is an app bug; one is drift.
- CI: `.github/workflows/ci.yml` — runs everything on push/PR. Untested until the repo
  is pushed; check the first run.

---

## 7. Launch blockers — these need *your* accounts

Full runbook in **`DEPLOY.md`**. Summary:

1. **Fill `src/lib/legal.ts` with details that actually work.** Entity, address,
   grievance officer + email, support email. India's DPDP Act requires a named human at
   a reachable address. The fields currently hold `grievance@bechde.local` and
   `support@bechde.local` — **mailboxes that cannot receive mail**, which is a
   compliance failure rather than a placeholder. `legalIsDraft` rejects `.local`,
   `example.com` and `localhost`, so the yellow draft banner is up and stays up until
   the addresses are real. Have a lawyer read the pages.
2. **The hosted Supabase project already exists** — ref `iwhefgykblkwnuazfczv`, linked in
   `supabase/.temp/`. It has drifted from the migrations: `km/dist/home/map` were
   re-added by hand (`0012` removes them again) and it may predate `public_spot`
   (`0013`). Run `npx supabase migration list --linked` to see where it actually is,
   then `npx supabase db push`, then re-seed. Region should be `ap-south-1` (Mumbai).
3. **Auth config**: Site URL + `…/auth/confirm` redirect, and paste
   `supabase/templates/magic_link.html` into the Magic Link template (see §5 — this is
   the step most likely to silently break sign-in).
4. **Real SMTP** (Resend / SES / Postmark). Supabase's shared sender is rate-limited and
   not for production. Sign-in is the front door.
5. **Vercel**: import the repo with **root directory `bechde`**, set
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
6. **Domain**, then update the Supabase URLs *and* `NEXT_PUBLIC_SITE_URL` together.
7. **Sentry** (optional): boundaries exist in `src/app/error.tsx` and `global-error.tsx`;
   one `captureException` away. Left unwired deliberately — it needs your account.

---

## 8. What to do next — prioritized work list

Each item: why it matters, what to change, and how you'll know it's done.
Work top-down. **P0 (Admin, Photo Size Limits, Pagination) are done!**
**P1 (Live Chat Updates, Saved-search notifications, Accessibility pass, Spam and abuse limits) are done!**
**P2 is polish.**

---



### [DONE] P1-1 · The chat list doesn't live-update
**Why:** `useConversation` subscribes to Realtime for the **open** thread only. A message
arriving in another thread doesn't move it up the list or bump the unread badge until a
refetch. The badge is real but stale.

**Do:** subscribe to `messages` inserts across the viewer's chats (or a per-user channel)
and invalidate `useChatThreads` + `useUnreadCount`. `bumpUnread()` in `queries.ts` is the
existing hook for the badge.

**Done when:** two browsers side by side — a message in thread B updates the list and
badge while thread A is open.

---

### [DONE] P1-2 · Saved-search notifications
**Why:** saved searches count new matches in-app only. The copy is honest ("no emails
yet"), but the feature is half a loop — this is the retention mechanic.

**Do:** a Supabase scheduled function (pg_cron + Edge Function) that runs
`search_listings` per saved search for rows newer than `created_at`, and emails digests
through the SMTP provider from §7. Store `last_notified_at` so nobody gets the same
listing twice. Add an unsubscribe path — required, not optional.

**Done when:** creating a matching listing produces one email, and a second run sends
nothing new.

---

### [DONE] P1-3 · Finish the accessibility pass
**Why:** axe is clean at serious/critical on all 7 routes, but axe cannot see that a
`<div onClick>` is unreachable by keyboard. `Button`, `Chip`, `Hoverable` and
`ReportDialog` are converted; **many one-off clickable divs are not** — chat list rows,
quick replies, the send button, offer accept/decline, profile tabs, `LocationChip`,
save-search buttons, `SafetyAction`, `MiniButton`, star rating.

**Do:** sweep `src/app/**` and `src/components/**` for `onClick` on a non-interactive
element; convert to `<button type="button">` (reset styling inline, `fontFamily:
"inherit"`) or add `role`/`tabIndex`/`onKeyDown` like `Hoverable` does. Profile tabs
should be a real `role="tablist"`.

**Done when:** every action is reachable and operable with Tab/Enter, and a Playwright
test tabs through `/chat` and sends a message without a mouse.

---

### [DONE] P1-4 · Spam and abuse limits
**Why:** an authenticated account can insert unlimited listings, messages and reports.
There is no rate limiting beyond Supabase Auth's sign-in throttle.

**Do:** per-user insert limits (a `SECURITY DEFINER` trigger counting recent rows is
enough to start — e.g. ≤20 listings/day, ≤200 messages/hour), plus an abuse counter on
`reports` so repeat offenders surface in the P0-1 queue.

**Done when:** the 21st listing in a day is refused with a clear error, and a test covers it.

---

### Done since this list was written
Radar crowding (now sibling-aware relaxation in `radarPlacements`), `store.tsx` slimming,
offer semantics and the `chats.listing_id` cascade (`0010`), reviews round two (`0011`,
`useWrittenReviews`), SEO (`sitemap.ts`, `robots.ts`, `generateMetadata` on a server
`/product/[id]/page.tsx` wrapping `ProductClient`), and the sell + mobile E2E specs.

### P2 · Smaller, well-scoped items
- **Hindi is barely started.** `src/lib/i18n/dictionary.ts` holds ~92 keys, but
  `Header.tsx` is the **only** consumer — two nav labels actually translate. The toggle
  therefore looks broken to a Hindi speaker. Either wire `t()` through the screens or
  drop the toggle until it's real; a half-translated UI is worse than an English one.
- **`next/image`.** Photos are CSS `background-image` in `Stripe.tsx`, so no
  optimization, lazy loading or AVIF. Converting means reworking `Stripe`'s striped
  fallback — worth it before launch traffic.
- **Duplicate OG image routes.** The build emits both `/opengraph-image` (generated by
  `src/app/opengraph-image.tsx`) and a static `/opengraph-image.jpg`. Pick one; two
  sources of the same card will drift.
- **`PROFILE_COLS` omits `is_admin`**, so `useProfile()` can't tell you whether the
  viewer is an admin — `/admin/reports` relies on RLS refusing instead of hiding the
  link. Harmless today, confusing later.
- **Test gaps.** No tests for `queries.ts` hooks beyond `rowToItem`; nothing covers the
  saved-search notification Edge Function; the RLS suite doesn't cover `0010`'s
  one-pending-offer index.
- **`e2e/sell.spec.ts` needs `.env.local`** for its service-role cleanup. Fine locally,
  but CI has to provide it or the spec leaves rows behind.

---

## 9. Conventions to keep

- **Comments explain *why*, never *what*.** Match the density of surrounding code.
- Tokens from `colors.ts`; no new hex values without checking contrast (§5 note: the
  prototype's muted greys failed WCAG AA at 2.8:1 and were darkened).
- New reads/writes go in `queries.ts`, not inline in a component.
- New table or policy → **a new migration file** + a test in `supabase/tests/`. Never
  edit a migration that has already been applied somewhere.
- **Check `error` on every Supabase write in scripts.** `supabase/` isn't type-checked
  and a rejected PostgREST batch is not an exception — an unchecked write is a write
  that can quietly not happen.
- Keep `npm run lint` at zero. Prefer fixing the cause over an eslint-disable; the two
  that remain are `set-state-in-effect` for browser-storage hydration, each with a
  comment saying why a lazy initialiser would break the first paint.
- Don't reintroduce fake data to make a screen look fuller. Empty states are the honest
  answer and every screen already has one.
