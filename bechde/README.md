# Bech De

> **The single source of truth for this repo.** Architecture, how to run it, the traps
> that cost real time, and how to deploy. If you're an agent or a developer picking this
> up: read this file fully before touching code. The launch checklist is in
> [`TASKS.md`](./TASKS.md).

A **hyperlocal second-hand marketplace for India** ("bech de" = "sell it"), cozy and
playful rather than utilitarian. Signature feature: a **radar** on the home screen that
floats nearby listings at their real geographic positions.

**Status: launch-ready in code.** Everything a user touches is backed by real data — no
mock arrays, no fake counters. What remains is account setup only, and it's all in
`TASKS.md`.

---

## ⚠️ This is NOT the Next.js you know

**Next.js 16.2.12.** APIs, conventions and file structure may all differ from your
training data. **Read the relevant guide in `node_modules/next/dist/docs/` before writing
code.**

| Thing | Next 16 reality |
|---|---|
| `middleware.ts` | Renamed. It's **`src/proxy.ts`**, exporting `proxy()`. |
| `error.tsx` prop | `reset` is now **`unstable_retry`**. |
| `useSearchParams` | Needs a `<Suspense>` boundary in a prerendered route, or the build fails. |
| Typed routes | `.next/dev/types/validator.ts` is generated; a stale copy causes phantom `tsc` errors after adding a route. `rm -rf .next/dev/types` and restart. |

---

## 1. Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript | Turbopack dev |
| DB / Auth / Storage / Realtime | Supabase (Postgres 17) | local via Supabase CLI + colima |
| Maps | Leaflet + raw OpenStreetMap tiles | **no API key** |
| Geocoding | OSM Nominatim, server-proxied | `/api/geocode` |
| Email | Resend, via `src/lib/email` | cron routes declared in `vercel.json` |
| i18n | i18next + react-i18next | runtime toggle, no locale routing |
| Errors | Sentry, lazily loaded | inert without a DSN |
| Styling | Inline styles + one global stylesheet | no Tailwind |
| Tests | Vitest (unit + RLS), Playwright + axe | see §5 |
| Hosting | Vercel | root directory must be `bechde` |

Design language is fixed: Bricolage Grotesque + Karla, cream `#FBF6ED`, ink `#2E2A24`,
clay prices, pill buttons, dashed dividers, hand-drawn rotations. Tokens live in
`src/lib/colors.ts` — **use them, never hardcode a hex.** The original design files are in
`../project/*.dc.html`.

---

## 2. Running it

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
- To reach `/admin`: `update profiles set is_admin = true where email = '…';`

---

## 3. Architecture

### 3.1 Data flow

Every screen is a **client component**. They never talk to Supabase directly — they call
hooks in **`src/lib/queries.ts`**, which is the whole data layer and the most important
file in the repo.

```
screen (client component)
  └─ hook from src/lib/queries.ts
       └─ getSupabaseBrowser()   (anon key)
            └─ PostgREST / Realtime, gated by RLS
```

`src/lib/supabase/server.ts` is `server-only`: a cookie-bound client for route handlers,
`createPublicClient()` (anon, no cookies — for cacheable public SSR), and
`createAdminClient()` (service role, bypasses RLS) for the seed and privileged routes.

### 3.2 Key files

