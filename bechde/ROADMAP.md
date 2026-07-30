# Bech De — Roadmap

**Current state: phases 0–11 are done.** The prototype is a real marketplace on Supabase —
auth, listings with photo upload, real geographic distances, ranked search, live chat with
offers, derived seller reputation, reporting and blocking enforced in RLS, legal pages, and
a test suite with CI. Nothing a user sees is mocked.

**What's left is not code.** Deploying needs accounts only the owner can create. See
[DEPLOY.md](./DEPLOY.md) for the runbook and [CLAUDE.md](./CLAUDE.md) for the prioritized
list of post-launch work.

---

## Shipped stack

| Concern | Choice | Note |
|---|---|---|
| Framework | Next.js 16 (App Router, TypeScript) | `middleware` is `proxy` here |
| Database | Supabase Postgres 17 | 13 tables, RLS on every one |
| Auth | Supabase Auth — **email magic-link** | phone OTP would need Twilio + India DLT |
| Image storage | Supabase Storage | bucket `listing-images` |
| Maps / tiles | **Leaflet + raw OpenStreetMap** | MapTiler dropped — no key needed |
| Geocoding | **OSM Nominatim**, server-proxied | `/api/geocode` |
| Search | Postgres full-text + `pg_trgm` fuzzy | `search_listings()` |
| Realtime chat | Supabase Realtime | `messages` + `offers` publication |
| Tests | Vitest + Playwright + axe | 60 unit, 25 RLS, 18 E2E |
| Hosting | Vercel (planned) | root directory must be `bechde` |

---

## Phase 12 — launch readiness ✅

Everything a public site needs that a working prototype doesn't. Detail in the git log.

- [x] **Admin console** — edit any listing or profile, suspend, manage categories /
      cities / localities / sell-form questions, with an audit trail that cannot be
      skipped (the change and its log row are one transaction)
- [x] **Account closure + data export** — the DPDP rights the privacy policy already
      promised, which had no mechanism behind them. Closing anonymises rather than
      deletes, so it can't take the counterparty's chat history with it
- [x] **Real email** — message digests, saved-search digests, preferences and a
      signed-out unsubscribe. The Edge Function it replaces logged `[EMAIL]` and
      stamped rows as sent
- [x] **Cross-device sign-in** — a 6-digit code beside the link, redeemed server-side,
      because PKCE ties the link to the browser that requested it
- [x] **Listing attributes** — per-category templates, admin-editable, replacing two
      invented facts hardcoded onto every listing
- [x] **Hardening** — real 404 (was a soft 200), security headers, geocode behind a
      session and a rate limit, Sentry, analytics, health check

## Still needed from you (launch blockers)

- [ ] **Reconcile the hosted Supabase project** (`iwhefgykblkwnuazfczv`, already linked).
      It has drifted from the migrations — legacy columns re-added by hand, and possibly
      no `public_spot`. Run `npx supabase migration list --linked`, then `db push` to
      apply `0012`/`0013`, then re-seed.
- [ ] **Operator details** in `src/lib/legal.ts` — entity, address, grievance officer +
      email, support email. They are currently `.local` addresses that **cannot receive
      mail**, so the draft banner is up: DPDP requires a named human at a contact that
      actually works.
- [ ] **Resend account + verified domain**, then `RESEND_API_KEY`, `EMAIL_FROM` and
      `CRON_SECRET` in Vercel. Also point Supabase Auth's custom SMTP at it — the
      shared sender is rate-limited and sign-in is the front door. Until the key is
      set the cron routes return 503 and send nothing, by design.
- [ ] **`SEED_SELLER_EMAIL`** before re-seeding the hosted database. The seeded
      listings are staying up as real inventory, so a buyer who messages one has to
      reach a person; the seed refuses to run against a hosted URL without it.
- [ ] **Vercel project** + env vars, then a **domain**
- [ ] **Paste `supabase/templates/magic_link.html`** into the Magic Link template — it
      now carries `{{ .Token }}` as well as the link, and without it the code half of
      sign-in silently does nothing
