# Deploying Bech De

The app is feature-complete and runs entirely on a local Supabase stack today.
Going live needs three accounts that only you can create — Supabase, Vercel, and
(optionally) a domain registrar. Everything else is already in the repo.

Est. 30–45 minutes end to end.

---

## 0. Before you start — fill in the legal details

`src/lib/legal.ts` holds the operator identity used by the privacy policy, terms and
grievance contact. It ships with `[PLACEHOLDER]` values and the legal pages show a
yellow **draft** banner while any remain. India's DPDP Act requires a named grievance
officer and a reachable address, so fill in:

```ts
entity, address, grievanceOfficer, grievanceEmail, supportEmail
```

The banner disappears by itself once every field is real. Have a lawyer read the pages
before launch — they're a solid, DPDP-shaped starting point, not legal advice.

---

## 1. Create the Supabase project

1. <https://supabase.com/dashboard> → **New project**
   - Region: **South Asia (Mumbai) `ap-south-1`** — the users are in India.
   - Save the database password somewhere safe; you need it for `db push`.
2. Wait for it to provision, then grab from **Project Settings → API**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**server-only, never commit, never
     put in a `NEXT_PUBLIC_` var**)

## 2. Push the schema

```bash
cd bechde
npx supabase login                       # opens a browser
npx supabase link --project-ref <ref>    # <ref> is in the project URL
npx supabase db push                     # applies supabase/migrations/*.sql in order
```

That creates all 11 tables, every RLS policy, the storage bucket, the realtime
publication, the search function and the safety rules. Verify in the dashboard:
**Table editor** should show `listings`, `profiles`, `chats`, `messages`, `offers`,
`saved_items`, `saved_searches`, `reports`, `blocks`, `listing_images`, `categories`.

Optional demo data (skip for a real launch — it inserts 15 fictional listings):

```bash
# point .env.local at the cloud project first
npx tsx supabase/seed.ts
```

## 3. Configure auth

**Authentication → URL Configuration**:

- Site URL: `https://<your-domain>`
- Redirect URLs: add `https://<your-domain>/auth/confirm`
  (add the Vercel preview domain too if you want magic-links to work on previews)

**Authentication → Email Templates → Magic Link**: replace the body with the contents of
`supabase/templates/magic_link.html`. This matters, and the detail is subtle: the
template links to `{{ .ConfirmationURL }}`, **not** a hand-built
`?token_hash={{ .TokenHash }}` link. `@supabase/ssr`'s browser client forces the PKCE
flow, so the emailed token is a `pkce_…` one that `verifyOtp` cannot redeem on its
own — a token_hash link fails for every real user with "Email link is invalid or has
expired", while still working from scripts. `/auth/confirm` handles both shapes.

> PKCE also means **the magic link must be opened in the browser that requested it**.
> Someone who requests the link on a laptop and taps it on their phone will not get in.
> If cross-device sign-in matters to you, that's a product decision to revisit before
> launch (it needs a different client setup, not a config toggle).

> Supabase's built-in SMTP is rate-limited to a handful of emails per hour and is not for
> production. Before real users arrive, set **Project Settings → Auth → SMTP** to a real
> provider (Resend, SES, Postmark). Sign-in *is* the product's front door — if email
> stops, nobody can log in.

## 4. Storage

`supabase/migrations/0001_init.sql` creates the `listing-images` bucket with public read
and authenticated write, so `db push` already handled it. Confirm under **Storage** that
the bucket exists and is marked public.

## 5. Deploy to Vercel

The GitHub remote is already set (`origin` → `parths301/bechde`).

```bash
git add -A && git commit -m "..." && git push
```

Then <https://vercel.com/new> → import the repo.

- **Root directory: `bechde`** — the Next app is one level down; the default (repo root)
  will fail to find `package.json`.
- Framework preset: Next.js (auto-detected). Build command and output are the defaults.

