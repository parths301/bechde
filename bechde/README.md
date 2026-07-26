# Bech De — neighbourhood resale marketplace

A cozy, playful hyperlocal resale marketplace for young Indians — the "radar" of nearby
items is the signature feature. Built from the Claude Design prototype
(`../project/Bech De Prototype.dc.html`) as a Next.js 16 + TypeScript app, then turned
into a real product on **Supabase** (Postgres, Auth, Storage, Realtime) and
**OpenStreetMap** (Leaflet tiles + Nominatim geocoding, no API key).

Nothing in the app is mocked any more: sign-in, listings, photos, distances, chat,
offers, likes, search, reputation and moderation all hit a real database.

> **Working on this codebase?** Read **[CLAUDE.md](./CLAUDE.md)** first — architecture,
> the gotchas that cost real time, and a prioritized list of what to do next. This file
> only covers getting it running.

## Run it locally

You need Docker (or [colima](https://github.com/abiosoft/colima), which is what this was
built on) for the Supabase stack.

```bash
colima start                 # or start Docker Desktop
npx supabase start           # boots Postgres, Auth, Storage, Realtime, Studio, Mailpit
cp .env.local.example .env.local
npx supabase status -o env   # paste the anon + service_role keys into .env.local
npm run seed                 # 15 listings + 6 past deals, 12 profiles, 4 chats
npm install && npm run dev
```

Open <http://localhost:3000>. Sign in as **aisha@bechde.local** (the demo buyer, with
seeded chats) or **rohan@bechde.local** (the guitar's seller) — magic-link emails land in
**Mailpit at <http://127.0.0.1:54324>**, not a real inbox. Supabase Studio is on
<http://127.0.0.1:54323>.

> `supabase/config.toml` sets `[analytics] enabled = false`: the vector container can't
> mount colima's docker socket. Drop that line if you're on Docker Desktop.

## The flow

sign in (email magic-link) → home (radar of real nearby listings + radius slider) →
search (ranked, typo-tolerant, saveable) → map (radius/category/price filters) →
product (story timeline, like, report/block) → chat (live messages, offers, accept) →
sell (photo upload → geocoded listing) → profile (your listings, sold, saved, blocked)

## Tests

```bash
npm test          # unit tests (pure logic) — no database needed
npm run test:db   # RLS suite — needs the local stack, seeded
npx playwright test   # end-to-end in a real browser, incl. an axe accessibility pass
```

The RLS suite (`supabase/tests/`) is the important one: it signs in for real through
Mailpit and asserts the policies hold — private chats stay private, a blocked user
can't message you, reports can't be filed in someone else's name, only a participant
of an accepted deal can leave a review. It exists because a policy that read the
`blocks` table directly *looked* correct and silently let blocked users keep messaging;
the test reproduces that bug if the `is_blocked_by()` helper is ever removed.

Playwright signs in once per run and reuses the session — `supabase/config.toml` raises
the local `email_sent` rate limit for the same reason (production uses real SMTP).

## Structure

- `src/lib/queries.ts` — every read/write hook (listings, search, chat, offers, likes,
  safety). Screens stay client components and call these.
- `src/lib/supabase/` — browser and server clients (`server.ts` is `server-only`)
- `src/lib/geo.ts` — haversine distances, radar placement, geocoding helpers
- `src/lib/search.ts` — the `Filters` shape + URL codec shared by search, map and header
- `src/lib/legal.ts` — **operator details for the legal pages; fill in before launch**
- `src/lib/data.ts` — seed source, UI constants and types (no runtime data)
- `src/lib/store.tsx` — React context for session/optimistic UI only
- `src/proxy.ts` — Next 16's renamed middleware; refreshes the session, gates routes
- `src/app/api/geocode/` — Nominatim proxy (server-side, so it can send a User-Agent)
- `supabase/migrations/` — schema, RLS, search, safety; `supabase/seed.ts` — demo data

Design rules (Bricolage Grotesque + Karla, cream `#FBF6ED`, pill buttons, dashed
dividers, prices in clay `#B4552D`) follow `../project/Bech De Design System.dc.html`.
Listings without photos fall back to the prototype's striped placeholders.

## Docs

| File | What's in it |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | Architecture, subsystems, gotchas, prioritized next steps — **start here** |
| [DEPLOY.md](./DEPLOY.md) | Launch runbook + known gaps |
| [ROADMAP.md](./ROADMAP.md) | Phase-by-phase status |
| `../chats/` | What the user asked for (`chat1.md` design, `chat2.md` build) |

## Deploying

See **[DEPLOY.md](./DEPLOY.md)** — create the Supabase project (ap-south-1),
`supabase db push`, set the Vercel env vars, point the auth redirect at your domain.
Known gaps at launch are listed there too.