- [x] ~~MapTiler API key~~ — not needed; Leaflet + raw OSM tiles + Nominatim are free and keyless
- [x] **OTP decision: B** — email magic-link (shipped)
- [x] ~~GitHub Personal Access Token~~ — the `origin` remote is already set

Secrets go into `.env.local` (gitignored) locally and into Vercel's env settings for deploy.
Never commit the service-role key.

---

## Build plan

What each phase delivered:

### Phase 0 — Scaffolding ✅
- [x] `@supabase/supabase-js` + `@supabase/ssr` (MapLibre dropped — Leaflet + raw OSM tiles, no key)
- [x] Typed Supabase client wrappers (browser + server/admin) reading from env
- [x] DB schema + SQL migrations, RLS on every table

### Phase 1 — Data layer ✅
- [x] Tables: `profiles`, `listings`, `listing_images`, `categories`, `chats`, `messages`, `offers`, `saved_items`
- [x] Seed script porting the mock `data.ts` items into the DB
- [x] All screens read through hooks in `src/lib/queries.ts`

### Phase 2 — Auth ✅
- [x] Email magic-link via `signInWithOtp` → `/auth/confirm` (stateless `verifyOtp`)
- [x] Session refresh + route gating in `src/proxy.ts` (Next 16 renamed middleware → proxy)
- [x] `profiles` row created — or linked by email — on first sign-in

### Phase 3 — Listings & images ✅
- [x] Sell form writes a real listing
- [x] Photo upload to the `listing-images` Storage bucket; striped placeholder is now the fallback
- [x] Listing detail reads the real row by id

### Phase 4 — Location & the radar ✅
- [x] Browser geolocation → stored on `profiles`, reverse-geocoded to a neighbourhood
- [x] Nominatim geocoding for the sell form, proxied through `/api/geocode`
- [x] Real haversine distances computed at read time from the viewer's position
- [x] Radar bubbles positioned from actual coordinates; radius filters driven by real km

### Phase 5 — Chat & offers ✅
- [x] Persistent messages per thread, live over Supabase Realtime
- [x] Offer → accept/decline as shared state both parties see
- [x] Likes backed by `saved_items`

### Phase 6 — Search & discovery ✅
- [x] Ranked full-text search (`search_listings`) with trigram typo tolerance
- [x] Category + radius + price filters against real data, shared by `/search` and the map
- [x] Saved searches with a count of new matches since saving

### Phase 7 — Trust, safety & legal ✅
- [x] Report a listing; block a user — both enforced in RLS, not just the UI
- [x] Mark sold / withdraw / relist (status change, so chat history survives)
- [x] Prohibited-items list, linked from the sell form and the report dialog
- [x] Privacy policy + terms shaped for the DPDP Act, grievance contact
- [x] Moderation view for `reports` at `/admin/reports`, gated by `profiles.is_admin`
- [ ] **Operator details in `src/lib/legal.ts` still aren't reachable — fill in before launch**

### Phase 8 — Ship ✅ (code) / ⬜ (accounts)
- [x] Generated OG image + favicon, full metadata for WhatsApp link previews
- [x] Error boundaries (`error.tsx`, `global-error.tsx`)
- [x] [DEPLOY.md](./DEPLOY.md) runbook: Supabase project → `db push` → Vercel env vars → domain
- [x] Cloud Supabase project created and linked (`iwhefgykblkwnuazfczv`)
- [ ] Push `0012`/`0013` to it — it drifted from the migrations (see the blockers above)
- [ ] Connect Vercel (root directory `bechde`), set env vars, attach the domain
- [ ] Sentry (needs your account; boundaries are in place, one `captureException` away)
- [ ] Real SMTP provider for magic-links — Supabase's shared sender is rate-limited