Environment variables (Production + Preview):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | the service-role key |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-domain>` (once you have one) |

`NEXT_PUBLIC_SITE_URL` only feeds `metadataBase` for OG/Twitter cards; without it the app
falls back to Vercel's generated production URL.

Deploy, then walk the flow on the real URL: sign in by email → home radar → sell a thing
with a photo → search for it → chat and make an offer → report and block from a listing.

## 6. Domain

Vercel → Project → **Domains** → add e.g. `bechde.in`, follow the DNS instructions at
your registrar. Afterwards update **both** the Supabase Site URL/redirect list (step 3)
and `NEXT_PUBLIC_SITE_URL`, or magic-links will keep pointing at the old host.

## 7. Error tracking (not wired — needs your account)

The app has React error boundaries (`src/app/error.tsx`, `src/app/global-error.tsx`) that
log to the console and surface Next's `digest` so a user-reported failure can be matched
to a server log. Nothing is sent off-box. To add Sentry:

```bash
npx @sentry/wizard@latest -i nextjs
```

then drop `Sentry.captureException(error)` into the `useEffect` in both boundary files
and add `SENTRY_DSN` to Vercel. It was deliberately left out rather than half-wired,
since it needs an account and a DSN.

---

## Post-launch checklist

- [ ] Legal placeholders filled in, draft banner gone, pages reviewed by a lawyer
- [ ] Real SMTP provider configured (not Supabase's shared sender)
- [ ] Someone actually reads `reports` — nothing surfaces them in-app yet, so query the
      table or build an admin view. Reports are useless if nobody looks.
- [ ] CI is wired (`.github/workflows/ci.yml`) but only runs once the repo is pushed —
      check the first run goes green
- [ ] Database backups: Supabase's free tier keeps 7 days; paid plans keep more (**decide
      before you have real user data**, not after)
- [ ] Rate limiting on sign-in — Supabase Auth has built-in limits; raise them only if
      you know why
- [ ] A privacy-friendly analytics choice, if you want one (Vercel Analytics is one
      switch and doesn't use cookies)

## Known gaps at launch

- **Reports have no moderation UI.** They're recorded with RLS so only the reporter sees
  their own; reviewing means querying the table.
- **Reviews only exist after an accepted offer.** That's deliberate (it's what makes a
  rating mean something), but it does mean a brand-new marketplace shows "new seller"
  on every listing until the first deals close.
- **Saved searches don't notify.** New matches are counted in-app; there's no email or
  push sender, and the copy says so.
- **Magic links are single-browser** (PKCE) — see step 3.


---

## Phase 12 additions — what else the hosted project needs

These arrived with the launch-readiness work. Nothing below is optional if you want the
corresponding feature to work; each one fails loudly rather than silently if missed.

### Migrations

`0016`–`0020` are new. Push them with the rest:

```bash
npx supabase migration list --linked   # see where prod actually is
npx supabase db push
```

`0017` inserts the categories. That matters more than it sounds: before it, the
`categories` rows existed only because the *demo seed* created them, so a production
database that correctly skipped the seed would have rejected every listing on the
`listings.category` foreign key.

### Re-seeding a hosted database

```bash
SEED_SELLER_EMAIL=you@yourdomain.com npm run seed
```

The seed refuses to run against a non-local URL without it. The seeded listings are
staying up as real inventory, so a buyer who messages the guitar seller has to reach a
human — `rohan@bechde.local` cannot receive mail. Sellers get plus-addressed off your
inbox (`you+rohan@…`), so you can tell which listing the mail came from.

### Auth template

Re-paste `supabase/templates/magic_link.html` into **Auth → Email Templates → Magic
Link**. It now carries `{{ .Token }}` alongside the link. Without it the 6-digit code
field on `/login` accepts input and can never succeed — and that field is the only
thing that works when someone opens the email on a different device, which on a
phone-first marketplace is most people.

### Environment variables

| Variable | Where | What breaks without it |
|---|---|---|
| `RESEND_API_KEY` | Vercel | Both cron routes return 503. **Nothing is sent and nothing is marked sent** — deliberate. |
| `EMAIL_FROM` | Vercel | Falls back to `hello@bechde.app`, which will fail SPF unless you own it. |
| `CRON_SECRET` | Vercel | Cron routes refuse everyone, including Vercel. They fail closed. |
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel | Errors go to the console only; the SDK never loads. |
| `SEED_SELLER_EMAIL` | your shell | The seed refuses to touch a hosted database. |

Generate the cron secret with `openssl rand -hex 32`.

### Resend

1. Create the account, add and verify your domain (DKIM + SPF records).
2. Use it for **Supabase Auth custom SMTP** too — the shared sender is rate-limited and
   sign-in is the front door.
3. `vercel.json` already declares the schedules: messages every 10 minutes, saved
   searches daily at 09:00 UTC. Vercel picks them up on deploy.

### After deploying

```bash
curl https://your-domain/api/health          # {"ok":true,"db":"up"}
curl -I https://your-domain/                 # X-Frame-Options: DENY
curl -o /dev/null -w '%{http_code}\n' https://your-domain/product/nope   # 404, not 200
```

The CSP ships **report-only**. Watch the violation reports for a week before switching
it to enforcing — the app is inline-styled throughout, so a blocking policy needs
evidence rather than a guess.

### Making yourself an admin

There's no self-service path, on purpose:

```sql
update profiles set is_admin = true where email = 'you@yourdomain.com';
```

Then `/admin` appears in the header. Every edit you make there is recorded in
`admin_actions` with your name and the reason you typed — including yours.
