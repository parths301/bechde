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

---

## 6. Tests

```bash
npm test              # 42 unit tests (pure logic) — no DB needed
npm run test:db       # 21 RLS tests — needs the local stack, seeded
npx playwright test   # 16 E2E incl. an axe pass on 7 routes
npm run lint          # currently ZERO errors and warnings — keep it there
npx tsc --noEmit
npm run build
```

- Unit: `src/lib/*.test.ts` (geo, search, time, legal).
- RLS: `supabase/tests/` — signs in for real via Mailpit. **This suite has caught
  genuine security bugs.** It is mutation-tested: reintroducing the `is_blocked_by` bug
  makes it fail.
- E2E: `e2e/` — one shared sign-in via `storageState` (signing in per test trips the
  auth rate limit), screenshots to `e2e/screenshots/`.
- CI: `.github/workflows/ci.yml` — runs everything on push/PR. Untested until the repo
  is pushed; check the first run.

---

## 7. Launch blockers — these need *your* accounts

Full runbook in **`DEPLOY.md`**. Summary:

1. **Fill `src/lib/legal.ts`** — entity, address, grievance officer + email, support
   email. India's DPDP Act requires a named human and a reachable address. The legal
   pages show a yellow **draft banner** until every placeholder is gone (it clears
   itself). Have a lawyer read them.
2. **Create the Supabase project** (region `ap-south-1` / Mumbai) →
   `npx supabase link --project-ref <ref>` → `npx supabase db push`.
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

### P2 · Smaller, well-scoped items
- **Radar crowding.** When several listings sit within a kilometre the bubbles overlap
  and a long price pill can clip the right edge. Improve `radarPlacement` in
  `src/lib/geo.ts` (collision relaxation, or a log-ish distance scale) — it's pure and
  unit-tested, so iterate freely.
- **Dead code and legacy columns.** Verified unused: DB columns `listings.km`,
  `listings.dist` (superseded by read-time distance), `listings.home`, `listings.map`
  jsonb (superseded by `radarPlacement`), `profiles.rating` text (superseded by
  `rating_avg`), `profiles.phone`; and `data.ts` exports `homeBubbles`, `mapItemsAll`,
  `feedIds`, `feedItems`, `getItem`. Note `rowToItem` still *reads* `km`/`dist` as a
  fallback for coordinate-less rows, so remove that path first. `data.ts` must keep
  `items`, `chatThreads`, `homeCategories`, `sellCategories`, `USER_LOCATION` and the
  types — the seed and `search.ts` import them.
- **`store.tsx` slimming.** `phone`/`setPhone` has **no consumer at all** (pre-auth
  leftover) and `name` is only a fallback before `useProfile()` resolves. The sell-form
  draft would sit better in the form itself or `sessionStorage`.
- **Offer semantics.** Multiple pending offers can coexist; there's no expiry and no
  counter-offer. Decide the rules, then enforce them in `0004`-style policies.
- **Reviews, round two.** No "reviews I've written" view, no way to report a review, no
  edit window. Also nothing stops a review with an empty body from being useless.
- **`next/image`.** Photos are CSS `background-image` in `Stripe.tsx`, so no
  optimization, lazy loading or AVIF. Converting means reworking `Stripe`'s striped
  fallback — worth it before launch traffic.
- **SEO.** No `sitemap.ts` and no `robots.ts`. Worse, a shared product link gets the
  generic OG card: `/product/[id]/page.tsx` is `"use client"`, and `generateMetadata` is
  server-only — so per-listing previews mean splitting it into a server page that fetches
  the listing (service-role or anon read), exports `generateMetadata`, and renders the
  existing client component. Highest-value SEO item, since product links are what people
  paste into WhatsApp.
- **Hindi.** The brand is Hinglish but the UI is English-only. If localization matters,
  do it before the copy sprawls further.
- **Test gaps.** No coverage of the sell/upload flow, no mobile-viewport E2E (the radar
  is hidden and a separate mobile map shows — untested), no tests for `queries.ts` hooks.
- **`chats.listing_id` cascade.** Deleting a listing row still destroys its chats. Status
  changes avoid it, but a `ON DELETE SET NULL` + "listing removed" placeholder would
  make the data model honestly safe.

---

## 9. Conventions to keep

- **Comments explain *why*, never *what*.** Match the density of surrounding code.
- Tokens from `colors.ts`; no new hex values without checking contrast (§5 note: the
  prototype's muted greys failed WCAG AA at 2.8:1 and were darkened).
- New reads/writes go in `queries.ts`, not inline in a component.
- New table or policy → migration file + a test in `supabase/tests/`.
- Keep `npm run lint` at zero. Prefer fixing the cause over an eslint-disable.
- Don't reintroduce fake data to make a screen look fuller. Empty states are the honest
  answer and every screen already has one.