### Phase 9 — Reputation & hardening ✅
- [x] Reviews after an accepted deal (RLS-gated: participants only, once per side)
- [x] Profile rating / sold count / reply time **derived by trigger**, never written
- [x] Real gallery photos, unread chat badge, honest sell-page copy (price guide from
      real comparables, saved-search match counts)
- [x] Unit tests (Vitest), RLS regression suite, Playwright end-to-end + axe
- [x] GitHub Actions CI
- [x] Accessibility: real buttons, focus ring, skip link, dialog focus trap, WCAG AA
      contrast (the prototype's muted greys were failing at 2.8:1)

---

## Known limitations — all removed
- ~~State is in-memory — likes/chats reset on refresh~~ → Postgres, RLS-scoped
- ~~OTP is faked (any code works)~~ → real email magic-link
- ~~Product photos are `repeating-linear-gradient` placeholders~~ → Storage uploads (stripes remain the fallback)
- ~~Distances and "N people nearby" counts are computed from static numbers~~ → haversine from your real position
- ~~Search bar does nothing~~ → ranked full-text search with saved searches

- ~~Profile stats, badges and reviews are invented~~ → derived from `reviews`, sold
  listings and message timings by trigger; only derivable badges survived
- ~~The chat badge is hardcoded to `2`~~ → real unread count from `chat_reads`
- ~~"~40 people nearby" / "sold for ₹2,800–3,500"~~ → real saved-search match counts and
  real price percentiles, each hidden when there isn't enough data to say anything

---

## Next up

Not limitations of the prototype any more — genuine product work, ordered by priority with
acceptance criteria, in **[CLAUDE.md §8](./CLAUDE.md)**:

- **P0** — moderation surface for `reports`; bound photo uploads; pagination (done)
- **P1** — live-updating chat list; saved-search emails; finish the keyboard-accessibility
  sweep; abuse/rate limits (done)
- **P2** — Hindi copy (barely started), `next/image`, duplicate OG image routes, test gaps

### Phase 10 — UI polish & PWA ✅
- [x] Web App Manifest and Apple/favicon assets for PWA support
- [x] Login page layout responsiveness restored (side-by-side form on desktop)
- [x] "Public Spot" map privacy: checkbox on the sell form, explicit copy, exact pin
- [x] Hosted database seeded with real coordinates

### Phase 11 — Verification & repair ✅

Phase 10's features were real, but verifying them turned up four regressions that all
shared one shape: **something reported success while doing nothing.** Details and the
prevention notes are in [CLAUDE.md §5](./CLAUDE.md).

- [x] **The seed silently inserted nothing** — it wrote the columns `0009` had dropped,
      and checked `error` on none of its 11 writes. The local database had zero active
      listings while the script printed `✔ seed complete`. Fixed at the source: a
      checked `write()` helper, mutation-tested.
- [x] **Reverted the wrong fix for it.** Phase 10 responded by re-adding the dead
      columns to the *hosted* database by hand. `0012_drop_legacy_columns.sql` removes
      them again, this time as a migration.
- [x] **`public_spot` never reached existing databases** — it was added by editing the
      already-applied `0001_init.sql`, so posting a listing failed outright.
      `0013_public_spot.sql`.
- [x] **Every page with a header crashed** — `useUnreadCount` rebuilt a shared realtime
      channel per consumer. Now a module-level singleton.
- [x] **The legal draft banner had silently cleared** — placeholders were replaced with
      `.local` addresses that cannot receive mail. `legalIsDraft` now catches them.
- [x] Build unbroken, lint back to zero, sell form no longer writes dropped columns
- [x] OG metadata and sitemap moved off the service-role client onto anon, so withdrawn
      listings stop emitting share cards
- [x] Radar crowding: real sibling-aware relaxation (`radarPlacements`) replacing a
      per-bubble random nudge
- [x] Suite green and honest — 60 unit, 25 RLS, 18 E2E, and the database left as seeded

**Open:** the hosted project still needs `0012`/`0013` pushed and re-seeding, and
`src/lib/legal.ts` still needs contact details that work. See `HANDOVER.md`.
