# Your launch checklist

Everything here needs **your** accounts, credentials or judgement — none of it can be done
from the code. Technical background for any step is in [`README.md`](./README.md).

Work top to bottom. Steps 1–4 are blocking; 5–8 can happen the same day or the day after.

---

## 1. Fill in the legal details — the only hard blocker

**File:** `src/lib/legal.ts`

```ts
entity           // registered entity or proprietor name
address          // registered address
grievanceOfficer // a named human
grievanceEmail   // a mailbox that receives mail and is read
supportEmail
jurisdiction
```

They currently hold `.local` addresses, which **cannot receive mail**. India's DPDP Act
requires a named grievance officer reachable at a working address, so this is a compliance
failure rather than a placeholder — and it's why the yellow **draft** banner is on every
legal page. The banner disappears by itself once every field is real; `legalIsDraft`
rejects `.local`, `example.com`, `localhost` and `TODO`.

Have a lawyer read `/legal/terms` and `/legal/privacy` before launch. They're a solid,
DPDP-shaped starting point, not legal advice.

- [ ] Entity name and registered address decided
- [ ] Grievance mailbox created and monitored
- [ ] `src/lib/legal.ts` filled in, draft banner gone
- [ ] Lawyer has read both pages

---

## 2. Bring the hosted Supabase project up to date

The project already exists: **`iwhefgykblkwnuazfczv`** (region should be `ap-south-1`).
It has **drifted** from the migrations — legacy columns were re-added by hand at one point,
and it predates everything from `0016` on.

```bash
npx supabase login
npx supabase link --project-ref iwhefgykblkwnuazfczv
npx supabase migration list --linked    # see where it actually is
npx supabase db push                    # applies 0012 … 0021
```

`0017` is the one to not skip: before it, the `categories` rows existed **only** because
the demo seed created them. A production database that correctly skipped the seed would
have rejected every listing on the `listings.category` foreign key.

- [ ] `migration list --linked` reviewed
- [ ] `db push` clean
- [ ] Table editor shows `admin_actions`, `cities`, `localities`, `category_attributes`,
      `notification_tokens`
- [ ] `select count(*) from cities` returns **9**. Before `0021` the table held four, while
      the picker rendered its own hardcoded list of nine — so the table looked complete
      while five cities were quietly missing from production's picker.

---

## 3. Re-seed the hosted database

```bash
SEED_SELLER_EMAIL=you@yourdomain.com npm run seed
```

The seed **refuses** to run against a hosted URL without `SEED_SELLER_EMAIL`. You chose to
keep the seeded listings up as real inventory, so a buyer who messages the guitar seller
has to reach a person — `rohan@bechde.local` cannot. Sellers get plus-addressed off your
inbox (`you+rohan@…`), so you can tell which listing the mail came from.

- [ ] Seeded with a monitored address
- [ ] Messaged one seeded listing yourself and the mail arrived

---

## 4. Auth configuration

In the Supabase dashboard:

1. **Authentication → URL Configuration** — Site URL, plus `…/auth/confirm` in redirect
   URLs.
2. **Authentication → Email Templates → Magic Link** — paste
   `supabase/templates/magic_link.html` **again**. It now carries `{{ .Token }}` as well
   as the link. Without it the 6-digit code field on `/login` accepts input and can never
   succeed — and that field is the only thing that works when someone opens the email on a
   different device, which on a phone is most people.
3. **Authentication → SMTP** — point at Resend (step 5). Supabase's shared sender is
   rate-limited and not for production. Sign-in is the front door.

- [ ] Site URL + redirect set
- [ ] Magic-link template re-pasted, `{{ .Token }}` visible in a test email
- [ ] Custom SMTP configured
- [ ] **Signed in on a phone, using the code, from a different device than you requested it on**

---

## 5. Resend

1. Create the account, add your domain, and add the **DKIM + SPF** records it gives you.
   Mail from an unverified domain goes to spam or is rejected outright.
2. Collect the API key.

- [ ] Domain verified (DKIM + SPF green)
- [ ] `RESEND_API_KEY` in hand

---

## 6. Vercel

