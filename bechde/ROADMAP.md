# Bech De — Roadmap

**Current state: phases 0–9 are done.** The prototype is a real marketplace on Supabase —
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
| Tests | Vitest + Playwright + axe | 42 unit, 21 RLS, 16 E2E |
| Hosting | Vercel (planned) | root directory must be `bechde` |

---

## Still needed from you (launch blockers)

- [ ] **Supabase cloud project** (region: Mumbai / `ap-south-1`) → then
      `npx supabase link --project-ref <ref>` and `npx supabase db push`
- [ ] **Operator details** in `src/lib/legal.ts` — entity, address, grievance officer +
      email, support email. The legal pages show a draft banner until these are filled
      (DPDP Act requires a named human and a reachable address).
- [ ] **Real SMTP provider** (Resend / SES / Postmark) — Supabase's shared sender is
      rate-limited and not for production. Sign-in is the front door.
- [ ] **Vercel project** + env vars, then a **domain**
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
- [ ] **Operator details in `src/lib/legal.ts` are placeholders — fill in before launch**
- [ ] Moderation view for `reports` (they're recorded; nothing surfaces them yet)

### Phase 8 — Ship ✅ (code) / ⬜ (accounts)
- [x] Generated OG image + favicon, full metadata for WhatsApp link previews
- [x] Error boundaries (`error.tsx`, `global-error.tsx`)
- [x] [DEPLOY.md](./DEPLOY.md) runbook: Supabase project → `db push` → Vercel env vars → domain
- [ ] **Create the cloud Supabase project (ap-south-1) — only you can do this**
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

- **P0** — moderation surface for `reports`; bound photo uploads; pagination
- **P1** — live-updating chat list; saved-search emails; finish the keyboard-accessibility
  sweep; abuse/rate limits
- **P2** — radar crowding, dropping legacy columns, offer semantics, `next/image`, SEO
  metadata per listing, Hindi copy, test gaps
