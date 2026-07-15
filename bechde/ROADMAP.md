# Bech De — Roadmap to a Real Marketplace

Current state: a **hi-fi clickable prototype** built in Next.js (App Router).
Every screen works, but all data is mock and in-memory — it resets on refresh.
There is no backend, no real auth, and product photos are striped placeholders.

This document tracks the work to turn the prototype into a real, launchable
marketplace using **Supabase** (database, auth, storage) and
**OpenStreetMap / MapLibre** (maps + geocoding).

---

## Chosen stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) — already built |
| Database | Supabase Postgres |
| Auth | Supabase Auth (phone OTP, or email magic-link for MVP — TBD) |
| Image storage | Supabase Storage |
| Maps / tiles | MapLibre GL + MapTiler (or Stadia) tiles |
| Geocoding | MapTiler geocoding (same key as tiles) |
| Realtime chat | Supabase Realtime |
| Hosting | Vercel (natural fit for Next.js) |

---

## What I need from you (blockers)

- [ ] **Supabase project** (region: Mumbai / ap-south-1)
  - [ ] Project URL — `https://xxxx.supabase.co`
  - [ ] Anon public key (browser-safe)
  - [ ] Service role key (server-only, secret — do not commit)
- [ ] **MapTiler API key** (tiles + geocoding under one key)
- [ ] **OTP decision:**
  - [ ] **A** — Real phone OTP now (also needs a Twilio/MessageBird account + India DLT registration + per-SMS cost)
  - [ ] **B** — Email magic-link for MVP (free, ships this week; keep phone field as "verify later") — *recommended*
- [ ] **GitHub Personal Access Token** (scope: `repo`) so the code can be pushed to a new repo

Secrets go into `.env.local` (gitignored) locally and into Vercel's env settings for deploy.
Never paste the service-role key or Twilio token into a committed file.

---

## Build plan

### Phase 0 — Scaffolding (no keys required; can start immediately)
- [ ] Install `@supabase/supabase-js` and `maplibre-gl`
- [ ] Add typed Supabase client wrappers (browser + server) reading from env
- [ ] Write DB schema + SQL migrations
- [ ] Row-Level Security (RLS) policies on every table
- [ ] Build a real MapLibre map component (keyed off an env var, graceful fallback)

### Phase 1 — Data layer
- [ ] Tables: `profiles`, `listings`, `listing_images`, `categories`,
      `chats`, `messages`, `offers`, `saved_items`
- [ ] Seed script porting the current mock `data.ts` items into the DB
- [ ] Replace mock reads in `lib/data.ts` with Supabase queries behind the
      same interfaces (screens stay untouched)

### Phase 2 — Auth
- [ ] Wire signup/OTP screen to Supabase Auth (phone or email per decision)
- [ ] Session handling + protected `(app)` routes
- [ ] `profiles` row created on first sign-in

### Phase 3 — Listings & images
- [ ] Sell form writes a real listing to the DB
- [ ] Real image upload to Supabase Storage (replace striped placeholders)
- [ ] Listing detail page reads real data by id

### Phase 4 — Location & the radar
- [ ] Browser geolocation permission flow
- [ ] Geocode the user's neighbourhood → lat/lng
- [ ] Store listing coordinates; compute real distances (PostGIS or haversine)
- [ ] Radar / map radius filter driven by real distance data

### Phase 5 — Chat & offers
- [ ] Persistent messages per chat thread
- [ ] Supabase Realtime for live message delivery
- [ ] Offer → accept/decline flow writing shared state both parties see

### Phase 6 — Search & discovery
- [ ] Wire the (currently decorative) search bar to DB text search
- [ ] Category + radius + price filters against real data

### Phase 7 — Trust, safety & legal (pre-launch)
- [ ] Report / block on listings and users
- [ ] Remove / mark-sold a listing
- [ ] Prohibited-items rules
- [ ] Privacy policy + terms (India DPDP Act applies — collecting phone/email)
- [ ] Grievance contact

### Phase 8 — Ship
- [ ] Push to GitHub, connect Vercel
- [ ] Set env vars in Vercel
- [ ] Error tracking (Sentry) + basic analytics
- [ ] Favicon + OG image for shareable WhatsApp links
- [ ] Custom domain (e.g. bechde.in)

---

## Known limitations of the current prototype (to be removed)
- State is in-memory — likes/chats reset on refresh
- OTP is faked (any code works)
- Product photos are `repeating-linear-gradient` placeholders
- Distances and "N people nearby" counts are computed from static numbers
- Search bar does nothing