Import the repo with **root directory `bechde`**. Then set the environment variables:

| Variable | What breaks without it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Nothing works |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Nothing works |
| `SUPABASE_SERVICE_ROLE_KEY` | Account closure, cron digests. **Server-only — never a `NEXT_PUBLIC_` var** |
| `NEXT_PUBLIC_SITE_URL` | OG cards and email links point at the wrong host |
| `RESEND_API_KEY` | Cron routes return 503. Nothing is sent **and nothing is marked sent** — deliberate |
| `EMAIL_FROM` | Falls back to `hello@bechde.app`, which will fail SPF unless you own it |
| `CRON_SECRET` | Cron routes refuse everyone, including Vercel. They fail closed |
| `NEXT_PUBLIC_SENTRY_DSN` | Errors go to the console only (optional) |

Generate the cron secret with `openssl rand -hex 32`.

`vercel.json` already declares the schedules — messages daily at 13:00 UTC, saved searches
daily at 09:00 UTC. Vercel picks them up on deploy. Both are once-daily because Hobby
plans reject any cron more frequent than that at deploy time — a `*/10 * * * *` schedule
here failed every deploy silently until this was caught. If you're on Pro, you can safely
tighten the messages schedule (e.g. `*/10 * * * *`) for near-real-time notifications; just
also shrink `LOOKBACK_HOURS` back down in `src/app/api/cron/messages/route.ts` — it was
padded to 26h specifically to survive Hobby's ±59min daily scheduling slop.

- [ ] Project imported, root directory `bechde`
- [ ] All variables set
- [ ] First deploy green

---

## 7. Domain

Attach it, then update **both** the Supabase Site URL **and** `NEXT_PUBLIC_SITE_URL`
together. Updating one without the other breaks sign-in redirects in a way that looks like
an auth bug.

- [ ] Domain live
- [ ] Both URLs updated

---

## 8. Verify it for real

```bash
curl https://your-domain/api/health                                  # {"ok":true,"db":"up"}
curl -I https://your-domain/                                         # X-Frame-Options: DENY
curl -o /dev/null -w '%{http_code}\n' https://your-domain/product/nope   # 404, not 200
```

Then by hand:

- [ ] Sign in **on a phone** with the 6-digit code, from a different device than requested
- [ ] Post a listing with photos and category questions
- [ ] Message it from a second account; don't wait a day for the cron — trigger it directly:
      `curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/messages`
      and confirm the digest email arrives
- [ ] Click the unsubscribe link in that email while signed out — it works
- [ ] `/profile` → Download my data returns your JSON
- [ ] Make yourself an admin and confirm `/admin` loads:
      ```sql
      update profiles set is_admin = true where email = 'you@yourdomain.com';
      ```
- [ ] Edit a listing in `/admin` and confirm it shows in the audit log with your reason

---

## Ongoing, once live

- **Sentry** — watch the feed on day one. The failure most worth catching is a sign-in
  that doesn't complete.
- **CSP** — it ships **report-only** on purpose. The app is inline-styled throughout, so a
  blocking policy needed evidence rather than a guess. Watch the violation reports for a
  week, then tighten `next.config.ts`.
- **Backups** — Supabase's free tier has no point-in-time recovery. If this holds real
  users' chat history, that's worth paying for.
- **Cold start** — the radar is empty for anyone outside the seeded neighbourhood. No
  feature fixes that; launching one locality at a time does.

---

## Decisions already made (recorded so they don't get re-litigated)

| Decision | Why |
|---|---|
| Seeded listings stay up as real inventory | Your call. Step 3 removes the dead-end risk by pointing sellers at a mailbox you read. |
| Listing attributes are per-category templates | Matches how OLX and Facebook Marketplace work; adding a question is an admin action, not a deploy. |
| Price hint says "asking", not "sold" | eBay and Mercari price off sold comparables. With no sales history, calling these sale prices would overstate the data. |
| Account closure anonymises, doesn't delete | `profiles` cascades into chats and messages, so a real delete would destroy the *other* person's history. |
| Email provider is Resend | Simplest for both jobs — Supabase custom SMTP and the digest API. |