| File | Role |
|---|---|
| `src/lib/queries.ts` | **All** reads/writes. Hooks + mutations. Start here. |
| `src/lib/geo.ts` | haversine, `formatKm`, `offsetKm`, `radarPlacements` |
| `src/lib/search.ts` | the `Filters` shape + URL codec |
| `src/lib/legal.ts` | **operator identity — must be filled before launch** |
| `src/lib/colors.ts` | design tokens (contrast-corrected) |
| `src/lib/i18n/` | i18next setup + `en`/`hi` resources |
| `src/lib/email/` | Resend sender, templates, cron helpers |
| `src/lib/observability.ts` | `reportError()`; Sentry behind a DSN check |
| `src/lib/data.ts` | seed source + UI constants + types. **No runtime data.** |
| `src/proxy.ts` | session refresh + route gating (Next 16's middleware) |
| `supabase/migrations/*.sql` | schema, RLS, search, safety, admin, taxonomy |
| `supabase/seed.ts` | idempotent demo data (deterministic UUIDs) |

### 3.3 Routes

```
/                       redirects to /home
/login                  email sign-in — a link, or a 6-digit code
/auth/confirm           magic-link callback
/unsubscribe            one-click, token in the URL, no sign-in
/home                   radar + nearby feed
/search                 ranked search, filters, saved searches
/map                    Leaflet map + radius/category/price filters
/product/[id]           listing detail, like, report/block, mark sold
/chat                   threads, live messages, offers, reviews
/sell                   photos → category questions → geocoded listing
/profile                listings/sold/saved/reviews, blocks, email prefs,
                        data export, account closure
/admin                  console: reports, listings, people, taxonomy, audit log
/legal/{terms,privacy,prohibited}
/api/geocode            Nominatim proxy — session required, rate limited
/api/health             liveness incl. a real DB read
/api/account/{export,delete}
/api/auth/verify-code   redeems the 6-digit code server-side
/api/cron/{messages,saved-searches}   CRON_SECRET gated
```

Protected paths are listed in `src/proxy.ts` — **add new app routes there** or they're
publicly reachable.

### 3.4 Database

`profiles`, `categories`, `listings`, `listing_images`, `saved_items`, `saved_searches`,
`chats`, `messages`, `offers`, `reports`, `blocks`, `reviews`, `chat_reads`,
`admin_actions`, `cities`, `localities`, `category_attributes`, `notification_tokens`.

| Migration | Contents |
|---|---|
| `0001`–`0008` | core tables, RLS, storage, realtime, location, search, safety, reviews, admin flag, notifications, spam limits |
| `0009`–`0013` | cleanup, integrity/cascades, review reports, legacy-column drops, `public_spot` |
| `0016_admin_console` | `admin_actions`, audited admin RPCs, suspension |
| `0017_taxonomy` | editable categories, `cities`, `localities` |
| `0018_listing_attributes` | per-category question templates, `listings.attrs` |
| `0019_account_closure` | `close_my_account()` |
| `0020_email_notifications` | prefs, `notification_tokens`, `messages.notified_at` |
| `0021_taxonomy_hindi` | `_hi` columns on the taxonomy, the five missing cities |

**Never change an applied migration.** Editing `0001` to add `public_spot` is why posting
a listing failed with *"Could not find the 'public_spot' column"*: the file only runs on a
database built from scratch. New column → new migration file, and never backfill a number
lower than one already applied.

**RLS is the security model.** There is no server-side authorization layer — the browser
holds an anon key and Postgres decides what it may see. Never "fix" a permissions problem
by moving a query to the service-role client.

**Admin writes go through functions, not policies.** Widening a policy with `or is_admin()`
lets an admin change a row through plain PostgREST with nothing recorded. Every admin
mutation is a `SECURITY DEFINER` RPC that makes the change *and* writes its `admin_actions`
row in the same transaction, so the audit cannot be skipped. `profiles_update` is
deliberately not widened. Caveat: the service-role key still bypasses all of it.

**A credential does not belong on a world-readable table.** `profiles` is
`select using (true)`, so the unsubscribe token lives in `notification_tokens` (RLS on, no
policies, no grants). Hiding it with column grants instead breaks every `profiles(*)`
embed, `LISTING_SELECT` included.

### 3.5 Principles this codebase follows

1. **Derived, never written.** Rating, sold count and reply time are computed by triggers.
   Distances are computed at read time from the viewer's position. If you add a stat,
   derive it.
2. **No invented numbers.** Every count, price range and badge traces to rows. Where data
   is insufficient the UI *hides the claim* or says so plainly.
3. **Status over delete.** Withdrawing sets `status='removed'`; deleting the row would
   cascade away its chats. Closing an account anonymises for the same reason.
4. **One definition per concept.** Categories live in the database, not also in a TS array.
   Two lists drift.

---

## 4. Gotchas that cost real time

Each one was found the hard way.

### Silent failures — the expensive ones
These all shared a shape: **something reported success while doing nothing.**

- **A seed that ignores `error` writes nothing and says `✔ complete`.** It once wrote
  columns `0009` had dropped; PostgREST rejected the batch and the listings table sat
  empty. Every write goes through the checked `write()` helper.
- **A notifier that logs `[EMAIL]` is the same bug.** `notify-saved-searches` printed the
  message it *would* have sent, then stamped `last_notified_at`. The feature read as done
  for months. `src/lib/email/send.ts` has no log-instead mode: no key, no send, loud
  failure.
- **An RLS-denied `UPDATE` returns no error.** The `USING` clause filters the row out, so
  PostgREST reports success on zero rows. Assert the value is *unchanged*, not that you
  got `42501`.
- **A client component cannot produce a 404.** `notFound()` in `ProductClient` ran after
  the response started, so a dead listing answered **200 OK** with a "Nothing here" page —
  a soft 404, which search engines index and keep serving. Decide existence in the server
  component.
- **Don't patch the database to match stale code.** The response to the seed bug was once
  an `ALTER TABLE` on the *hosted* project — schema drift no migration described.

### Auth / magic links
- **`@supabase/ssr`'s `createBrowserClient` hard-codes `flowType: "pkce"`** and it cannot
  be overridden, so **a magic link only works in the browser that requested it.** That's
  why `/login` also offers a 6-digit code, redeemed server-side by `/api/auth/verify-code`
  where the client isn't PKCE-locked.
- Editing `supabase/templates/*.html` requires **restarting the kong container** — it
  serves the old byte length and truncates the new file.
- **HTML comments break Go's `html/template`.** Use `{{/* … */}}`.
- Node scripts get the *implicit* flow and a hex token, so **scripts can pass while real
  browsers are broken. Verify auth in a browser.**
- GoTrue throttles repeat sends to one address to roughly one a minute — hence "I already
  have a code" on the login page.

### RLS
- **A policy that asks about *another user's* rows must call a `SECURITY DEFINER` helper.**
  Reading the table inline runs as the caller. `is_blocked_by()` exists for exactly this.
- `supabase/tests/` is the safety net. Adding a policy? Add a test.

### Postgres / PostgREST
- `SET pg_trgm.word_similarity_threshold` inside a function is **denied** — compare
  `word_similarity(...) > 0.4` explicitly.
- PostgREST **can** embed relations and filter on a `setof <table>` RPC. Pass RPC args in
  the **POST body** — curl's `-G` silently drops them.
- `tsconfig.json` excludes `supabase/`, so the seed and RLS tests are **not** type-checked.

### Local stack
- `supabase_storage` sometimes comes up **unhealthy and the CLI rolls the stack back**.
  Transient — run `npx supabase start` again.
- `supabase stop --no-backup` **wipes the volume**; re-run `npm run seed`.
- `docker exec` needs **`-i`** to accept a heredoc, or your SQL silently does nothing.
- Next 16 refuses a second `next dev` for the same directory. Background it with a plain
  file redirect (`npm run dev > dev.log 2>&1 &`) — piping through `tee` kills it.
- **A wedged dev server still holds port 3000**, and Playwright's `reuseExistingServer`
  reuses it, so specs fail or crawl. If a run suddenly takes 2–3× as long and unrelated
  specs fail, restart the dev server before touching a single test.

### Mobile layout
- **`min-width: auto` is the default on grid and flex items**, so a column won't shrink
  below its widest un-wrappable child. Because `body` is `overflow-x: hidden`, the page
  crops its own right edge instead of scrolling and controls just go missing.
- **`max-width: 100%` on a centred grid item is a no-op.** An `auto` track sizes to its
  item's max-content, so `100%` resolves against the track the item itself caused. Centre
  with **flex**, whose content box is the real width.
- Landscape phones (~915px) land **between** breakpoints; there's a dedicated 821–1080px
  band.
- **`/login` is invisible to most E2E specs.** The suite shares one signed-in
  `storageState` and `src/proxy.ts` redirects authenticated visitors away. That blind spot
  shipped a 960px card on a 390px phone *and* left "Email me a link" as a `<div onClick>`,
  unreachable by keyboard, through a whole accessibility pass. Both guards now cover
  `/login` as a guest.

---

## 5. Tests

```bash
npm test              # unit tests (pure logic) — no DB needed
npm run test:db       # RLS tests — needs the local stack, seeded
npx playwright test   # E2E incl. an axe pass; needs a dev server + seed
npm run lint          # keep at ZERO
npx tsc --noEmit
npm run build
```

- RLS: `supabase/tests/` — `rls`, `admin` (audit trail), `account` (closure),
  `notifications` (unsubscribe tokens). Signs in for real via Mailpit. **Sign in once per
  file in `beforeAll` and reuse the client** — the helper clears Mailpit on every call, so
  a `signIn()` inside a test races the others and trips the rate limit.
- E2E: `e2e/` — one shared sign-in via `storageState`. Every spec cleans up after itself;
  the suite must leave **14 active + 7 sold** listings, exactly as seeded.
- **When a spec fails, check whether the app changed before you change the spec.** Several
  at once is an app bug (or a wedged dev server); one is drift.
- CI: `.github/workflows/ci.yml`.

---

## 6. Conventions to keep

- **Comments explain *why*, never *what*.** Match the density of surrounding code.
- Tokens from `colors.ts`; no new hex without checking contrast (WCAG AA).
- New reads/writes go in `queries.ts`, not inline in a component.
- New table or policy → **a new migration file** + a test.
- **Check `error` on every Supabase write in scripts.**
- Every interactive element is a real `<button>` or `<a>`. A styled `<div onClick>` is
  invisible to keyboards and to axe's most useful rules.
- **All user-facing text goes through `t()`** — see §7. A hardcoded English string is a
  hole in Hindi mode.
- Keep `npm run lint` at zero. Prefer fixing the cause over an eslint-disable.
- Don't reintroduce fake data to make a screen look fuller. Empty states are the honest
  answer.

---

## 7. Translations

`src/lib/i18n/` holds an i18next instance with `en` and `hi` resources. The toggle in the
header switches at runtime and persists to `localStorage` — there is **no locale routing**,
so URLs are language-independent.

```tsx
const { t } = useTranslation();
t("product.make_offer")                   // simple
t("home.people_nearby", { count: 6 })     // interpolation + plurals
```

Hindi plurals use i18next's `_one` / `_other` suffixes. Prices and distances go through
`Intl` under the active locale (`en-IN` / `hi-IN`), so digit grouping follows Indian
conventions in both.

Adding a string: add it to `en`, add it to `hi`, use the key. Three tests guard this:

- **keys match** between `en` and `hi`, so a half-translated screen can't ship;
- **every key is used by a screen.** This is the one that matters. Parity proves the two
  files agree; it says nothing about whether any component asks for the key. The first
  Hindi pass wrote all the keys and wired only some of the screens — 72 orphans, a dozen
  screens still hardcoding the English the resource file already held, and a green suite.
  **An orphaned key is treated as a missing call site, not as dead weight to delete.**
- **an E2E sweep** (`e2e/hindi.spec.ts`) switches to Hindi and walks every main screen
  looking for two or more consecutive English words. It used to look only at `nav a, nav
  button` — which is exactly why it passed while most of the app was English. Scoping a
  leak test to the code you just wrote is how you get a green suite and an English app.

Real user text — listing titles, notes, seller names, bios, map pin labels — must be
wrapped in `data-user-content` so that sweep skips it. It stays in whatever language it
was typed in.

### Strings that hide from a translation pass

Four places where text isn't in a component and a screen-by-screen pass misses it:

- **Pure modules.** `describeFilters` (`search.ts`) and `formatKm` (`geo.ts`) each built
  an English sentence. Both now take `t` as a parameter with an English default, so the
  module stays pure and unit-testable while the app passes the real translator.
- **Data modules.** `reportReasons` in `queries.ts` carried English `label`s; it holds
  `labelKey`s now. `value` is what the database stores and never changes with language.
- **API responses.** `/api/auth/verify-code` returned prose. It returns a `reason` code
  alongside, and the browser picks the wording — an English error in a Hindi app.
- **`toLocaleDateString([])` / `toLocaleTimeString([])`.** The empty array means the
  *browser's* locale, not the app's, so a Hindi reader on an en-US phone got English month
  names inside Hindi sentences. Pass `locale` from `useTranslation()`.

### Server-rendered pages

`/not-found`, `/unsubscribe` and the `(app)` skip link render on the server, where there
is no `localStorage`. `setLang` mirrors the choice into a cookie of the same name;
`getServerT()` (`i18n/server.ts`) reads it. `global-error.tsx` replaces the root layout,
so the provider is gone and `useTranslation` would throw inside an error boundary — it
uses `resolve()` against `localStorage` directly.

### Text that isn't in the resource files

Categories, cities, localities and the sell-form questions are **rows**, not strings — an
admin adds "Bicycles" at `/admin/taxonomy` and no resource file knows about it. Those
tables carry a `_hi` column per translatable field (`0021`), rendered through
`localised(lang, english, hindi)` with the English as fallback, so a new row shows English
rather than nothing.

For selects, `options_hi` must line up **index-for-index** with `options`: only the display
changes and the **stored value stays English**. Storing the Hindi string would make
`condition = 'Good'` unqueryable for anyone who posted in Hindi mode. A check constraint
enforces the lengths match.

Two traps that cost time here:

- **`/login` renders no header**, so there is no language toggle on it. A spec that reaches
  for one fails for a reason that has nothing to do with translation.
- **`create or replace function` with a new defaulted argument creates an *overload*, not a
  replacement.** Both versions then exist and PostgREST refuses every call with `PGRST203`
  — "could not choose the best candidate function". `drop function` the old signature
  first; see the comment in `0021`.

---

## 8. Post-launch work worth doing

- **Blocking CSP.** It ships report-only (see `next.config.ts`) because the app is
  inline-styled throughout. Tighten from real violation reports.
- **Distributed rate limiting.** `/api/geocode`'s token bucket is per-instance; a shared
  counter needs a Redis this project doesn't have.
- **Test gaps.** Nothing covers the cron routes' happy path (they need a live Resend key);
  the RLS suite doesn't cover `0010`'s one-pending-offer index.
- **Cold start.** The radar is empty for anyone outside the seeded neighbourhood. That's a
  distribution problem, not a code one.
